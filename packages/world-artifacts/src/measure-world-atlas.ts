import { geoPath } from "d3-geo";
import { brotliCompress, gzip } from "node:zlib";
import { promisify } from "node:util";
import { feature } from "topojson-client";
import { asManifestUrl, parseManifest, selectArtifacts } from "./receiver.ts";
import type { LonLatBounds } from "./shards.ts";

const gzipBytes = promisify(gzip);
const brotliBytes = promisify(brotliCompress);

const argument = (name: "--release" | "--output" | "--runs"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};

const releaseDirectory = argument("--release");
if (releaseDirectory === undefined) {
  console.error("Usage: measure-world-atlas.ts --release <directory> [--output <file>] [--runs <count>]");
  Deno.exit(1);
}
const output = argument("--output") ?? `build/measurements/${releaseDirectory.split(/[\\/]/).at(-1)}.json`;
const runs = Math.max(3, Number(argument("--runs") ?? "5"));

const scenarios: readonly Readonly<{ readonly id: string; readonly bounds: LonLatBounds }>[] = [
  { id: "north-america", bounds: [-140, 20, -50, 80] },
  { id: "europe-africa", bounds: [-20, -35, 50, 70] },
  { id: "pacific", bounds: [150, -35, -150, 35] },
  { id: "arctic", bounds: [-180, 55, 180, 90] },
  { id: "southern-ocean", bounds: [-180, -90, 180, -50] },
  { id: "atlantic", bounds: [-80, -50, 20, 60] },
  { id: "antimeridian", bounds: [170, -20, -170, 30] },
  { id: "full-world", bounds: [-180, -90, 180, 90] },
];

const median = (values: readonly number[]): number => {
  const ordered = [...values].toSorted((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)] ?? 0;
};
const range = (values: readonly number[]): readonly [number, number] => [Math.min(...values), Math.max(...values)];

const raw = JSON.parse(await Deno.readTextFile(`${releaseDirectory}/manifest.json`)) as unknown;
const manifest = parseManifest(raw, asManifestUrl("./manifest.json")._unsafeUnwrap());
if (manifest.isErr()) {
  console.error(manifest.error.message);
  Deno.exit(1);
}

const path = geoPath();
const artifactBytes = new Map(await Promise.all(manifest.value.artifacts.map(async (artifact) => {
  const bytes = await Deno.readFile(`${releaseDirectory}/${artifact.id}.topo.json`);
  return [artifact.id, {
    bytes,
    raw: bytes.byteLength,
    gzip: (await gzipBytes(bytes)).byteLength,
    brotli: (await brotliBytes(bytes)).byteLength,
  }] as const;
})));
const measure = async (bounds: LonLatBounds) => {
  const artifacts = selectArtifacts(manifest.value, bounds);
  const transfer = artifacts.map((artifact) => artifactBytes.get(artifact.id)).filter((value): value is NonNullable<typeof value> => value !== undefined);
  const samples = await Array.from({ length: runs }).reduce<Promise<readonly Readonly<{
    rawBytes: number;
    gzipBytes: number;
    brotliBytes: number;
    decodeMs: number;
    pathMs: number;
    retainedHeapBytes: number;
    pathCharacters: number;
  }>[]>>(async (previous) => {
    const completed = await previous;
    const memoryBefore = Deno.memoryUsage().heapUsed;
    const started = performance.now();
    const decoded = transfer.map(({ bytes }) => JSON.parse(new TextDecoder().decode(bytes)) as Readonly<{ readonly objects: Readonly<Record<string, unknown>> }>);
    const decodeFinished = performance.now();
    const pathCharacters = decoded.map((topology) => String(path(feature(topology as never, topology.objects.land as never)) ?? "").length).reduce((sum, value) => sum + value, 0);
    const pathFinished = performance.now();
    return [...completed, {
      rawBytes: transfer.reduce((sum, value) => sum + value.raw, 0),
      gzipBytes: transfer.reduce((sum, value) => sum + value.gzip, 0),
      brotliBytes: transfer.reduce((sum, value) => sum + value.brotli, 0),
      decodeMs: decodeFinished - started,
      pathMs: pathFinished - decodeFinished,
      retainedHeapBytes: Math.max(0, Deno.memoryUsage().heapUsed - memoryBefore),
      pathCharacters,
    }];
  }, Promise.resolve([]));
  return {
    bounds,
    artifactIds: artifacts.map((artifact) => artifact.id),
    requestCount: artifacts.length,
    rawBytes: { median: median(samples.map((sample) => sample.rawBytes)), range: range(samples.map((sample) => sample.rawBytes)) },
    gzipBytes: { median: median(samples.map((sample) => sample.gzipBytes)), range: range(samples.map((sample) => sample.gzipBytes)) },
    brotliBytes: { median: median(samples.map((sample) => sample.brotliBytes)), range: range(samples.map((sample) => sample.brotliBytes)) },
    decodeMs: { median: median(samples.map((sample) => sample.decodeMs)), range: range(samples.map((sample) => sample.decodeMs)) },
    pathMs: { median: median(samples.map((sample) => sample.pathMs)), range: range(samples.map((sample) => sample.pathMs)) },
    retainedHeapBytes: { median: median(samples.map((sample) => sample.retainedHeapBytes)), range: range(samples.map((sample) => sample.retainedHeapBytes)) },
    pathCharacters: median(samples.map((sample) => sample.pathCharacters)),
  };
};

const measuredScenarios = await scenarios.reduce<Promise<Record<string, unknown>>>(
  async (previous, { id, bounds }) => ({ ...(await previous), [id]: await measure(bounds) }),
  Promise.resolve({}),
);
const record = {
  format: 1,
  release: manifest.value.release,
  manifestFormat: manifest.value.format,
  runs,
  measuredAt: new Date().toISOString(),
  scenarios: measuredScenarios,
};
await Deno.mkdir(output.split(/[\\/]/).slice(0, -1).join("/") || ".", { recursive: true });
await Deno.writeTextFile(output, JSON.stringify(record, null, 2));
console.log(`Measured ${record.release} at ${output}`);

import { feature } from "topojson-client";
import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { LandGeometry } from "../../core/src/map.ts";
import { asManifestUrl, resolveArtifactUrl, type ImmutableArtifactUrl, type ManifestUrl, type ReceiveFailure, type ReleaseRef } from "./receiver.ts";
import { parseManifest } from "./receiver.ts";
import { encodeInitialPayload, initialSelectionKey } from "./initial-payload.ts";
import { selectArtifacts } from "./receiver.ts";
import type { ArtifactDescriptor, ArtifactDigest } from "./shards.ts";
import type { ArtifactStore, DigestPort, ManifestDecoder, TopologyDecoder } from "./receiver-runtime.ts";

export type LocalReleaseConfig = Readonly<{ readonly root: string; readonly release: ReleaseRef }>;

const transport = (message: string): ReceiveFailure => ({ kind: "transport", message });
const validReleaseDirectory = (release: ReleaseRef): boolean => /^[a-zA-Z0-9._-]+$/.test(release);
const releaseDirectory = (config: LocalReleaseConfig): string => `${config.root}/${config.release}`;
const artifactFile = (url: ImmutableArtifactUrl): string => url.slice(2);

export const createFilesystemArtifactStore = (config: LocalReleaseConfig): ArtifactStore => ({
  readManifest: () => validReleaseDirectory(config.release)
    ? ResultAsync.fromPromise(Deno.readFile(`${releaseDirectory(config)}/manifest.json`), () => transport("Configured manifest could not be read."))
    : ResultAsync.fromSafePromise(Promise.resolve(err(transport("Configured release directory is invalid.")))).andThen((result) => result),
  readArtifact: (url) => url.startsWith("./") && !url.includes("..") && !url.includes("\\")
    ? ResultAsync.fromPromise(Deno.readFile(`${releaseDirectory(config)}/${artifactFile(url)}`), () => transport("Configured artifact could not be read."))
    : ResultAsync.fromSafePromise(Promise.resolve(err(transport("Artifact URL is not approved.")))).andThen((result) => result),
});

export const createLocalManifestUrl = (config: LocalReleaseConfig): ManifestUrl =>
  asManifestUrl(`./${config.release}/manifest.json`)._unsafeUnwrap();

export const jsonManifestDecoder: ManifestDecoder = {
  decode: (bytes) => ResultAsync.fromPromise(Promise.resolve().then(() => JSON.parse(new TextDecoder().decode(bytes))), () => transport("Manifest JSON could not be decoded.")),
};

export const sha256DigestPort: DigestPort = {
  sha256: (bytes) => ResultAsync.fromPromise(
    crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer).then((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") as ArtifactDigest
    ),
    () => transport("Artifact digest could not be computed."),
  ),
};

const topologyFailure = (): ReceiveFailure => ({ kind: "decode", message: "Artifact TopoJSON could not be decoded." });

export const topologyLandDecoder: TopologyDecoder = {
  decode: (bytes, descriptor) => ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const topology = JSON.parse(new TextDecoder().decode(bytes)) as Readonly<{ readonly objects?: Readonly<Record<string, unknown>> }>;
      const object = topology.objects?.[descriptor.objectName];
      const decoded = object === undefined ? undefined : feature(topology as never, object as never) as Readonly<{ readonly features?: readonly Readonly<{ readonly id?: string | number }>[] }>;
      return decoded?.features?.map((entry, index) => String(entry.id ?? `${descriptor.id}-${index}`)) ?? [];
    }),
    topologyFailure,
  ),
};

export const decodeLandGeometry = (bytes: Uint8Array, descriptor: ArtifactDescriptor): ResultAsync<readonly LandGeometry[], ReceiveFailure> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const topology = JSON.parse(new TextDecoder().decode(bytes)) as Readonly<{ readonly objects?: Readonly<Record<string, unknown>> }>;
      const object = topology.objects?.[descriptor.objectName];
      const decoded = object === undefined ? undefined : feature(topology as never, object as never) as Readonly<{ readonly features?: readonly unknown[] }>;
      return decoded?.features?.map((geometry, index) => ({ id: `${descriptor.id}-${index}`, geometry })) ?? [];
    }),
    topologyFailure,
  );

export type LocalArtifactRoute = (request: Request) => Promise<Response>;

const artifactRouteResponse = (status: number, body: Uint8Array | string, headers: Readonly<Record<string, string>>): Response =>
  new Response(typeof body === "string" ? body : new Uint8Array(body), { status, headers });

export const createLocalArtifactRoute = async (
  config: LocalReleaseConfig,
  allowedOrigins: readonly string[] = [],
): Promise<Result<LocalArtifactRoute, ReceiveFailure>> => {
  const store = createFilesystemArtifactStore(config);
  const bytes = await store.readManifest(config.release);
  if (bytes.isErr()) return err(bytes.error);
  const raw = await jsonManifestDecoder.decode(bytes.value, createLocalManifestUrl(config));
  if (raw.isErr()) return err(raw.error);
  const manifest = parseManifest(raw.value, asManifestUrl("./manifest.json")._unsafeUnwrap());
  if (manifest.isErr()) return err(manifest.error);
  const base = `/artifacts/${config.release}`;
  const allowedFiles = manifest.value.artifacts.map((artifact) => artifact.url.slice(2));
  return ok(async (request: Request) => {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const cors: Readonly<Record<string, string>> = origin !== null && allowedOrigins.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
    const isManifest = url.pathname === `${base}/manifest.json`;
    const file = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length + 1) : "";
    if (request.method !== "GET" || (!isManifest && !allowedFiles.includes(file))) {
      return artifactRouteResponse(404, "Not found", { "cache-control": "no-store", ...cors });
    }
    const read = isManifest ? store.readManifest(config.release) : store.readArtifact(`./${file}` as ImmutableArtifactUrl);
    const content = await read;
    return content.isErr()
      ? artifactRouteResponse(404, "Not found", { "cache-control": "no-store", ...cors })
      : artifactRouteResponse(200, content.value, {
        "content-type": isManifest ? "application/json" : "application/topo+json",
        "cache-control": isManifest ? "no-store" : "public, max-age=31536000, immutable",
        ...cors,
      });
  });
};

const parseBoundsParameter = (value: string | null): readonly [number, number, number, number] | undefined => {
  const values = value?.split(",").map(Number);
  const west = values?.[0] ?? Number.NaN;
  const south = values?.[1] ?? Number.NaN;
  const east = values?.[2] ?? Number.NaN;
  const north = values?.[3] ?? Number.NaN;
  return values?.length === 4 && [west, south, east, north].every(Number.isFinite) && west >= -180 && west <= 180 && east >= -180 && east <= 180 && south >= -90 && south <= 90 && north >= -90 && north <= 90 && south <= north
    ? [west, south, east, north]
    : undefined;
};

const compressed = async (bytes: Uint8Array, encoding: "br" | "gzip" | "identity"): Promise<Uint8Array> => encoding === "identity"
  ? bytes
  : new Uint8Array(await new Response(new Blob([Uint8Array.from(bytes).buffer]).stream().pipeThrough(new CompressionStream(encoding === "br" ? "brotli" : "gzip"))).arrayBuffer());

export const createLocalInitialPayloadRoute = async (config: LocalReleaseConfig): Promise<Result<LocalArtifactRoute, ReceiveFailure>> => {
  const store = createFilesystemArtifactStore(config);
  const raw = await store.readManifest(config.release);
  if (raw.isErr()) return err(raw.error);
  const decoded = await jsonManifestDecoder.decode(raw.value, createLocalManifestUrl(config));
  if (decoded.isErr()) return err(decoded.error);
  const manifest = parseManifest(decoded.value, asManifestUrl("./manifest.json")._unsafeUnwrap());
  if (manifest.isErr()) return err(manifest.error);
  const base = `/artifacts/${config.release}/initial`;
  return ok(async (request) => {
    const url = new URL(request.url);
    const bounds = parseBoundsParameter(url.searchParams.get("bounds"));
    if (request.method !== "GET" || url.pathname !== base || bounds === undefined) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const key = await initialSelectionKey(manifest.value, bounds);
    const selected = selectArtifacts(manifest.value, bounds);
    const reads = await Promise.all(selected.map(async (descriptor) => {
      const artifact = resolveArtifactUrl(descriptor);
      return artifact.isErr() ? err(artifact.error) : await store.readArtifact(artifact.value);
    }));
    const rejected = reads.find((result) => result.isErr());
    if (rejected?.isErr()) return new Response("Artifact unavailable", { status: 502, headers: { "cache-control": "no-store" } });
    const pack = encodeInitialPayload(manifest.value, bounds, key, selected.map((descriptor, index) => ({ descriptor, bytes: (reads[index] ?? err({ kind: "transport", message: "Artifact read is missing." } satisfies ReceiveFailure))._unsafeUnwrap() })));
    if (pack.isErr()) return new Response("Payload rejected", { status: 500, headers: { "cache-control": "no-store" } });
    const accepted = request.headers.get("accept-encoding") ?? "";
    const encoding = accepted.includes("br") ? "br" : accepted.includes("gzip") ? "gzip" : "identity";
    return new Response(Uint8Array.from(await compressed(pack.value, encoding)).buffer, { headers: { "content-type": "application/vnd.cloudmappr.artifact-pack", "content-encoding": encoding === "identity" ? "identity" : encoding, "cache-control": "public, max-age=31536000, immutable", vary: "accept-encoding", "deno-cache-id": `${config.release}:${key}` } });
  });
};

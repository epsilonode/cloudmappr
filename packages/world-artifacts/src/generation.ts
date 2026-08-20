import { err, ok, type Result } from "neverthrow";
import {
  type ArtifactDescriptor,
  type ArtifactDigest,
  type CoverageBounds,
  asAtomicPartId,
  asSourceFeatureId,
  asReleaseIdentity,
  type AtomicPart,
  createManifest,
  type GenerationFailure,
  partsForShard,
  type ShardAssignment,
  type ShardId,
  shardIds,
  validateAssignments,
  type WorldManifest,
} from "./shards.ts";

type FixturePart = Readonly<{
  readonly id: string;
  readonly bounds: readonly [number, number, number, number];
  readonly coordinates: readonly (readonly (readonly [number, number])[])[];
}>;

export type MapshaperPort = (
  inputPath: string,
  outputPath: string,
  shardId: ShardId,
) => Promise<Result<void, GenerationFailure>>;

type TopologyObject = Readonly<{
  readonly type: "Topology";
  readonly objects: Readonly<Record<string, unknown>>;
}>;

const fixtureParts: readonly FixturePart[] = [
  {
    id: "world-basemap-part",
    bounds: [-170, -20, -160, -10],
    coordinates: [[[-170, -20], [-160, -20], [-160, -10], [-170, -20]]],
  },
  {
    id: "north-america-part",
    bounds: [-130, 20, -70, 60],
    coordinates: [[[-130, 20], [-70, 20], [-70, 60], [-130, 20]]],
  },
  {
    id: "south-america-part",
    bounds: [-80, -55, -35, 10],
    coordinates: [[[-80, -55], [-35, -55], [-35, 10], [-80, -55]]],
  },
  {
    id: "europe-part",
    bounds: [-10, 35, 35, 70],
    coordinates: [[[-10, 35], [35, 35], [35, 70], [-10, 35]]],
  },
  {
    id: "africa-part",
    bounds: [-20, -35, 50, 35],
    coordinates: [[[-20, -35], [50, -35], [50, 35], [-20, -35]]],
  },
  {
    id: "asia-part",
    bounds: [35, 5, 150, 75],
    coordinates: [[[35, 5], [150, 5], [150, 75], [35, 5]]],
  },
  {
    id: "oceania-major-part",
    bounds: [110, -45, 180, -5],
    coordinates: [[[110, -45], [180, -45], [180, -5], [110, -45]]],
  },
  {
    id: "antarctica-part",
    bounds: [-180, -85, 180, -60],
    coordinates: [[[-180, -85], [180, -85], [180, -60], [-180, -85]]],
  },
];

const fixtureAssignments: readonly [string, ShardId][] = [
  ["world-basemap-part", "world-basemap"],
  ["north-america-part", "north-america"],
  ["south-america-part", "south-america"],
  ["europe-part", "europe"],
  ["africa-part", "africa"],
  ["asia-part", "asia"],
  ["oceania-major-part", "oceania-major"],
  ["antarctica-part", "antarctica"],
];

const hash = async (bytes: Uint8Array): Promise<ArtifactDigest> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(bytes).buffer,
  );
  const value = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  return value as ArtifactDigest;
};

const toParts = (): Result<readonly AtomicPart[], GenerationFailure> => {
  const parts = fixtureParts.map((part) =>
    asAtomicPartId(part.id).andThen((id) => asSourceFeatureId(part.id).map((sourceFeatureId) => ({ id, sourceFeatureId, bounds: part.bounds, coordinates: part.coordinates })))
  );
  const failure = parts.find((part) => part.isErr());

  return failure === undefined
    ? ok(parts.flatMap((part) => part._unsafeUnwrap()))
    : err(failure._unsafeUnwrapErr());
};

const toAssignments = (): Result<
  readonly ShardAssignment[],
  GenerationFailure
> => {
  const assignments = fixtureAssignments.map(([partId, shardId]) =>
    asAtomicPartId(partId).map((id) => ({ partId: id, shardId }))
  );
  const failure = assignments.find((assignment) => assignment.isErr());

  return failure === undefined
    ? ok(assignments.flatMap((assignment) => assignment._unsafeUnwrap()))
    : err(failure._unsafeUnwrapErr());
};

const toFeatureCollection = (
  parts: readonly AtomicPart[],
  assignments: readonly ShardAssignment[],
): string =>
  JSON.stringify({
    type: "FeatureCollection",
    features: parts.map((part) => ({
      type: "Feature",
      properties: {
        PART_ID: part.id,
        SHARD: assignments.find((assignment) => assignment.partId === part.id)
          ?.shardId,
      },
      geometry: { type: "Polygon", coordinates: part.coordinates },
    })),
  });

const isTopologyObject = (value: unknown): value is TopologyObject =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  "objects" in value &&
  value.type === "Topology" &&
  typeof value.objects === "object" &&
  value.objects !== null;

const describeArtifact = async (
  outputPath: string,
  shardId: ShardId,
  parts: readonly AtomicPart[],
  coverageBounds?: CoverageBounds,
): Promise<Result<ArtifactDescriptor, GenerationFailure>> => {
  const bytes = await Deno.readFile(outputPath);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const topology = isTopologyObject(parsed) ? parsed : undefined;
  const bounds = parts.reduce<readonly [number, number, number, number]>(
    (current, part) => [
      Math.min(current[0], part.bounds[0]),
      Math.min(current[1], part.bounds[1]),
      Math.max(current[2], part.bounds[2]),
      Math.max(current[3], part.bounds[3]),
    ],
    [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ],
  );

  return topology !== undefined && "land" in topology.objects
    ? ok({
      id: shardId,
      coverageBounds: coverageBounds ?? [bounds],
      objectName: "land",
      eager: shardId === "world-basemap",
      digest: await hash(bytes),
      url: `./${shardId}.topo.json`,
    })
    : err({
      kind: "invalid_topology",
      message: `${shardId} is not an independent land TopoJSON artifact.`,
    });
};

export const runPinnedMapshaper: MapshaperPort = async (
  inputPath,
  outputPath,
  shardId,
) => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      "npm:mapshaper@0.7.53",
      "-i",
      inputPath,
      "-filter",
      `SHARD == '${shardId}'`,
      "-dissolve",
      "-rename-layers",
      "land",
      "-o",
      "format=topojson",
      outputPath,
    ],
  });
  const output = await command.output();

  return output.success ? ok(undefined) : err({
    kind: "mapshaper_failed",
    message: new TextDecoder().decode(output.stderr).trim() ||
      `Mapshaper failed for ${shardId}.`,
  });
};

export const generateAssignedArtifacts = async (
  outputDirectory: string,
  release: WorldManifest["release"],
  parts: readonly AtomicPart[],
  assignments: readonly ShardAssignment[],
  mapshaper: MapshaperPort = runPinnedMapshaper,
  coverageByShard: Readonly<Partial<Record<ShardId, CoverageBounds>>> = {},
): Promise<Result<WorldManifest, GenerationFailure>> => {
  const assignmentsCheck = validateAssignments(parts, assignments);
  if (assignmentsCheck.isErr()) return err(assignmentsCheck.error);

  await Deno.mkdir(outputDirectory, { recursive: true });
  const temporaryDirectory = await Deno.makeTempDir({ prefix: "cloudmappr-mapshaper-" });
  const inputPath = `${temporaryDirectory}/source.geojson`;
  await Deno.writeTextFile(inputPath, toFeatureCollection(parts, assignmentsCheck.value));

  const generated = await Promise.all(
    shardIds.filter((shardId) => assignmentsCheck.value.some((assignment) => assignment.shardId === shardId)).map(async (shardId) => {
      const outputPath = `${outputDirectory}/${shardId}.topo.json`;
      const result = await mapshaper(inputPath, outputPath, shardId);

      return result.isErr() ? result : describeArtifact(outputPath, shardId, partsForShard(parts, assignmentsCheck.value, shardId), coverageByShard[shardId]);
    }),
  );
  const failure = generated.find((artifact) => artifact.isErr());
  if (failure !== undefined) return err(failure._unsafeUnwrapErr());

  const manifest = createManifest(
    release,
    generated.flatMap((artifact) => artifact.isOk() ? [artifact.value] : []),
  );
  if (manifest.isErr()) return err(manifest.error);

  await Deno.writeTextFile(`${outputDirectory}/manifest.json`, JSON.stringify(manifest.value));
  await Deno.remove(temporaryDirectory, { recursive: true });

  return manifest;
};

export const generateFixtureArtifacts = (
  outputDirectory: string,
  mapshaper: MapshaperPort = runPinnedMapshaper,
): Promise<Result<WorldManifest, GenerationFailure>> => {
  const partsResult = toParts();
  const assignmentsResult = toAssignments();
  const releaseResult = asReleaseIdentity("fixture-eight-shards-v1");

  if (partsResult.isErr()) return Promise.resolve(err(partsResult.error));
  if (assignmentsResult.isErr()) return Promise.resolve(err(assignmentsResult.error));
  if (releaseResult.isErr()) return Promise.resolve(err(releaseResult.error));

  return generateAssignedArtifacts(
    outputDirectory,
    releaseResult.value,
    partsResult.value,
    assignmentsResult.value,
    mapshaper,
  );
};

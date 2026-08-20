import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";

export const coreShardIds = [
  "world-basemap",
  "north-america",
  "south-america",
  "europe",
  "africa",
  "asia",
  "oceania-major",
  "antarctica",
] as const;

export const optionalShardIds = [
  "islands-arctic",
  "islands-epac",
  "islands-wpac",
  "islands-atlantic",
  "islands-indian",
  "islands-southern-ocean",
] as const;

export const shardIds = [...coreShardIds, ...optionalShardIds] as const;
export type CoreShardId = (typeof coreShardIds)[number];
export type OptionalShardId = (typeof optionalShardIds)[number];
export type ShardId = CoreShardId | OptionalShardId;
export type AtomicPartId = string & { readonly __brand: "AtomicPartId" };
export type SourceFeatureId = string & { readonly __brand: "SourceFeatureId" };
export type ReleaseIdentity = string & { readonly __brand: "ReleaseIdentity" };
export type ArtifactDigest = string & { readonly __brand: "ArtifactDigest" };
export type LonLatBounds = readonly [number, number, number, number];
export type CoverageBounds = readonly [LonLatBounds, ...LonLatBounds[]];
export type PolygonRing = readonly (readonly [number, number])[];

export type AtomicPart = Readonly<{
  readonly id: AtomicPartId;
  readonly sourceFeatureId: SourceFeatureId;
  readonly bounds: LonLatBounds;
  readonly coordinates: readonly PolygonRing[];
}>;

export type ShardAssignment = Readonly<{
  readonly partId: AtomicPartId;
  readonly shardId: ShardId;
}>;

export type ArtifactDescriptor = Readonly<{
  readonly id: ShardId;
  readonly coverageBounds: CoverageBounds;
  readonly objectName: "land";
  readonly eager: boolean;
  readonly digest: ArtifactDigest;
  readonly url: string;
}>;

export type WorldManifest = Readonly<{
  readonly format: 1 | 2;
  readonly release: ReleaseIdentity;
  readonly artifacts: readonly ArtifactDescriptor[];
}>;

export type GenerationFailure = Readonly<{
  readonly kind:
    | "blank_part_id"
    | "duplicate_assignment"
    | "missing_assignment"
    | "unknown_assignment"
    | "missing_shard"
    | "mapshaper_failed"
    | "artifact_io"
    | "invalid_topology";
  readonly message: string;
}>;

export const asAtomicPartId = (
  value: string,
): Result<AtomicPartId, GenerationFailure> =>
  value.trim().length === 0
    ? err({
      kind: "blank_part_id",
      message: "Atomic part IDs cannot be blank.",
    })
    : ok(value as AtomicPartId);

export const asSourceFeatureId = (
  value: string,
): Result<SourceFeatureId, GenerationFailure> =>
  value.trim().length === 0
    ? err({
      kind: "blank_part_id",
      message: "Source feature IDs cannot be blank.",
    })
    : ok(value as SourceFeatureId);

export const asReleaseIdentity = (
  value: string,
): Result<ReleaseIdentity, GenerationFailure> =>
  value.trim().length === 0
    ? err({
      kind: "artifact_io",
      message: "A release identity cannot be blank.",
    })
    : ok(value as ReleaseIdentity);

export const describeGenerationFailure = (failure: GenerationFailure): string =>
  match(failure.kind)
    .with("blank_part_id", () => "blank atomic part ID")
    .with("duplicate_assignment", () => "duplicate atomic part assignment")
    .with("missing_assignment", () => "missing atomic part assignment")
    .with("unknown_assignment", () => "assignment for an unknown atomic part")
    .with("missing_shard", () => "missing required shard")
    .with("mapshaper_failed", () => "Mapshaper command failure")
    .with("artifact_io", () => "artifact I/O failure")
    .with("invalid_topology", () => "invalid TopoJSON artifact")
    .exhaustive();

export const validateAssignments = (
  parts: readonly AtomicPart[],
  assignments: readonly ShardAssignment[],
): Result<readonly ShardAssignment[], GenerationFailure> => {
  const partIds = parts.map((part) => part.id);
  const assignmentIds = assignments.map((assignment) => assignment.partId);
  const duplicate = assignmentIds.find((partId, index) =>
    assignmentIds.indexOf(partId) !== index
  );
  const unknown = assignmentIds.find((partId) => !partIds.includes(partId));
  const missing = partIds.find((partId) => !assignmentIds.includes(partId));
  const absentShard = coreShardIds.find((shardId) =>
    !assignments.some((assignment) => assignment.shardId === shardId)
  );

  return duplicate === undefined
    ? unknown === undefined
      ? missing === undefined
        ? absentShard === undefined ? ok([...assignments]) : err({
          kind: "missing_shard",
          message: `Required shard ${absentShard} has no assigned part.`,
        })
        : err({
          kind: "missing_assignment",
          message: `Part ${missing} has no shard assignment.`,
        })
      : err({
        kind: "unknown_assignment",
        message: `Assignment references unknown part ${unknown}.`,
      })
    : err({
      kind: "duplicate_assignment",
      message: `Part ${duplicate} is assigned more than once.`,
    });
};

export const partsForShard = (
  parts: readonly AtomicPart[],
  assignments: readonly ShardAssignment[],
  shardId: ShardId,
): readonly AtomicPart[] => {
  const assignedIds = assignments
    .filter((assignment) => assignment.shardId === shardId)
    .map((assignment) => assignment.partId);

  return parts.filter((part) => assignedIds.includes(part.id));
};

export const createManifest = (
  release: ReleaseIdentity,
  artifacts: readonly ArtifactDescriptor[],
): Result<WorldManifest, GenerationFailure> => {
  const missingShard = coreShardIds.find((shardId) =>
    !artifacts.some((artifact) => artifact.id === shardId)
  );

  return missingShard === undefined
    ? ok({ format: 2, release, artifacts: [...artifacts] })
    : err({
      kind: "missing_shard",
      message: `Manifest is missing ${missingShard}.`,
    });
};

import { err, ok, type Result } from "neverthrow";
import type {
  ArtifactDescriptor,
  ArtifactDigest,
  CoverageBounds,
  LonLatBounds,
  ReleaseIdentity,
  ShardId,
  WorldManifest,
} from "./shards.ts";
import { coreShardIds, shardIds } from "./shards.ts";

export type ReleaseRef = string & { readonly __brand: "ReleaseRef" };
export type ManifestUrl = string & { readonly __brand: "ManifestUrl" };
export type ImmutableArtifactUrl = string & {
  readonly __brand: "ImmutableArtifactUrl";
};
export type ArtifactKey = string & { readonly __brand: "ArtifactKey" };

export type ReceiveFailure = Readonly<{
  readonly kind:
    | "unknown_release"
    | "malformed_manifest"
    | "mixed_release"
    | "rejected_url"
    | "digest_mismatch"
    | "transport"
    | "decode"
    | "state_conflict";
  readonly message: string;
}>;

export type ReceivedShard = Readonly<{
  readonly descriptor: ArtifactDescriptor;
  readonly landIds: readonly string[];
}>;

export type ReceiveState = Readonly<{
  readonly release?: ReleaseIdentity;
  readonly manifest?: WorldManifest;
  readonly shards: readonly ReceivedShard[];
}>;

export type ReceiveCommand =
  | Readonly<{ readonly kind: "load_manifest"; readonly release: ReleaseRef }>
  | Readonly<{
    readonly kind: "load_shard";
    readonly artifact: ArtifactDescriptor;
  }>;

export type ReceivePlan = Readonly<{
  readonly state: ReceiveState;
  readonly commands: readonly ReceiveCommand[];
}>;

const maxLongitude = 180;
const minLongitude = -180;

export const initialReceiveState = (): ReceiveState => ({ shards: [] });

export const asReleaseRef = (
  value: string,
): Result<ReleaseRef, ReceiveFailure> =>
  value.trim().length === 0 || value === "latest"
    ? err({
      kind: "unknown_release",
      message: "A receiver requires an explicit immutable release reference.",
    })
    : ok(value as ReleaseRef);

export const asManifestUrl = (
  value: string,
): Result<ManifestUrl, ReceiveFailure> =>
  (value.startsWith("./") && !value.includes("\\") && !value.includes("..")) ||
      (value.startsWith("https://") && !value.includes("@") &&
        !value.includes("#")) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value)
    ? ok(value as ManifestUrl)
    : err({
      kind: "rejected_url",
      message: "A manifest requires an approved immutable receiver URL.",
    });

const malformedManifest = (
  source: ManifestUrl,
  message: string,
): ReceiveFailure => ({
  kind: "malformed_manifest",
  message: `Manifest ${source}: ${message}`,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isShardId = (value: string): value is ShardId =>
  shardIds.some((shardId) => shardId === value);

const isBounds = (value: unknown): value is LonLatBounds =>
  Array.isArray(value) && value.length === 4 &&
  value.every((coordinate) =>
    typeof coordinate === "number" && Number.isFinite(coordinate)
  ) &&
  value[0] >= minLongitude && value[0] <= maxLongitude &&
  value[2] >= minLongitude && value[2] <= maxLongitude &&
  value[1] >= -90 && value[1] <= 90 && value[3] >= -90 && value[3] <= 90 &&
  value[1] <= value[3];

const isDigest = (value: string): value is ArtifactDigest =>
  /^[a-f0-9]{64}$/iu.test(value);

export const resolveArtifactUrl = (
  descriptor: ArtifactDescriptor,
): Result<ImmutableArtifactUrl, ReceiveFailure> => {
  const url = descriptor.url;
  const isRelative = url.startsWith("./") && !url.includes("\\") &&
    !url.includes("..");
  const isSafeAbsolute = url.startsWith("https://") && !url.includes("@") &&
    !url.includes("#");

  return isRelative || isSafeAbsolute ? ok(url as ImmutableArtifactUrl) : err({
    kind: "rejected_url",
    message:
      `Artifact ${descriptor.id} does not have an immutable receiver URL.`,
  });
};

const parseArtifact = (
  raw: unknown,
  source: ManifestUrl,
  format: 1 | 2,
): Result<ArtifactDescriptor, ReceiveFailure> => {
  if (!isRecord(raw)) {
    return err(malformedManifest(source, "an artifact entry must be an object."));
  }

  const { id, bounds, coverageBounds, objectName, eager, digest, url } = raw;
  const normalizedCoverage = format === 1 && isBounds(bounds)
    ? [bounds] as CoverageBounds
    : Array.isArray(coverageBounds) && coverageBounds.length > 0 &&
        coverageBounds.every(isBounds)
    ? coverageBounds as unknown as CoverageBounds
    : undefined;

  return typeof id !== "string" || !isShardId(id)
    ? err(malformedManifest(source, "an artifact has an unknown shard ID."))
    : normalizedCoverage === undefined
    ? err(malformedManifest(source, `Artifact ${id} has invalid coverage bounds.`))
    : objectName !== "land"
    ? err(malformedManifest(source, `Artifact ${id} must declare land.`))
    : typeof eager !== "boolean"
    ? err(malformedManifest(source, `Artifact ${id} must declare eager state.`))
    : typeof digest !== "string" || !isDigest(digest)
    ? err(malformedManifest(source, `Artifact ${id} has an invalid digest.`))
    : typeof url !== "string"
    ? err(malformedManifest(source, `Artifact ${id} has an invalid URL.`))
    : resolveArtifactUrl({ id, coverageBounds: normalizedCoverage, objectName, eager, digest, url }).map(
      () => ({ id, coverageBounds: normalizedCoverage, objectName, eager, digest, url }),
    );
};

export const parseManifest = (
  raw: unknown,
  source: ManifestUrl,
): Result<WorldManifest, ReceiveFailure> => {
  if (!isRecord(raw) || typeof raw.release !== "string" ||
    raw.release.trim().length === 0 || !Array.isArray(raw.artifacts)) {
    return err(malformedManifest(source, "release and artifacts are required."));
  }

  const format = raw.format === undefined ? 1 : raw.format === 2 ? 2 : undefined;
  if (format === undefined) {
    return err(malformedManifest(source, "has an unsupported format."));
  }
  const parsedArtifacts = raw.artifacts.map((artifact) =>
    parseArtifact(artifact, source, format)
  );
  const parseFailure = parsedArtifacts.find((artifact) => artifact.isErr());

  if (parseFailure?.isErr()) {
    return err(parseFailure.error);
  }

  const artifacts = parsedArtifacts.map((artifact) => artifact._unsafeUnwrap());
  const duplicateId = artifacts.find((artifact, index) =>
    artifacts.findIndex((candidate) => candidate.id === artifact.id) !== index
  );
  const missingId = coreShardIds.find((id) =>
    !artifacts.some((artifact) => artifact.id === id)
  );
  const eager = artifacts.filter((artifact) => artifact.eager);

  return duplicateId !== undefined
    ? err(malformedManifest(source, `Shard ${duplicateId.id} is duplicated.`))
    : missingId !== undefined
    ? err(malformedManifest(source, `Shard ${missingId} is missing.`))
    : eager.length !== 1 || eager[0]?.id !== "world-basemap"
    ? err(malformedManifest(source, "only world-basemap may be eager."))
    : ok({
      format,
      release: raw.release as ReleaseIdentity,
      artifacts,
    });
};

export const createArtifactKey = (
  descriptor: ArtifactDescriptor,
): Result<ArtifactKey, ReceiveFailure> =>
  resolveArtifactUrl(descriptor).map(
    (url) => `${url}#sha256=${descriptor.digest}` as ArtifactKey,
  );

const longitudeIntervals = (
  bounds: LonLatBounds,
): readonly (readonly [number, number])[] =>
  bounds[0] <= bounds[2]
    ? [[bounds[0], bounds[2]]]
    : [[bounds[0], maxLongitude], [minLongitude, bounds[2]]];

const overlaps = (
  first: readonly [number, number],
  second: readonly [number, number],
): boolean => first[0] <= second[1] && second[0] <= first[1];

const intersectsBounds = (
  artifact: LonLatBounds,
  requested: LonLatBounds,
): boolean =>
  artifact[1] <= requested[3] &&
  requested[1] <= artifact[3] &&
  longitudeIntervals(artifact).some((artifactInterval) =>
    longitudeIntervals(requested).some((requestedInterval) =>
      overlaps(artifactInterval, requestedInterval)
    )
  );

export const selectArtifacts = (
  manifest: WorldManifest,
  bounds: LonLatBounds,
): readonly ArtifactDescriptor[] =>
  manifest.artifacts.filter(
    (artifact) => artifact.eager || artifact.coverageBounds.some((coverage) => intersectsBounds(coverage, bounds)),
  );

export const reduceManifest = (
  state: ReceiveState,
  manifest: WorldManifest,
): Result<ReceiveState, ReceiveFailure> =>
  state.release === undefined || state.release === manifest.release
    ? ok({
      release: manifest.release,
      manifest,
      shards: [...state.shards],
    })
    : err({
      kind: "mixed_release",
      message:
        "A receiver cannot replace a loaded release with a different release.",
    });

const sameDescriptor = (
  first: ArtifactDescriptor,
  second: ArtifactDescriptor,
): boolean =>
  first.id === second.id &&
  first.url === second.url &&
  first.digest === second.digest;

export const reduceShard = (
  state: ReceiveState,
  shard: ReceivedShard,
): Result<ReceiveState, ReceiveFailure> => {
  const listed = state.manifest?.artifacts.find((artifact) =>
    artifact.id === shard.descriptor.id
  );
  const existing = state.shards.find((received) =>
    received.descriptor.id === shard.descriptor.id
  );

  return state.manifest === undefined
    ? err({
      kind: "state_conflict",
      message: "A shard cannot be reduced before its manifest is loaded.",
    })
    : listed === undefined || !sameDescriptor(listed, shard.descriptor)
    ? err({
      kind: "state_conflict",
      message:
        `Shard ${shard.descriptor.id} is not declared by the loaded manifest.`,
    })
    : existing !== undefined
    ? err({
      kind: "state_conflict",
      message:
        `Shard ${shard.descriptor.id} is already present in receiver state.`,
    })
    : ok({
      release: state.release,
      manifest: state.manifest,
      shards: [...state.shards, shard],
    });
};

const hasShard = (state: ReceiveState, artifact: ArtifactDescriptor): boolean =>
  state.shards.some((shard) =>
    shard.descriptor.id === artifact.id &&
    shard.descriptor.url === artifact.url &&
    shard.descriptor.digest === artifact.digest
  );

const matchesRelease = (
  identity: ReleaseIdentity,
  reference: ReleaseRef,
): boolean => identity === (reference as string);

export const planReceive = (
  state: ReceiveState,
  release: ReleaseRef,
  bounds: LonLatBounds,
): Result<ReceivePlan, ReceiveFailure> => {
  const loadedRelease = state.release;

  return loadedRelease !== undefined && !matchesRelease(loadedRelease, release)
    ? err({
      kind: "mixed_release",
      message:
        "The requested release differs from the receiver's loaded release.",
    })
    : state.manifest === undefined
    ? ok({
      state,
      commands: [{ kind: "load_manifest", release }],
    })
    : ok({
      state,
      commands: selectArtifacts(state.manifest, bounds)
        .filter((artifact) => !hasShard(state, artifact))
        .map((artifact) => ({ kind: "load_shard", artifact })),
    });
};

export const selectedShardIds = (
  state: ReceiveState,
): readonly ShardId[] =>
  state.manifest === undefined ? [] : state.manifest.artifacts
    .filter((artifact) =>
      state.shards.some((shard) => shard.descriptor.id === artifact.id)
    )
    .map((artifact) => artifact.id);

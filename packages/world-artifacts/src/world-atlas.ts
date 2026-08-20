import { geoBounds, geoCentroid } from "d3-geo";
import { err, ok, type Result } from "neverthrow";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-10m.json" with { type: "json" };
import defaultPolicyData from "../policies/world-atlas-10m-seeded-frontier-v3-southern-ocean.json" with { type: "json" };
import { generateAssignedArtifacts, type MapshaperPort, runPinnedMapshaper } from "./generation.ts";
import { auditCoastalAttachments, type CoastalAttachmentAudit } from "./coastal-attachment.ts";
import {
  type CorridorId,
  geodesicDistanceKm,
  partitionWorld,
  type PartitionFacts,
  type PartitionPolicy,
  type PartitionResult,
  type SourceRelease,
  validatePartitionPolicy,
} from "./partition.ts";
import {
  asAtomicPartId,
  asSourceFeatureId,
  asReleaseIdentity,
  type AtomicPart,
  type AtomicPartId,
  type CoverageBounds,
  type GenerationFailure,
  type LonLatBounds,
  type PolygonRing,
  optionalShardIds,
  partsForShard,
  type ReleaseIdentity,
  type ShardId,
  type WorldManifest,
} from "./shards.ts";

export const worldAtlasSource = "world-atlas@2.0.2/countries-10m" as SourceRelease;

export type WorldAtlasPolicyReport = Readonly<{
  readonly source: SourceRelease;
  readonly policyRevision: string;
  readonly sourcePartCount: number;
  readonly linkCount: number;
  readonly representativePoints: PartitionFacts["representativePoints"];
  readonly assignments: PartitionResult["explainedAssignments"];
}>;

export type WorldAtlasCoastalAttachmentReport = Readonly<{
  readonly source: SourceRelease;
  readonly policyRevision: string;
  readonly maximumDistanceKm: number;
  readonly residualPartCount: number;
  readonly decisions: readonly CoastalAttachmentAudit[];
}>;

export type WorldAtlasPostAttachmentReport = Readonly<{
  readonly source: SourceRelease;
  readonly policyRevision: string;
  readonly sourcePartCount: number;
  readonly residualPartCountBeforeAttachment: number;
  readonly attachedPartCount: number;
  readonly residualPartCount: number;
  readonly assignmentCounts: Readonly<Record<ShardId, number>>;
  readonly residualDiagnostics: Readonly<{ readonly indianWindow: number; readonly atlanticWindow: number; readonly northOf50: number; readonly other: number }>;
  readonly assignments: PartitionResult["explainedAssignments"];
}>;

type Coordinate = readonly [number, number];
type PartPoint = Readonly<{ readonly part: AtomicPart; readonly point: Coordinate }>;
type EdgeEntry = Readonly<{ readonly edge: string; readonly partId: AtomicPartId }>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const generationFailure = (message: string): GenerationFailure => ({ kind: "invalid_topology", message });

const sourceFeatures = (): Result<readonly Readonly<Record<string, unknown>>[], GenerationFailure> => {
  const objects = (atlas as Readonly<{ readonly objects?: Readonly<Record<string, unknown>> }>).objects;
  const countries = objects?.countries;
  const decoded = countries === undefined ? undefined : feature(atlas as never, countries as never) as unknown;
  return isRecord(decoded) && Array.isArray(decoded.features) && decoded.features.every(isRecord)
    ? ok(decoded.features)
    : err(generationFailure("World Atlas 10m countries source could not be decoded."));
};

const splitFeature = (source: Readonly<Record<string, unknown>>): readonly Readonly<Record<string, unknown>>[] => {
  const geometry = source.geometry;
  const id = source.id;
  return !isRecord(geometry) || typeof id !== "string" && typeof id !== "number"
    ? []
    : geometry.type === "Polygon" && Array.isArray(geometry.coordinates)
    ? [{ id: String(id), sourceFeatureId: String(id), geometry }]
    : geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
    ? geometry.coordinates.map((coordinates, index) => ({ id: `${id}:${index}`, sourceFeatureId: String(id), geometry: { type: "Polygon", coordinates } }))
    : [];
};

const asAtomicPart = (source: Readonly<Record<string, unknown>>): Result<AtomicPart, GenerationFailure> => {
  const geometry = source.geometry;
  if (typeof source.id !== "string" || typeof source.sourceFeatureId !== "string" || !isRecord(geometry) || !Array.isArray(geometry.coordinates)) return err(generationFailure("World Atlas 10m atomic part is malformed."));
  const bounds = geoBounds({ type: "Feature", geometry } as never);
  return asAtomicPartId(source.id).andThen((id) => asSourceFeatureId(source.sourceFeatureId as string).map((sourceFeatureId) => ({
    id,
    sourceFeatureId,
    bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]] as LonLatBounds,
    coordinates: geometry.coordinates as PolygonRing[],
  })));
};

export const worldAtlasAtomicParts = (): Result<readonly AtomicPart[], GenerationFailure> => {
  const features = sourceFeatures();
  if (features.isErr()) return err(features.error);
  const results = features.value.flatMap(splitFeature).map(asAtomicPart);
  const failure = results.find((part) => part.isErr());
  return failure === undefined ? ok(results.map((part) => part._unsafeUnwrap()).toSorted((left, right) => left.id.localeCompare(right.id))) : err(failure.error);
};

const representativePoint = (part: AtomicPart): Coordinate => {
  const centroid = geoCentroid({ type: "Feature", geometry: { type: "Polygon", coordinates: part.coordinates } } as never);
  return [centroid[0], centroid[1]];
};

const coordinateKey = ([longitude, latitude]: Coordinate): string => `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
const edgeKey = (left: Coordinate, right: Coordinate): string => [coordinateKey(left), coordinateKey(right)].toSorted().join("|");

const edgeEntries = (part: AtomicPart): readonly EdgeEntry[] =>
  part.coordinates.flatMap((ring) => ring.slice(1).flatMap((coordinate, index) => {
    const previous = ring[index];
    return previous === undefined ? [] : [{ edge: edgeKey(previous, coordinate), partId: part.id }];
  }));

const pairKey = (left: AtomicPartId, right: AtomicPartId): string => [left, right].toSorted().join("|");
const orderedPair = (left: AtomicPartId, right: AtomicPartId): Readonly<{ readonly left: AtomicPartId; readonly right: AtomicPartId }> =>
  left.localeCompare(right) <= 0 ? { left, right } : { left: right, right: left };

const topologyLinks = (
  parts: readonly AtomicPart[],
  points: Readonly<Record<AtomicPartId, Coordinate>>,
): readonly Readonly<{ readonly left: AtomicPartId; readonly right: AtomicPartId; readonly kind: "adjacency"; readonly distanceKm: number }>[] => {
  const groups = Object.groupBy(parts.flatMap(edgeEntries), (entry) => entry.edge);
  const pairs = Object.values(groups).flatMap((entries) => entries === undefined
    ? []
    : entries.flatMap((left, index) => entries.slice(index + 1)
      .filter((right) => left.partId !== right.partId)
      .map((right) => orderedPair(left.partId, right.partId))));
  const unique = Object.groupBy(pairs, (pair) => pairKey(pair.left, pair.right));
  return Object.values(unique).flatMap((entries) => {
    const pair = entries?.[0];
    const left = pair === undefined ? undefined : points[pair.left];
    const right = pair === undefined ? undefined : points[pair.right];
    return pair === undefined || left === undefined || right === undefined ? [] : [{ ...pair, kind: "adjacency" as const, distanceKm: geodesicDistanceKm(left, right) }];
  });
};

const cellSizeDegrees = 8;
const gridKey = ([longitude, latitude]: Coordinate): string => `${Math.floor((longitude + 180) / cellSizeDegrees)}:${Math.floor((latitude + 90) / cellSizeDegrees)}`;
const neighbourOffsets = [-2, -1, 0, 1, 2] as const;
const neighbouringKeys = ([longitude, latitude]: Coordinate): readonly string[] => {
  const longitudeCell = Math.floor((longitude + 180) / cellSizeDegrees);
  const latitudeCell = Math.floor((latitude + 90) / cellSizeDegrees);
  return neighbourOffsets.flatMap((longitudeOffset) => neighbourOffsets.map((latitudeOffset) => `${longitudeCell + longitudeOffset}:${latitudeCell + latitudeOffset}`));
};

const sampledBoundary = (part: AtomicPart): readonly Coordinate[] => {
  const vertices = part.coordinates.flatMap((ring) => ring.map((coordinate) => [coordinate[0], coordinate[1]] as Coordinate));
  const step = Math.max(1, Math.ceil(vertices.length / 32));
  return vertices.filter((_, index) => index % step === 0).slice(0, 32);
};

// The frontier metric is deliberately bounded: a deterministic 32-vertex sample
// gives a reproducible geodesic boundary-gap approximation for island links,
// while exact shared topology remains the adjacency relation for mainland land.
const sampledBoundaryDistanceKm = (left: AtomicPart, right: AtomicPart): number =>
  sampledBoundary(left).flatMap((leftPoint) => sampledBoundary(right).map((rightPoint) => geodesicDistanceKm(leftPoint, rightPoint))).reduce((minimum, distance) => Math.min(minimum, distance), Number.POSITIVE_INFINITY);

const shortWaterLinks = (points: readonly PartPoint[]): readonly Readonly<{ readonly left: AtomicPartId; readonly right: AtomicPartId; readonly kind: "frontier"; readonly distanceKm: number }>[] => {
  const cells = Object.groupBy(points, (entry) => gridKey(entry.point));
  const pairs = points.flatMap((left) => neighbouringKeys(left.point).flatMap((key) => (cells[key] ?? [])
    .filter((right) => left.part.id !== right.part.id)
    .map((right) => ({ left, right, centreDistanceKm: geodesicDistanceKm(left.point, right.point) }))));
  const nearPairs = pairs.filter((pair) => pair.centreDistanceKm <= 1_000);
  const nearest = Object.values(Object.groupBy(nearPairs, (pair) => pair.left.part.id)).flatMap((entries) => {
    const first = entries?.toSorted((left, right) => left.centreDistanceKm - right.centreDistanceKm || left.right.part.id.localeCompare(right.right.part.id))[0];
    return first === undefined ? [] : [first];
  });
  const unique = Object.groupBy(nearest
    .map((pair) => ({ ...orderedPair(pair.left.part.id, pair.right.part.id), distanceKm: sampledBoundaryDistanceKm(pair.left.part, pair.right.part) }))
    .filter((pair) => pair.distanceKm <= 650), (pair) => pairKey(pair.left, pair.right));
  return Object.values(unique).flatMap((entries) => entries === undefined || entries[0] === undefined ? [] : [{ ...entries[0], kind: "frontier" as const }]);
};

const orientation = (first: Coordinate, second: Coordinate, third: Coordinate): number =>
  (second[0] - first[0]) * (third[1] - first[1]) - (second[1] - first[1]) * (third[0] - first[0]);

const segmentsIntersect = (firstStart: Coordinate, firstEnd: Coordinate, secondStart: Coordinate, secondEnd: Coordinate): boolean => {
  const first = orientation(firstStart, firstEnd, secondStart);
  const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart);
  const fourth = orientation(secondStart, secondEnd, firstEnd);
  return first * second <= 0 && third * fourth <= 0;
};

const lineHitsBounds = (left: Coordinate, right: Coordinate, [west, south, east, north]: readonly [number, number, number, number]): boolean =>
  (left[0] >= west && left[0] <= east && left[1] >= south && left[1] <= north) ||
  (right[0] >= west && right[0] <= east && right[1] >= south && right[1] <= north) ||
  (segmentsIntersect(left, right, [west, south], [east, south]) ||
    segmentsIntersect(left, right, [east, south], [east, north]) ||
    segmentsIntersect(left, right, [east, north], [west, north]) ||
    segmentsIntersect(left, right, [west, north], [west, south]));

const blockedBy = (policy: PartitionPolicy, left: Coordinate, right: Coordinate): readonly CorridorId[] =>
  policy.corridors.filter((corridor) => lineHitsBounds(left, right, corridor.bounds)).map((corridor) => corridor.id);

export const worldAtlasPartitionFacts = (policy: PartitionPolicy): Result<PartitionFacts, GenerationFailure> =>
  worldAtlasAtomicParts().map((parts) => {
    const points = parts.map((part) => ({ part, point: representativePoint(part) }));
    const pointById = Object.fromEntries(points.map(({ part, point }) => [part.id, point])) as Readonly<Record<AtomicPartId, Coordinate>>;
    const allLinks = [...topologyLinks(parts, pointById), ...shortWaterLinks(points)];
    const uniqueLinks = Object.groupBy(allLinks, (link) => pairKey(link.left, link.right));
    return {
      source: worldAtlasSource,
      parts,
      representativePoints: pointById,
      links: Object.values(uniqueLinks).flatMap((entries) => {
        const link = entries?.toSorted((left, right) => left.distanceKm - right.distanceKm)[0];
        const left = link === undefined ? undefined : pointById[link.left];
        const right = link === undefined ? undefined : pointById[link.right];
        return link === undefined || left === undefined || right === undefined ? [] : [{ ...link, blockedBy: blockedBy(policy, left, right) }];
      }),
    };
  });

export const worldAtlasDefaultPolicy = defaultPolicyData as unknown as PartitionPolicy;

const policyInput = (input: unknown): Result<PartitionPolicy, GenerationFailure> => {
  if (!isRecord(input) || input.source !== worldAtlasSource || typeof input.revision !== "string" || !Array.isArray(input.regions) || !Array.isArray(input.corridors) || !Array.isArray(input.geographicRules) || !Array.isArray(input.residualRules) || !Array.isArray(input.exceptions)) return err({ kind: "artifact_io", message: "World Atlas release requires a complete 10m partition policy." });
  const policy = input as PartitionPolicy;
  const validated = validatePartitionPolicy(policy);
  return validated.isErr() ? err({ kind: "artifact_io", message: validated.error.message }) : ok(validated.value);
};

export const parseWorldAtlasPartitionPolicy = (input: unknown): Result<PartitionPolicy, GenerationFailure> => policyInput(input);

export const createWorldAtlasPolicyReport = (policy: PartitionPolicy = worldAtlasDefaultPolicy): Result<WorldAtlasPolicyReport, GenerationFailure> => {
  const validated = validatePartitionPolicy(policy);
  if (validated.isErr()) return err({ kind: "artifact_io", message: validated.error.message });
  const facts = worldAtlasPartitionFacts(validated.value);
  if (facts.isErr()) return err(facts.error);
  const partition = partitionWorld(validated.value, facts.value);
  return partition.isErr()
    ? err({ kind: "artifact_io", message: partition.error.message })
    : ok({ source: worldAtlasSource, policyRevision: policy.revision, sourcePartCount: facts.value.parts.length, linkCount: facts.value.links.length, representativePoints: facts.value.representativePoints, assignments: partition.value.explainedAssignments });
};

export const createWorldAtlasCoastalAttachmentReport = (
  policy: PartitionPolicy,
  maximumDistanceKm: number,
): Result<WorldAtlasCoastalAttachmentReport, GenerationFailure> => {
  if (!Number.isFinite(maximumDistanceKm) || maximumDistanceKm < 0) return err({ kind: "artifact_io", message: "Coastal attachment distance must be finite and non-negative." });
  const facts = worldAtlasPartitionFacts(policy);
  if (facts.isErr()) return err(facts.error);
  const partition = partitionWorld(policy, facts.value);
  return partition.isErr()
    ? err({ kind: "artifact_io", message: partition.error.message })
    : ok({
      source: worldAtlasSource,
      policyRevision: policy.revision,
      maximumDistanceKm,
      residualPartCount: partition.value.explainedAssignments.filter((assignment) => assignment.shardId === "world-basemap").length,
      decisions: auditCoastalAttachments({ maximumDistanceKm }, facts.value, partition.value.explainedAssignments),
    });
};

const residualDiagnosticGroup = ([longitude, latitude]: readonly [number, number]): "indianWindow" | "atlanticWindow" | "northOf50" | "other" =>
  longitude >= 20 && longitude <= 120 && latitude >= -50 && latitude <= 50
    ? "indianWindow"
    : longitude >= -80 && longitude <= 20 && latitude >= -50 && latitude <= 60
    ? "atlanticWindow"
    : latitude >= 50
    ? "northOf50"
    : "other";

export const createWorldAtlasPostAttachmentReport = (policy: PartitionPolicy): Result<WorldAtlasPostAttachmentReport, GenerationFailure> => {
  if (policy.coastalAttachment === undefined) return err({ kind: "artifact_io", message: "Post-attachment reporting requires a coastal attachment policy." });
  const facts = worldAtlasPartitionFacts(policy);
  if (facts.isErr()) return err(facts.error);
  const before = partitionWorld({ ...policy, coastalAttachment: undefined }, facts.value);
  const after = partitionWorld(policy, facts.value);
  if (before.isErr()) return err({ kind: "artifact_io", message: before.error.message });
  if (after.isErr()) return err({ kind: "artifact_io", message: after.error.message });
  const decisions = auditCoastalAttachments(policy.coastalAttachment, facts.value, before.value.explainedAssignments);
  const assignmentCounts = after.value.explainedAssignments.reduce<Readonly<Record<string, number>>>(
    (counts, assignment) => ({ ...counts, [assignment.shardId]: (counts[assignment.shardId] ?? 0) + 1 }),
    {},
  ) as Readonly<Record<ShardId, number>>;
  const residualDiagnostics = after.value.explainedAssignments
    .filter((assignment) => assignment.shardId === "world-basemap")
    .reduce<WorldAtlasPostAttachmentReport["residualDiagnostics"]>((counts, assignment) => {
      const point = facts.value.representativePoints[assignment.partId];
      const group = point === undefined ? "other" : residualDiagnosticGroup(point);
      return { ...counts, [group]: counts[group] + 1 };
    }, { indianWindow: 0, atlanticWindow: 0, northOf50: 0, other: 0 });
  return ok({
    source: worldAtlasSource,
    policyRevision: policy.revision,
    sourcePartCount: facts.value.parts.length,
    residualPartCountBeforeAttachment: before.value.explainedAssignments.filter((assignment) => assignment.shardId === "world-basemap").length,
    attachedPartCount: decisions.filter((decision) => decision.decision.kind === "attachable").length,
    residualPartCount: after.value.explainedAssignments.filter((assignment) => assignment.shardId === "world-basemap").length,
    assignmentCounts,
    residualDiagnostics,
    assignments: after.value.explainedAssignments,
  });
};

const sourceDigest = async (): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(atlas));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const coverageForPart = (part: AtomicPart): CoverageBounds => {
  const longitudes = part.coordinates.flatMap((ring) => ring.map((coordinate) => (coordinate[0] + 360) % 360)).toSorted((left, right) => left - right);
  const latitudes = part.coordinates.flatMap((ring) => ring.map((coordinate) => coordinate[1]));
  const gaps = longitudes.map((longitude, index) => ({
    index,
    gap: (longitudes[index + 1] ?? (longitudes[0] ?? longitude) + 360) - longitude,
  }));
  const largestGap = gaps.toSorted((left, right) => right.gap - left.gap || left.index - right.index)[0];
  const start = longitudes[((largestGap?.index ?? 0) + 1) % longitudes.length] ?? 0;
  const end = longitudes[largestGap?.index ?? 0] ?? 0;
  const west = start > 180 ? start - 360 : start;
  const east = end > 180 ? end - 360 : end;
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  return west <= east ? [[west, south, east, north]] : [[west, south, 180, north], [-180, south, east, north]];
};

const optionalCoverage = (
  parts: readonly AtomicPart[],
  assignments: PartitionResult["assignments"],
): Readonly<Partial<Record<ShardId, CoverageBounds>>> =>
  Object.fromEntries(optionalShardIds.flatMap((shardId) => {
    const assigned = partsForShard(parts, assignments, shardId);
    const coverage = assigned.flatMap((part) => coverageForPart(part));
    return coverage.length === 0 ? [] : [[shardId, coverage as unknown as CoverageBounds]];
  }));

export const worldAtlasReleaseIdentity = async (
  policy: PartitionPolicy,
): Promise<Result<ReleaseIdentity, GenerationFailure>> =>
  asReleaseIdentity(`world-atlas-2.0.2-10m-${policy.revision}-${(await sourceDigest()).slice(0, 12)}`);

export const generateWorldAtlasRelease = async (
  outputDirectory: string,
  input: unknown = worldAtlasDefaultPolicy,
  mapshaper: MapshaperPort = runPinnedMapshaper,
): Promise<Result<WorldManifest, GenerationFailure>> => {
  const policy = policyInput(input);
  if (policy.isErr()) return err(policy.error);
  const facts = worldAtlasPartitionFacts(policy.value);
  if (facts.isErr()) return err(facts.error);
  const partition = partitionWorld(policy.value, facts.value);
  if (partition.isErr()) return err({ kind: "artifact_io", message: partition.error.message });
  const digest = await sourceDigest();
  const release = await worldAtlasReleaseIdentity(policy.value);
  if (release.isErr()) return err(release.error);
  const coverageByShard = optionalCoverage(facts.value.parts, partition.value.assignments);
  const generated = await generateAssignedArtifacts(outputDirectory, release.value, facts.value.parts, partition.value.assignments, mapshaper, coverageByShard);
  if (generated.isErr()) return err(generated.error);
  await Deno.writeTextFile(`${outputDirectory}/provenance.json`, JSON.stringify({
    source: worldAtlasSource,
    retrieval: "npm package pinned in package.json",
    attribution: "Natural Earth via World Atlas; see World Atlas package metadata",
    sourceDigest: digest,
    mapshaper: "0.7.53",
    partitionPolicyRevision: policy.value.revision,
    policy: policy.value,
    assignments: partition.value.explainedAssignments,
    manifestRelease: generated.value.release,
  }));
  return ok(generated.value);
};

import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";
import type { AtomicPart, AtomicPartId, CoverageBounds, OptionalShardId, ShardAssignment, ShardId, SourceFeatureId } from "./shards.ts";

export type RegionId = Exclude<ShardId, "world-basemap" | OptionalShardId>;
export type PolicyRuleId = string & { readonly __brand: "PolicyRuleId" };
export type CorridorId = string & { readonly __brand: "CorridorId" };
export type SourceRelease = string & { readonly __brand: "SourceRelease" };
export type LongitudeLatitude = readonly [longitude: number, latitude: number];

export type RegionPolicy = Readonly<{
  readonly id: RegionId;
  readonly seed: LongitudeLatitude;
  readonly priority: number;
  readonly maxSeedDistanceKm: number;
  readonly maxFrontierGapKm: number;
}>;

type GeographicBounds = readonly [west: number, south: number, east: number, north: number];

export type GeographicRule =
  | Readonly<{
  readonly id: PolicyRuleId;
  readonly kind: "force-shard-in-bounds";
  readonly shardId: ShardId;
  readonly bounds: GeographicBounds;
}>
  | Readonly<{
    readonly id: PolicyRuleId;
    readonly kind: "force-shard-for-parts";
    readonly shardId: ShardId;
    readonly partIds: readonly AtomicPartId[];
  }>;

export type Corridor = Readonly<{
  readonly id: CorridorId;
  readonly bounds: readonly [west: number, south: number, east: number, north: number];
}>;

export type ExplicitException = Readonly<{
  readonly partId: AtomicPartId;
  readonly shardId: ShardId;
  readonly rationale: string;
  readonly reviewer: string;
  readonly governingRuleId: PolicyRuleId;
}>;

export type ResidualRule = Readonly<{
  readonly id: PolicyRuleId;
  readonly shardId: OptionalShardId;
  readonly priority: number;
  readonly coverageBounds: CoverageBounds;
  readonly minimumMajorLandDistanceKm: number;
}>;

export type CoastalAttachmentPolicy = Readonly<{
  readonly id: PolicyRuleId;
  readonly maximumDistanceKm: number;
}>;

export type PartitionPolicy = Readonly<{
  readonly source: SourceRelease;
  readonly revision: string;
  readonly regions: readonly RegionPolicy[];
  readonly corridors: readonly Corridor[];
  readonly geographicRules: readonly GeographicRule[];
  readonly coastalAttachment?: CoastalAttachmentPolicy;
  readonly residualRules: readonly ResidualRule[];
  readonly exceptions: readonly ExplicitException[];
}>;

export type FrontierLink = Readonly<{
  readonly left: AtomicPartId;
  readonly right: AtomicPartId;
  readonly kind: "adjacency" | "frontier";
  readonly distanceKm: number;
  readonly blockedBy: readonly CorridorId[];
}>;

export type PartitionFacts = Readonly<{
  readonly source: SourceRelease;
  readonly parts: readonly AtomicPart[];
  readonly representativePoints: Readonly<Record<AtomicPartId, LongitudeLatitude>>;
  readonly links: readonly FrontierLink[];
}>;

export type PartitionExplanation =
  | Readonly<{ readonly kind: "explicit-exception"; readonly ruleId: PolicyRuleId }>
  | Readonly<{ readonly kind: "geographic-rule"; readonly ruleId: PolicyRuleId }>
  | Readonly<{ readonly kind: "seed-path"; readonly region: RegionId; readonly costKm: number }>
  | Readonly<{ readonly kind: "coastal-attachment"; readonly ruleId: PolicyRuleId; readonly candidatePartId: AtomicPartId; readonly distanceKm: number }>
  | Readonly<{ readonly kind: "residual-rule"; readonly ruleId: PolicyRuleId }>
  | Readonly<{ readonly kind: "residual-basemap" }>;

export type ExplainedAssignment = Readonly<{
  readonly partId: AtomicPartId;
  readonly shardId: ShardId;
  readonly explanation: PartitionExplanation;
}>;

export type PartitionResult = Readonly<{
  readonly assignments: readonly ShardAssignment[];
  readonly explainedAssignments: readonly ExplainedAssignment[];
}>;

export type PartitionFailure = Readonly<{
  readonly kind:
    | "source_mismatch"
    | "invalid_policy"
    | "invalid_facts"
    | "unknown_exception_part"
    | "duplicate_exception"
    | "stale_exception"
    | "unassigned_part";
  readonly message: string;
}>;

type Candidate = Readonly<{
  readonly partId: AtomicPartId;
  readonly region: RegionPolicy;
  readonly costKm: number;
}>;

type SeedWinner = Readonly<Record<AtomicPartId, Candidate>>;
type ExpansionState = Readonly<{ readonly candidates: readonly Candidate[]; readonly winners: SeedWinner }>;
export type CoastalAttachmentDecision =
  | Readonly<{ readonly kind: "attachable"; readonly shardId: RegionId; readonly distanceKm: number; readonly candidatePartId: AtomicPartId }>
  | Readonly<{ readonly kind: "no-same-territory-major" }>
  | Readonly<{ readonly kind: "ambiguous-major-shard"; readonly candidatePartIds: readonly AtomicPartId[]; readonly distanceKm: number }>
  | Readonly<{ readonly kind: "corridor-blocked"; readonly candidatePartId: AtomicPartId; readonly distanceKm: number; readonly corridorIds: readonly string[] }>
  | Readonly<{ readonly kind: "too-distant"; readonly candidatePartId: AtomicPartId; readonly shardId: RegionId; readonly distanceKm: number; readonly maximumDistanceKm: number }>;

export type CoastalAttachmentAudit = Readonly<{
  readonly partId: AtomicPartId;
  readonly sourceFeatureId: SourceFeatureId;
  readonly decision: CoastalAttachmentDecision;
}>;

type MajorCandidate = Readonly<{ readonly part: AtomicPart; readonly shardId: RegionId; readonly distanceKm: number }>;

const canonicalPartIds = (parts: readonly AtomicPart[]): readonly AtomicPartId[] =>
  [...parts].map((part) => part.id).toSorted();

const isFiniteCoordinate = ([longitude, latitude]: LongitudeLatitude): boolean =>
  Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;

const isRegionId = (value: ShardId): value is RegionId => value !== "world-basemap" && !value.startsWith("islands-");

const inside = (
  [longitude, latitude]: LongitudeLatitude,
  [west, south, east, north]: GeographicBounds,
): boolean => longitude >= west && longitude <= east && latitude >= south && latitude <= north;

const insideCoverage = (point: LongitudeLatitude, coverage: CoverageBounds): boolean =>
  coverage.some((bounds) => inside(point, bounds));

const earthRadiusKm = 6371.0088;
const radians = (degrees: number): number => degrees * Math.PI / 180;

export const geodesicDistanceKm = (left: LongitudeLatitude, right: LongitudeLatitude): number => {
  const latitudeDelta = radians(right[1] - left[1]);
  const longitudeDelta = radians(right[0] - left[0]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(left[1])) * Math.cos(radians(right[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const policyFailure = <Value>(message: string): Result<Value, PartitionFailure> => err({ kind: "invalid_policy", message });

export const validatePartitionPolicy = (policy: PartitionPolicy): Result<PartitionPolicy, PartitionFailure> => {
  const regionIds = policy.regions.map((region) => region.id);
  const ruleIds = policy.geographicRules.map((rule) => rule.id);
  const residualRuleIds = policy.residualRules.map((rule) => rule.id);
  const corridorIds = policy.corridors.map((corridor) => corridor.id);
  const exceptionIds = policy.exceptions.map((exception) => exception.partId);
  const invalidRegion = policy.regions.find((region) => !isRegionId(region.id) || !isFiniteCoordinate(region.seed) || !Number.isFinite(region.priority) || region.maxSeedDistanceKm <= 0 || region.maxFrontierGapKm < 0);
  const invalidRule = policy.geographicRules.find((rule) => rule.id.trim().length === 0 ||
    (rule.kind === "force-shard-in-bounds" && (rule.bounds.some((coordinate) => !Number.isFinite(coordinate)) || rule.bounds[0] > rule.bounds[2] || rule.bounds[1] > rule.bounds[3])) ||
    (rule.kind === "force-shard-for-parts" && (rule.partIds.length === 0 || new Set(rule.partIds).size !== rule.partIds.length)));
  const invalidCorridor = policy.corridors.find((corridor) => corridor.id.trim().length === 0 || corridor.bounds.some((coordinate) => !Number.isFinite(coordinate)) || corridor.bounds[0] > corridor.bounds[2] || corridor.bounds[1] > corridor.bounds[3]);
  const invalidException = policy.exceptions.find((exception) => exception.rationale.trim().length === 0 || exception.reviewer.trim().length === 0 || exception.governingRuleId.trim().length === 0);
  const invalidResidualRule = policy.residualRules.find((rule) => rule.id.trim().length === 0 || !Number.isFinite(rule.priority) || !Number.isFinite(rule.minimumMajorLandDistanceKm) || rule.minimumMajorLandDistanceKm < 0 || rule.coverageBounds.length === 0 || rule.coverageBounds.some((bounds) => bounds.some((coordinate) => !Number.isFinite(coordinate)) || bounds[1] > bounds[3]));
  const invalidCoastalAttachment = policy.coastalAttachment !== undefined &&
    (policy.coastalAttachment.id.trim().length === 0 || !Number.isFinite(policy.coastalAttachment.maximumDistanceKm) || policy.coastalAttachment.maximumDistanceKm < 0);
  return policy.source.trim().length === 0 || policy.revision.trim().length === 0
    ? policyFailure("Partition policy source and revision must be present.")
    : policy.regions.length !== 7
    ? policyFailure("Partition policy must declare exactly seven regional seeds.")
    : new Set(regionIds).size !== regionIds.length
    ? policyFailure("Partition policy has duplicate regional seed IDs.")
    : new Set(ruleIds).size !== ruleIds.length
    ? policyFailure("Partition policy has duplicate geographic rule IDs.")
    : new Set([...ruleIds, ...residualRuleIds]).size !== ruleIds.length + residualRuleIds.length
    ? policyFailure("Partition policy has duplicate geographic or residual rule IDs.")
    : new Set(corridorIds).size !== corridorIds.length
    ? policyFailure("Partition policy has duplicate corridor IDs.")
    : new Set(exceptionIds).size !== exceptionIds.length
    ? policyFailure("Partition policy has duplicate explicit exceptions.")
    : invalidRegion !== undefined
    ? policyFailure(`Partition policy has an invalid region ${invalidRegion.id}.`)
    : invalidRule !== undefined
    ? policyFailure(`Partition policy has an invalid geographic rule ${invalidRule.id}.`)
    : invalidCorridor !== undefined
    ? policyFailure(`Partition policy has an invalid corridor ${invalidCorridor.id}.`)
    : invalidException !== undefined
    ? policyFailure(`Partition policy has an invalid exception ${invalidException.partId}.`)
    : invalidResidualRule !== undefined
    ? policyFailure(`Partition policy has an invalid residual rule ${invalidResidualRule.id}.`)
    : invalidCoastalAttachment
    ? policyFailure("Partition policy has an invalid coastal attachment rule.")
    : ok(policy);
};

const validateFacts = (facts: PartitionFacts): Result<PartitionFacts, PartitionFailure> => {
  const ids = canonicalPartIds(facts.parts);
  const invalidPoint = ids.find((id) => {
    const point = facts.representativePoints[id];
    return point === undefined || !isFiniteCoordinate(point);
  });
  const invalidLink = facts.links.find((link) => link.left === link.right || !ids.includes(link.left) || !ids.includes(link.right) || !Number.isFinite(link.distanceKm) || link.distanceKm < 0);
  return new Set(ids).size !== ids.length
    ? err({ kind: "invalid_facts", message: "Partition facts have duplicate atomic part IDs." })
    : invalidPoint !== undefined
    ? err({ kind: "invalid_facts", message: `Partition facts have no valid representative point for ${invalidPoint}.` })
    : invalidLink !== undefined
    ? err({ kind: "invalid_facts", message: `Partition facts have an invalid frontier link ${invalidLink.left}:${invalidLink.right}.` })
    : ok(facts);
};

const compareCandidate = (left: Candidate, right: Candidate): number =>
  left.costKm - right.costKm || left.region.priority - right.region.priority || left.partId.localeCompare(right.partId) || left.region.id.localeCompare(right.region.id);

const allowedLinks = (facts: PartitionFacts): readonly FrontierLink[] =>
  facts.links.filter((link) => link.blockedBy.length === 0);

const neighboursOf = (links: readonly FrontierLink[], partId: AtomicPartId): readonly Readonly<{ readonly partId: AtomicPartId; readonly kind: FrontierLink["kind"]; readonly distanceKm: number }>[] =>
  links.flatMap((link) => link.left === partId ? [{ partId: link.right, kind: link.kind, distanceKm: link.distanceKm }] : link.right === partId ? [{ partId: link.left, kind: link.kind, distanceKm: link.distanceKm }] : []);

const equivalentDistance = (left: number, right: number): boolean => Math.abs(left - right) < 0.000001;
const pairMatches = (left: AtomicPartId, right: AtomicPartId, link: FrontierLink): boolean =>
  (link.left === left && link.right === right) || (link.left === right && link.right === left);

export const auditCoastalAttachments = (
  policy: Pick<CoastalAttachmentPolicy, "maximumDistanceKm">,
  facts: PartitionFacts,
  assignments: readonly ExplainedAssignment[],
): readonly CoastalAttachmentAudit[] => {
  const assignmentByPart = Object.fromEntries(assignments.map((assignment) => [assignment.partId, assignment])) as Readonly<Record<AtomicPartId, ExplainedAssignment>>;
  return facts.parts
    .filter((part) => assignmentByPart[part.id]?.shardId === "world-basemap")
    .toSorted((left, right) => left.id.localeCompare(right.id))
    .map((part) => {
      const point = facts.representativePoints[part.id];
      const candidates: readonly MajorCandidate[] = point === undefined ? [] : facts.parts
        .filter((candidate) => candidate.id !== part.id && candidate.sourceFeatureId === part.sourceFeatureId)
        .flatMap((candidate) => {
          const assignment = assignmentByPart[candidate.id];
          const candidatePoint = facts.representativePoints[candidate.id];
          return assignment === undefined || candidatePoint === undefined || !isRegionId(assignment.shardId)
            ? []
            : [{ part: candidate, shardId: assignment.shardId, distanceKm: geodesicDistanceKm(point, candidatePoint) }];
        })
        .toSorted((left, right) => left.distanceKm - right.distanceKm || left.part.id.localeCompare(right.part.id));
      const nearest = candidates[0];
      if (nearest === undefined) return { partId: part.id, sourceFeatureId: part.sourceFeatureId, decision: { kind: "no-same-territory-major" } };
      const tied = candidates.filter((candidate) => equivalentDistance(candidate.distanceKm, nearest.distanceKm));
      const shards = new Set(tied.map((candidate) => candidate.shardId));
      if (shards.size > 1) return { partId: part.id, sourceFeatureId: part.sourceFeatureId, decision: { kind: "ambiguous-major-shard", candidatePartIds: tied.map((candidate) => candidate.part.id), distanceKm: nearest.distanceKm } };
      const blocked = facts.links.filter((link) => pairMatches(part.id, nearest.part.id, link)).flatMap((link) => link.blockedBy);
      if (blocked.length > 0) return { partId: part.id, sourceFeatureId: part.sourceFeatureId, decision: { kind: "corridor-blocked", candidatePartId: nearest.part.id, distanceKm: nearest.distanceKm, corridorIds: [...new Set(blocked)].map(String).toSorted() } };
      return nearest.distanceKm > policy.maximumDistanceKm
        ? { partId: part.id, sourceFeatureId: part.sourceFeatureId, decision: { kind: "too-distant", candidatePartId: nearest.part.id, shardId: nearest.shardId, distanceKm: nearest.distanceKm, maximumDistanceKm: policy.maximumDistanceKm } }
        : { partId: part.id, sourceFeatureId: part.sourceFeatureId, decision: { kind: "attachable", candidatePartId: nearest.part.id, shardId: nearest.shardId, distanceKm: nearest.distanceKm } };
    });
};

const initialCandidates = (policy: PartitionPolicy, facts: PartitionFacts): readonly Candidate[] =>
  policy.regions.flatMap((region) => {
    const nearest = canonicalPartIds(facts.parts)
      .flatMap((partId) => {
        const point = facts.representativePoints[partId];
        return point === undefined ? [] : [{ partId, distanceKm: geodesicDistanceKm(region.seed, point) }];
      })
      .toSorted((left, right) => left.distanceKm - right.distanceKm || left.partId.localeCompare(right.partId))[0];
    return nearest === undefined ? [] : [{ partId: nearest.partId, region, costKm: nearest.distanceKm }];
  });

const expandSeedPaths = (
  candidates: readonly Candidate[],
  links: readonly FrontierLink[],
  points: Readonly<Record<AtomicPartId, LongitudeLatitude>>,
): SeedWinner => {
  const maximumSteps = links.length * 2 + candidates.length;
  return Array.from({ length: maximumSteps }).reduce<ExpansionState>((state) => {
    const ordered = [...state.candidates].toSorted(compareCandidate);
    const next = ordered[0];
    if (next === undefined) return state;
    const remaining = ordered.slice(1);
    const admissible = next.costKm <= next.region.maxSeedDistanceKm && state.winners[next.partId] === undefined;
    const extensions = !admissible
      ? []
      : neighboursOf(links, next.partId)
        .filter((neighbour) => neighbour.kind === "adjacency" || neighbour.distanceKm <= next.region.maxFrontierGapKm)
        .flatMap((neighbour) => {
          const point = points[neighbour.partId];
          return point === undefined ? [] : [{ partId: neighbour.partId, region: next.region, costKm: geodesicDistanceKm(next.region.seed, point) }];
        });
    return admissible
      ? { candidates: [...remaining, ...extensions], winners: { ...state.winners, [next.partId]: next } }
      : { ...state, candidates: remaining };
  }, { candidates, winners: {} }).winners;
};

const applicableRule = (
  policy: PartitionPolicy,
  partId: AtomicPartId,
  point: LongitudeLatitude,
): GeographicRule | undefined => [...policy.geographicRules].toSorted((left, right) => left.id.localeCompare(right.id)).find((rule) =>
  rule.kind === "force-shard-in-bounds" ? inside(point, rule.bounds) : rule.partIds.includes(partId));

const explicitException = (policy: PartitionPolicy, partId: AtomicPartId): ExplicitException | undefined =>
  policy.exceptions.find((exception) => exception.partId === partId);

const applicableResidualRule = (
  policy: PartitionPolicy,
  point: LongitudeLatitude,
  majorLandPoints: readonly LongitudeLatitude[],
): ResidualRule | undefined =>
  [...policy.residualRules]
    .toSorted((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
    .find((rule) => insideCoverage(point, rule.coverageBounds) &&
      majorLandPoints.every((majorPoint) => geodesicDistanceKm(point, majorPoint) >= rule.minimumMajorLandDistanceKm));

const resolveInitialAssignments = (policy: PartitionPolicy, facts: PartitionFacts, winners: SeedWinner): readonly ExplainedAssignment[] =>
  canonicalPartIds(facts.parts).map((partId) => {
    const exception = explicitException(policy, partId);
    const point = facts.representativePoints[partId];
    const rule = point === undefined ? undefined : applicableRule(policy, partId, point);
    const winner = winners[partId];
    const initial: ExplainedAssignment = exception === undefined
      ? rule === undefined
        ? winner === undefined
          ? { partId, shardId: "world-basemap", explanation: { kind: "residual-basemap" } }
          : { partId, shardId: winner.region.id, explanation: { kind: "seed-path", region: winner.region.id, costKm: winner.costKm } }
        : { partId, shardId: rule.shardId, explanation: { kind: "geographic-rule", ruleId: rule.id } }
      : { partId, shardId: exception.shardId, explanation: { kind: "explicit-exception", ruleId: exception.governingRuleId } };
    return initial;
  });

const applyCoastalAttachments = (
  policy: PartitionPolicy,
  facts: PartitionFacts,
  initial: readonly ExplainedAssignment[],
): readonly ExplainedAssignment[] => {
  const attachment = policy.coastalAttachment;
  if (attachment === undefined) return initial;
  const decisions = new Map(auditCoastalAttachments(attachment, facts, initial).map((entry) => [entry.partId, entry.decision]));
  return initial.map((assignment) => {
    const decision = decisions.get(assignment.partId);
    return decision?.kind !== "attachable"
      ? assignment
      : { ...assignment, shardId: decision.shardId, explanation: { kind: "coastal-attachment", ruleId: attachment.id, candidatePartId: decision.candidatePartId, distanceKm: decision.distanceKm } };
  });
};

const resolveAssignments = (policy: PartitionPolicy, facts: PartitionFacts, winners: SeedWinner): readonly ExplainedAssignment[] => {
  const initial = applyCoastalAttachments(policy, facts, resolveInitialAssignments(policy, facts, winners));
  const majorLandPoints = initial.flatMap((assignment) => isRegionId(assignment.shardId)
    ? [facts.representativePoints[assignment.partId]]
    : []).filter((point): point is LongitudeLatitude => point !== undefined);
  return initial.map((assignment) => {
    const point = facts.representativePoints[assignment.partId];
    const residualRule = assignment.shardId === "world-basemap" && point !== undefined
      ? applicableResidualRule(policy, point, majorLandPoints)
      : undefined;
    return residualRule === undefined
      ? assignment
      : { ...assignment, shardId: residualRule.shardId, explanation: { kind: "residual-rule", ruleId: residualRule.id } };
  });
};

const validateExceptions = (policy: PartitionPolicy, facts: PartitionFacts): Result<void, PartitionFailure> => {
  const ids = canonicalPartIds(facts.parts);
  const unknown = policy.exceptions.find((exception) => !ids.includes(exception.partId));
  const stale = policy.exceptions.find((exception) => !policy.geographicRules.some((rule) => rule.id === exception.governingRuleId));
  return unknown !== undefined
    ? err({ kind: "unknown_exception_part", message: `Exception references unknown part ${unknown.partId}.` })
    : stale !== undefined
    ? err({ kind: "stale_exception", message: `Exception for ${stale.partId} references unknown rule ${stale.governingRuleId}.` })
    : ok(undefined);
};

export const partitionWorld = (policy: PartitionPolicy, facts: PartitionFacts): Result<PartitionResult, PartitionFailure> => {
  const validatedPolicy = validatePartitionPolicy(policy);
  const validatedFacts = validateFacts(facts);
  if (validatedPolicy.isErr()) return err(validatedPolicy.error);
  if (validatedFacts.isErr()) return err(validatedFacts.error);
  if (validatedPolicy.value.source !== validatedFacts.value.source) return err({ kind: "source_mismatch", message: "Partition policy and facts must name the same source release." });
  const exceptions = validateExceptions(validatedPolicy.value, validatedFacts.value);
  if (exceptions.isErr()) return err(exceptions.error);
  const explainedAssignments = resolveAssignments(validatedPolicy.value, validatedFacts.value, expandSeedPaths(initialCandidates(validatedPolicy.value, validatedFacts.value), allowedLinks(validatedFacts.value), validatedFacts.value.representativePoints));
  const unassigned = explainedAssignments.find((assignment) => assignment.shardId === undefined);
  return unassigned === undefined
    ? ok({ assignments: explainedAssignments.map(({ partId, shardId }) => ({ partId, shardId })), explainedAssignments })
    : err({ kind: "unassigned_part", message: `Could not assign ${unassigned.partId}.` });
};

export const describePartitionFailure = (failure: PartitionFailure): string =>
  match(failure.kind)
    .with("source_mismatch", () => "source mismatch")
    .with("invalid_policy", () => "invalid partition policy")
    .with("invalid_facts", () => "invalid partition facts")
    .with("unknown_exception_part", () => "exception for unknown atomic part")
    .with("duplicate_exception", () => "duplicate explicit exception")
    .with("stale_exception", () => "stale explicit exception")
    .with("unassigned_part", () => "unassigned atomic part")
    .exhaustive();

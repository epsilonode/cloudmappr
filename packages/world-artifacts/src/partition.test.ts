import { partitionWorld, type PartitionFacts, type PartitionPolicy, type SourceRelease } from "./partition.ts";
import { asAtomicPartId, asSourceFeatureId, type AtomicPart } from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

const source = "test-10m" as SourceRelease;
const partId = (value: string) => asAtomicPartId(value)._unsafeUnwrap();
const ids = ["basemap", "north", "south", "europe", "africa", "asia", "oceania", "antarctica", "rule", "exception"].map(partId);
const basemapId = partId("basemap");
const northId = partId("north");
const southId = partId("south");
const exceptionId = partId("exception");
const parts: readonly AtomicPart[] = ids.map((id, index) => ({ id, sourceFeatureId: asSourceFeatureId(String(index))._unsafeUnwrap(), bounds: [index, 0, index + 0.5, 0.5], coordinates: [[[index, 0], [index + 0.5, 0], [index, 0]]] }));
const policy: PartitionPolicy = {
  source,
  revision: "test-v1",
  regions: [
    { id: "north-america", seed: [1, 0], priority: 1, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "south-america", seed: [2, 0], priority: 2, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "europe", seed: [3, 0], priority: 3, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "africa", seed: [4, 0], priority: 4, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "asia", seed: [5, 0], priority: 5, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "oceania-major", seed: [6, 0], priority: 6, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
    { id: "antarctica", seed: [7, 0], priority: 7, maxSeedDistanceKm: 20_000, maxFrontierGapKm: 1_000 },
  ],
  corridors: [],
  geographicRules: [{ id: "force-africa" as never, kind: "force-shard-in-bounds", shardId: "africa", bounds: [8, -1, 9, 1] }],
  residualRules: [],
  exceptions: [{ partId: exceptionId, shardId: "world-basemap", rationale: "test", reviewer: "test", governingRuleId: "force-africa" as never }],
};
const facts: PartitionFacts = {
  source,
  parts,
  representativePoints: Object.fromEntries(ids.map((id, index) => [id, [index, 0]])),
  links: [{ left: northId, right: southId, kind: "adjacency", distanceKm: 0, blockedBy: ["darien" as never] }],
};

Deno.test("rule-first partition assigns every part once and explains rule precedence", () => {
  const result = partitionWorld(policy, facts);
  assertEquals(result.isOk(), true);
  assertEquals(result._unsafeUnwrap().assignments.length, parts.length);
  assertEquals(result._unsafeUnwrap().explainedAssignments.find((assignment) => assignment.partId === ids[8])?.explanation.kind, "geographic-rule");
  assertEquals(result._unsafeUnwrap().explainedAssignments.find((assignment) => assignment.partId === ids[9])?.explanation.kind, "explicit-exception");
});

Deno.test("rule-first partition rejects a policy for another 10m source release", () => {
  const result = partitionWorld({ ...policy, source: "other" as SourceRelease }, facts);
  assertEquals(result.isErr(), true);
  assertEquals(result._unsafeUnwrapErr().kind, "source_mismatch");
});

Deno.test("residual rules only reclassify parts left in the eager basemap", () => {
  const result = partitionWorld({
    ...policy,
    residualRules: [{ id: "arctic-residual" as never, shardId: "islands-arctic", priority: 1, coverageBounds: [[-180, -1, 180, 1]], minimumMajorLandDistanceKm: 0 }],
  }, facts);

  assertEquals(result.isOk(), true);
  const assignments = result._unsafeUnwrap().explainedAssignments;
  assertEquals(assignments.find((assignment) => assignment.partId === northId)?.shardId, "north-america");
  assertEquals(assignments.find((assignment) => assignment.partId === ids[0])?.shardId, "islands-arctic");
  assertEquals(assignments.find((assignment) => assignment.partId === ids[0])?.explanation.kind, "residual-rule");
});

Deno.test("coastal attachment moves only an eligible same-territory residual before residual rules", () => {
  const coastalFacts: PartitionFacts = {
    ...facts,
    parts: facts.parts.map((part, index) => index === 0 || index === 1
      ? { ...part, sourceFeatureId: asSourceFeatureId("shared-territory")._unsafeUnwrap() }
      : part),
  };
  const result = partitionWorld({
    ...policy,
    coastalAttachment: { id: "same-territory-coastal-attachment" as never, maximumDistanceKm: 500 },
    exceptions: [{ partId: basemapId, shardId: "world-basemap", rationale: "keep residual until coastal phase", reviewer: "test", governingRuleId: "force-africa" as never }],
  }, coastalFacts);

  assertEquals(result.isOk(), true);
  const attached = result._unsafeUnwrap().explainedAssignments.find((assignment) => assignment.partId === basemapId);
  assertEquals(attached?.shardId, "north-america");
  assertEquals(attached?.explanation.kind, "coastal-attachment");
});

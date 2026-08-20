import {
  asAtomicPartId,
  asSourceFeatureId,
  asReleaseIdentity,
  type AtomicPart,
  partsForShard,
  validateAssignments,
} from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }.`,
    );
  }
};

const northAmerica = asAtomicPartId("north-america-part")._unsafeUnwrap();
const southAmerica = asAtomicPartId("south-america-part")._unsafeUnwrap();
const parts: readonly AtomicPart[] = [
  {
    id: northAmerica,
    sourceFeatureId: asSourceFeatureId("north-america")._unsafeUnwrap(),
    bounds: [-1, -1, 1, 1],
    coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, -1]]],
  },
  {
    id: southAmerica,
    sourceFeatureId: asSourceFeatureId("south-america")._unsafeUnwrap(),
    bounds: [2, -1, 4, 1],
    coordinates: [[[2, -1], [4, -1], [4, 1], [2, -1]]],
  },
];

Deno.test("validateAssignments rejects duplicate atomic-part assignments", () => {
  const result = validateAssignments(parts, [
    { partId: northAmerica, shardId: "north-america" },
    { partId: northAmerica, shardId: "south-america" },
  ]);

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertEquals(result.error.kind, "duplicate_assignment");
  }
});

Deno.test("partsForShard derives an immutable selected subset", () => {
  const selected = partsForShard(parts, [{
    partId: northAmerica,
    shardId: "north-america",
  }], "north-america");

  assertEquals(selected, parts.slice(0, 1));
  assertEquals(asReleaseIdentity("fixture-v1").isOk(), true);
});

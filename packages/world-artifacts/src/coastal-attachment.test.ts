import { auditCoastalAttachments } from "./coastal-attachment.ts";
import type { PartitionFacts, PartitionResult, SourceRelease } from "./partition.ts";
import { asAtomicPartId, asSourceFeatureId, type AtomicPart, type ShardAssignment } from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

const source = "test-10m" as SourceRelease;
const part = (id: string, sourceFeatureId: string, longitude: number): AtomicPart => ({
  id: asAtomicPartId(id)._unsafeUnwrap(),
  sourceFeatureId: asSourceFeatureId(sourceFeatureId)._unsafeUnwrap(),
  bounds: [longitude, 0, longitude + 0.1, 0.1],
  coordinates: [[[longitude, 0], [longitude + 0.1, 0], [longitude, 0]]],
});
const parts = [
  part("attach", "a", 0), part("attach-owner", "a", 1),
  part("no-owner", "b", 2),
  part("ambiguous", "c", 10), part("ambiguous-na", "c", 9), part("ambiguous-sa", "c", 11),
  part("blocked", "d", 20), part("blocked-owner", "d", 21),
  part("distant", "e", 30), part("distant-owner", "e", 60),
] as const;
const byId = Object.fromEntries(parts.map((entry) => [entry.id, [entry.bounds[0], 0] as const]));
const facts: PartitionFacts = {
  source,
  parts,
  representativePoints: byId as unknown as PartitionFacts["representativePoints"],
  links: [{ left: asAtomicPartId("blocked")._unsafeUnwrap(), right: asAtomicPartId("blocked-owner")._unsafeUnwrap(), kind: "frontier", distanceKm: 100, blockedBy: ["test-corridor" as never] }],
};
const assignments = parts.map((entry): ShardAssignment => ({
  partId: entry.id,
  shardId: entry.id === "attach-owner" || entry.id === "ambiguous-na" || entry.id === "blocked-owner" || entry.id === "distant-owner"
    ? "north-america"
    : entry.id === "ambiguous-sa" ? "south-america" : "world-basemap",
}));
const explained: PartitionResult["explainedAssignments"] = assignments.map((assignment) =>
  assignment.shardId === "world-basemap"
    ? { ...assignment, explanation: { kind: "residual-basemap" as const } }
    : { ...assignment, explanation: { kind: "seed-path" as const, region: assignment.shardId as never, costKm: 0 } },
);

Deno.test("coastal attachment audit reports each pure outcome without changing assignments", () => {
  const result = auditCoastalAttachments({ maximumDistanceKm: 500 }, facts, explained);
  const decision = (id: string) => result.find((entry) => entry.partId === id)?.decision;

  assertEquals(decision("attach")?.kind, "attachable");
  assertEquals(decision("no-owner")?.kind, "no-same-territory-major");
  assertEquals(decision("ambiguous")?.kind, "ambiguous-major-shard");
  assertEquals(decision("blocked")?.kind, "corridor-blocked");
  assertEquals(decision("distant")?.kind, "too-distant");
  assertEquals(assignments.find((assignment) => assignment.partId === "attach")?.shardId, "world-basemap");
});

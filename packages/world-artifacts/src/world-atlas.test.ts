import {
  createWorldAtlasPolicyReport,
  createWorldAtlasPostAttachmentReport,
  parseWorldAtlasPartitionPolicy,
  worldAtlasAtomicParts,
  worldAtlasDefaultPolicy,
  worldAtlasPartitionFacts,
  worldAtlasSource,
} from "./world-atlas.ts";
import coastalAttachmentPolicy from "../policies/world-atlas-10m-seeded-frontier-v6-coastal-attachment.json" with { type: "json" };

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("World Atlas 10m source splits country geometry into stable atomic polygon parts", () => {
  const parts = worldAtlasAtomicParts();
  assertEquals(parts.isOk(), true);
  assertEquals(parts._unsafeUnwrap().length > 4_000, true);
  assertEquals(parts._unsafeUnwrap().every((part) => part.id.length > 0), true);
});

Deno.test("World Atlas policy rejects an incomplete 10m partition policy", () => {
  const parsed = parseWorldAtlasPartitionPolicy({ source: worldAtlasSource, revision: "v1", regions: [], corridors: [], geographicRules: [], exceptions: [] });
  assertEquals(parsed.isErr(), true);
});

Deno.test("World Atlas policy report explains every 10m part with all eight delivery roles", () => {
  const report = createWorldAtlasPolicyReport(worldAtlasDefaultPolicy);
  assertEquals(report.isOk(), true);
  assertEquals(report._unsafeUnwrap().assignments.length, worldAtlasAtomicParts()._unsafeUnwrap().length);
  assertEquals([...new Set(report._unsafeUnwrap().assignments.map((assignment) => assignment.shardId))].sort(), ["africa", "antarctica", "asia", "europe", "north-america", "oceania-major", "south-america", "world-basemap"]);
  assertEquals(report._unsafeUnwrap().assignments.every((assignment) => assignment.explanation.kind !== undefined), true);
  assertEquals(report._unsafeUnwrap().assignments.find((assignment) => assignment.partId === "010:0")?.shardId, "antarctica");
  assertEquals(report._unsafeUnwrap().assignments.find((assignment) => assignment.partId === "010:0")?.explanation.kind, "geographic-rule");
  const facts = worldAtlasPartitionFacts(worldAtlasDefaultPolicy)._unsafeUnwrap();
  const southOf50 = report._unsafeUnwrap().assignments.filter((assignment) => {
    const point = facts.representativePoints[assignment.partId];
    return point !== undefined && point[1] <= -50;
  });
  assertEquals(southOf50.every((assignment) => assignment.shardId === "antarctica"), true);
});

Deno.test("World Atlas post-attachment report preserves total coverage and records the versioned v6 candidate", () => {
  const report = createWorldAtlasPostAttachmentReport(coastalAttachmentPolicy as never);
  assertEquals(report.isOk(), true);
  const value = report._unsafeUnwrap();
  assertEquals(value.sourcePartCount, 4220);
  assertEquals(value.residualPartCountBeforeAttachment, 1204);
  assertEquals(value.attachedPartCount, 519);
  assertEquals(value.residualPartCount, 924);
  assertEquals(value.assignments.length, value.sourcePartCount);
  assertEquals(value.assignments.filter((assignment) => assignment.explanation.kind === "coastal-attachment").length, value.attachedPartCount);
});

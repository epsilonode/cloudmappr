type Metric = Readonly<{ readonly median: number; readonly range: readonly [number, number] }>;
type Scenario = Readonly<{
  readonly requestCount: number;
  readonly rawBytes: Metric;
  readonly gzipBytes: Metric;
  readonly brotliBytes: Metric;
  readonly decodeMs: Metric;
  readonly pathMs: Metric;
  readonly retainedHeapBytes: Metric;
}>;
type Measurement = Readonly<{ readonly release: string; readonly scenarios: Readonly<Record<string, Scenario>> }>;

const argument = (name: "--control" | "--candidate" | "--output"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};
const controlFile = argument("--control");
const candidateFile = argument("--candidate");
const output = argument("--output");
if (controlFile === undefined || candidateFile === undefined || output === undefined) {
  console.error("Usage: compare-world-atlas-measurements.ts --control <file> --candidate <file> --output <file>");
  Deno.exit(1);
}
const control = JSON.parse(await Deno.readTextFile(controlFile)) as Measurement;
const candidate = JSON.parse(await Deno.readTextFile(candidateFile)) as Measurement;
const scenarios = Object.keys(control.scenarios).flatMap((id) => {
  const before = control.scenarios[id];
  const after = candidate.scenarios[id];
  return before === undefined || after === undefined ? [] : [[id, {
    requestCount: after.requestCount - before.requestCount,
    rawBytes: after.rawBytes.median - before.rawBytes.median,
    gzipBytes: after.gzipBytes.median - before.gzipBytes.median,
    brotliBytes: after.brotliBytes.median - before.brotliBytes.median,
    decodeMs: after.decodeMs.median - before.decodeMs.median,
    pathMs: after.pathMs.median - before.pathMs.median,
    retainedHeapBytes: after.retainedHeapBytes.median - before.retainedHeapBytes.median,
  }]];
});
const fullWorld = Object.fromEntries(scenarios)["full-world"] as Readonly<{ readonly requestCount: number; readonly rawBytes: number }> | undefined;
const decision = fullWorld === undefined || fullWorld.requestCount > 0 || fullWorld.rawBytes > 0
  ? "not-promotable"
  : "review-required";
const record = {
  format: 1,
  controlRelease: control.release,
  candidateRelease: candidate.release,
  scenarios: Object.fromEntries(scenarios),
  decision,
  rationale: decision === "not-promotable"
    ? "Candidate increases full-world requests or raw bytes; retain it as an evidence-only local trial."
    : "No automatic promotion: human review must assess ordinary-view geometry and transfer improvements.",
};
await Deno.mkdir(output.split(/[\\/]/).slice(0, -1).join("/") || ".", { recursive: true });
await Deno.writeTextFile(output, JSON.stringify(record, null, 2));
console.log(`Compared ${record.candidateRelease} against ${record.controlRelease}: ${record.decision}`);

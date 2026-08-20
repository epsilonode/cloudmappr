import { createWorldAtlasPolicyReport, parseWorldAtlasPartitionPolicy, worldAtlasDefaultPolicy } from "./world-atlas.ts";

const argument = (name: "--policy" | "--output"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};
const output = argument("--output") ?? Deno.env.get("CLOUDMAPPR_ASSIGNMENT_TEMPLATE") ?? "build/world-atlas-10m-policy-report.json";
const requestedPolicy = argument("--policy");
const input = requestedPolicy === undefined ? worldAtlasDefaultPolicy : JSON.parse(await Deno.readTextFile(requestedPolicy));
const policy = parseWorldAtlasPartitionPolicy(input);
if (policy.isErr()) {
  console.error(policy.error.message);
  Deno.exit(1);
}
const report = createWorldAtlasPolicyReport(policy.value);

if (report.isErr()) {
  console.error(report.error.message);
  Deno.exit(1);
}

await Deno.mkdir(output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await Deno.writeTextFile(output, JSON.stringify(report.value, null, 2));
console.log(`Wrote ${report.value.assignments.length} explained 10m assignments to ${output}`);

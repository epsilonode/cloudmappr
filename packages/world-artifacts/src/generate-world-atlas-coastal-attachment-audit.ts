import { createWorldAtlasCoastalAttachmentReport, parseWorldAtlasPartitionPolicy } from "./world-atlas.ts";

const argument = (name: "--policy" | "--output" | "--budget-km"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};

const policyFile = argument("--policy");
const output = argument("--output") ?? "build/world-atlas-coastal-attachment-audit.json";
const maximumDistanceKm = Number(argument("--budget-km") ?? "350");
if (policyFile === undefined) {
  console.error("Usage: generate-world-atlas-coastal-attachment-audit.ts --policy <file> [--output <file>] [--budget-km <number>]");
  Deno.exit(1);
}
const policy = parseWorldAtlasPartitionPolicy(JSON.parse(await Deno.readTextFile(policyFile)));
if (policy.isErr()) {
  console.error(policy.error.message);
  Deno.exit(1);
}
const report = createWorldAtlasCoastalAttachmentReport(policy.value, maximumDistanceKm);
if (report.isErr()) {
  console.error(report.error.message);
  Deno.exit(1);
}
await Deno.mkdir(output.split(/[\\/]/).slice(0, -1).join("/") || ".", { recursive: true });
await Deno.writeTextFile(output, JSON.stringify(report.value, null, 2));
console.log(`Wrote ${report.value.decisions.length} coastal attachment decisions to ${output}`);

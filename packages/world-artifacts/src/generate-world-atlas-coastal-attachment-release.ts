import {
  createWorldAtlasPostAttachmentReport,
  generateWorldAtlasRelease,
  parseWorldAtlasPartitionPolicy,
  worldAtlasReleaseIdentity,
} from "./world-atlas.ts";

const argument = (name: "--policy" | "--output"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};

const policyFile = argument("--policy");
if (policyFile === undefined) {
  console.error("Usage: generate-world-atlas-coastal-attachment-release.ts --policy <file> [--output <directory>]");
  Deno.exit(1);
}
const policy = parseWorldAtlasPartitionPolicy(JSON.parse(await Deno.readTextFile(policyFile)));
if (policy.isErr() || policy.value.coastalAttachment === undefined) {
  console.error(policy.isErr() ? policy.error.message : "Coastal attachment release requires a coastalAttachment policy.");
  Deno.exit(1);
}
const release = await worldAtlasReleaseIdentity(policy.value);
if (release.isErr()) {
  console.error(release.error.message);
  Deno.exit(1);
}
const root = argument("--output") ?? Deno.env.get("CLOUDMAPPR_ARTIFACT_ROOT") ?? "build/world";
const directory = `${root}/${release.value}`;
const generated = await generateWorldAtlasRelease(directory, policy.value);
const report = createWorldAtlasPostAttachmentReport(policy.value);
if (generated.isErr() || report.isErr()) {
  console.error(generated.isErr() ? generated.error.message : report.error.message);
  Deno.exit(1);
}
const worldBasemapRawBytes = (await Deno.stat(`${directory}/world-basemap.topo.json`)).size;
await Deno.writeTextFile(`${directory}/coastal-attachment-report.json`, JSON.stringify({ ...report.value, worldBasemapRawBytes }, null, 2));
console.log(`Generated ${generated.value.release} with ${report.value.attachedPartCount} coastal attachments at ${directory}/manifest.json`);

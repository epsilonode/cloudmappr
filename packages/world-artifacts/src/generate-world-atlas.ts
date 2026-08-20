import { generateWorldAtlasRelease, parseWorldAtlasPartitionPolicy, worldAtlasDefaultPolicy, worldAtlasReleaseIdentity } from "./world-atlas.ts";

const argument = (name: "--policy" | "--output"): string | undefined => {
  const index = Deno.args.indexOf(name);
  const value = index < 0 ? undefined : Deno.args[index + 1];
  return value === undefined || value.trim().length === 0 ? undefined : value;
};

const root = argument("--output") ?? Deno.env.get("CLOUDMAPPR_ARTIFACT_ROOT") ?? "build/world";
const policyFile = argument("--policy") ?? Deno.env.get("CLOUDMAPPR_PARTITION_POLICY_FILE");
const input = policyFile === undefined || policyFile.trim().length === 0
  ? worldAtlasDefaultPolicy
  : JSON.parse(await Deno.readTextFile(policyFile));
const policy = parseWorldAtlasPartitionPolicy(input);

if (policy.isErr()) {
  console.error(policy.error.message);
  Deno.exit(1);
}

const release = await worldAtlasReleaseIdentity(policy.value);
if (release.isErr()) {
  console.error(release.error.message);
  Deno.exit(1);
}
const directory = `${root}/${release.value}`;
const generated = await generateWorldAtlasRelease(directory, policy.value);

if (generated.isErr()) {
  console.error(generated.error.message);
  Deno.exit(1);
}

console.log(`Generated ${generated.value.release} at ${directory}/manifest.json`);

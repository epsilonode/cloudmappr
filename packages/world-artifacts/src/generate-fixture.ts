import { asReleaseRef } from "./receiver.ts";
import { generateFixtureArtifacts } from "./generation.ts";

const root = Deno.env.get("CLOUDMAPPR_ARTIFACT_ROOT") ?? "build/world";
const releaseValue = Deno.env.get("CLOUDMAPPR_RELEASE") ?? "fixture-eight-shards-v1";
const release = asReleaseRef(releaseValue);

if (release.isErr()) {
  console.error(release.error.message);
  Deno.exit(1);
}

const output = `${root}/${release.value}`;
const generated = await generateFixtureArtifacts(output);

if (generated.isErr()) {
  console.error(generated.error.message);
  Deno.exit(1);
}

console.log(`Generated ${generated.value.release} at ${output}/manifest.json`);

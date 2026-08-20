import { asManifestUrl, asReleaseRef } from "../../world-artifacts/src/receiver.ts";
import { generateFixtureArtifacts } from "../../world-artifacts/src/generation.ts";
import { createLocalArtifactRoute } from "../../world-artifacts/src/local.ts";
import { createBrowserSceneLoader } from "./artifact-scene-loader.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("live: browser scene loader selects the same fixture artifacts through HTTP", async () => {
  const root = await Deno.makeTempDir({ prefix: "cloudmappr-browser-loader-" });
  const release = asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap();
  try {
    const generated = await generateFixtureArtifacts(`${root}/${release}`);
    assertEquals(generated.isOk(), true);
    const route = (await createLocalArtifactRoute({ root, release }))._unsafeUnwrap();
    const loader = createBrowserSceneLoader({
      release,
      manifestUrl: asManifestUrl(`http://localhost/artifacts/${release}/manifest.json`)._unsafeUnwrap(),
      fetchPort: (input) => route(new Request(typeof input === "string" ? input : input.toString())),
    });
    const result = await loader({ version: 1, bounds: [-140, 20, -50, 80], width: 240, height: 120 });
    assertEquals(result.isOk(), true);
    assertEquals(result._unsafeUnwrap().land.map((land) => land.id), ["world-basemap-0", "north-america-0"]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

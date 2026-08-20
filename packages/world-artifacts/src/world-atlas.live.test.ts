import { generateWorldAtlasRelease, worldAtlasDefaultPolicy, worldAtlasReleaseIdentity } from "./world-atlas.ts";
import { feature } from "topojson-client";
import arcticPacificPolicy from "../policies/world-atlas-10m-seeded-frontier-v5-arctic-pacific.json" with { type: "json" };
import { createBrowserSceneLoader } from "../../client/src/artifact-scene-loader.ts";
import { createLocalLandProvider } from "../../server/src/local-development.ts";
import { asManifestUrl, asReleaseRef } from "./receiver.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("live: 10m World Atlas policy emits eight independently dissolved candidate shards", async () => {
  const directory = await Deno.makeTempDir({ prefix: "cloudmappr-world-atlas-10m-" });
  try {
    const generated = await generateWorldAtlasRelease(directory, worldAtlasDefaultPolicy);
    assertEquals(generated.isOk(), true);
    assertEquals(generated._unsafeUnwrap().artifacts.map((artifact) => artifact.id), [
      "world-basemap",
      "north-america",
      "south-america",
      "europe",
      "africa",
      "asia",
      "oceania-major",
      "antarctica",
    ]);
    assertEquals((await Deno.stat(`${directory}/provenance.json`)).isFile, true);
    const topologies = await Promise.all(generated._unsafeUnwrap().artifacts.map(async (artifact) => JSON.parse(await Deno.readTextFile(`${directory}/${artifact.id}.topo.json`)) as Readonly<{ readonly objects: Readonly<Record<string, unknown>> }>));
    assertEquals(topologies.every((topology) => topology.objects.land !== undefined), true);
    assertEquals(topologies.every((topology) => !JSON.stringify(topology.objects.land).includes("PART_ID")), true);
    assertEquals(topologies.every((topology) => feature(topology as never, topology.objects.land as never) !== undefined), true);
    assertEquals((await Deno.stat(`${directory}/source.geojson`).then(() => true).catch(() => false)), false);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("live: browser HTTP and Deno filesystem receivers select the same optional v5 artifacts", async () => {
  const root = await Deno.makeTempDir({ prefix: "cloudmappr-world-atlas-v5-" });
  try {
    const identity = await worldAtlasReleaseIdentity(arcticPacificPolicy as never);
    assertEquals(identity.isOk(), true);
    const generated = await generateWorldAtlasRelease(`${root}/${identity._unsafeUnwrap()}`, arcticPacificPolicy);
    assertEquals(generated.isOk(), true);
    const release = asReleaseRef(String(generated._unsafeUnwrap().release))._unsafeUnwrap();
    const config = { root, release };
    const route = await (await import("./local.ts")).createLocalArtifactRoute(config);
    assertEquals(route.isOk(), true);
    const manifestUrl = asManifestUrl(`http://localhost/artifacts/${release}/manifest.json`)._unsafeUnwrap();
    const browser = createBrowserSceneLoader({
      manifestUrl,
      release,
      fetchPort: (input) => route._unsafeUnwrap()(new Request(typeof input === "string" ? input : input.toString())),
    });
    const spec = { version: 1 as const, bounds: [170, -20, -170, 30] as const, width: 240, height: 120, theme: "light" as const, points: [], labels: [] };
    const browserScene = await browser(spec);
    const denoLand = await createLocalLandProvider(config).load(spec);
    assertEquals(browserScene.isOk(), true);
    assertEquals(denoLand.isOk(), true);
    assertEquals(browserScene._unsafeUnwrap().land.map((land) => land.id).sort(), denoLand._unsafeUnwrap().map((land) => land.id).sort());
    assertEquals(generated._unsafeUnwrap().artifacts.filter((artifact) => artifact.id.startsWith("islands-")).map((artifact) => artifact.coverageBounds.length > 0).every(Boolean), true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

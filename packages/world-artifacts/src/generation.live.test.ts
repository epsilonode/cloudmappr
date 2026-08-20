import { generateFixtureArtifacts } from "./generation.ts";
import { asManifestUrl, parseManifest } from "./receiver.ts";
import type { WorldManifest } from "./shards.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }.`,
    );
  }
};

const proveFixture = async (): Promise<Readonly<{
  readonly directory: string;
  readonly manifest: WorldManifest;
}>> => {
  const directory = await Deno.makeTempDir({
    prefix: "cloudmappr-world-artifacts-",
  });

  const result = await generateFixtureArtifacts(directory);

  return { directory, manifest: result._unsafeUnwrap() };
};

Deno.test("live: pinned Mapshaper emits eight independent fixture TopoJSON artifacts", async () => {
  const fixture = await proveFixture();
  const { directory, manifest } = fixture;

  try {
    assertEquals(manifest.artifacts.map((artifact) => artifact.id), [
      "world-basemap",
      "north-america",
      "south-america",
      "europe",
      "africa",
      "asia",
      "oceania-major",
      "antarctica",
    ]);
    assertEquals(
      manifest.artifacts.filter((artifact) => artifact.eager).map((artifact) =>
        artifact.id
      ),
      ["world-basemap"],
    );
    assertEquals(
      manifest.artifacts.every((artifact) => artifact.digest.length === 64),
      true,
    );

    const rawManifest: unknown = JSON.parse(
      await Deno.readTextFile(`${directory}/manifest.json`),
    );
    const parsed = parseManifest(
      rawManifest,
      asManifestUrl("./manifest.json")._unsafeUnwrap(),
    );
    assertEquals(parsed.isOk(), true);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

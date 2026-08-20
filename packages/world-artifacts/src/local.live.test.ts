import { asReleaseRef } from "./receiver.ts";
import { generateFixtureArtifacts } from "./generation.ts";
import { createLocalArtifactRoute } from "./local.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("live: local artifact route serves only configured manifest-listed files", async () => {
  const root = await Deno.makeTempDir({ prefix: "cloudmappr-artifact-route-" });
  const release = asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap();
  try {
    const directory = `${root}/${release}`;
    const generated = await generateFixtureArtifacts(directory);
    assertEquals(generated.isOk(), true);
    const route = await createLocalArtifactRoute({ root, release }, ["http://localhost:3000"]);
    assertEquals(route.isOk(), true);
    const handler = route._unsafeUnwrap();
    const manifest = await handler(new Request(`http://localhost/artifacts/${release}/manifest.json`, { headers: { origin: "http://localhost:3000" } }));
    const shard = await handler(new Request(`http://localhost/artifacts/${release}/north-america.topo.json`));
    const rejected = await handler(new Request(`http://localhost/artifacts/${release}/not-listed.topo.json`));
    assertEquals(manifest.headers.get("cache-control"), "no-store");
    assertEquals(manifest.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assertEquals(shard.status, 200);
    assertEquals(shard.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assertEquals(rejected.status, 404);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

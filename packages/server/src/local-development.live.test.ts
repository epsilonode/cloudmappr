import { asReleaseRef } from "../../world-artifacts/src/receiver.ts";
import { generateFixtureArtifacts } from "../../world-artifacts/src/generation.ts";
import { createFilesystemRenderStore } from "./render.ts";
import { createLocalDevelopmentHandler } from "./local-development.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("live: local composition renders fixture shards through the canonical API", async () => {
  const root = await Deno.makeTempDir({ prefix: "cloudmappr-local-development-" });
  const release = asReleaseRef("fixture-eight-shards-v1")._unsafeUnwrap();
  try {
    const generated = await generateFixtureArtifacts(`${root}/${release}`);
    assertEquals(generated.isOk(), true);
    const handler = await createLocalDevelopmentHandler(
      { root, release },
      { release, store: createFilesystemRenderStore(`${root}/renders`), baseUrl: "http://localhost" },
    );
    const response = await handler(new Request("http://localhost/v1/renders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, bounds: [-140, 20, -50, 80], width: 240, height: 120 }),
    }));
    assertEquals(response.status, 201);
    const record = await response.json() as Readonly<{ readonly svgUrl: string }>;
    const image = await handler(new Request(record.svgUrl));
    assertEquals(image.status, 200);
    assertEquals((await image.text()).includes("data-land=\"north-america-0\""), true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

import { ResultAsync } from "neverthrow";
import { createFilesystemRenderStore, createRenderApi, type LandProvider } from "./render.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

const provider: LandProvider = {
  load: () => ResultAsync.fromSafePromise(Promise.resolve([
    { id: "fixture", geometry: { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-10, -10], [10, -10], [10, 10], [-10, -10]]] } } },
  ])),
};

Deno.test("render API stores and exposes immutable canonical SVG and PNG", async () => {
  const root = await Deno.makeTempDir({ prefix: "cloudmappr-renders-" });
  try {
    const api = createRenderApi({ release: "fixture-eight-shards-v1", provider, store: createFilesystemRenderStore(root), baseUrl: "http://localhost" });
    const created = await api(new Request("http://localhost/v1/renders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, bounds: [-180, -90, 180, 90], width: 200, height: 100, points: [{ id: "p", longitude: 0, latitude: 0 }] }),
    }));
    assertEquals(created.status, 201);
    const body = await created.json() as Readonly<{ readonly svgUrl: string; readonly pngUrl: string }>;
    const svg = await api(new Request(body.svgUrl));
    const png = await api(new Request(body.pngUrl));
    assertEquals(svg.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assertEquals(png.headers.get("content-type"), "image/png");
    assertEquals((await png.arrayBuffer()).byteLength > 10, true);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

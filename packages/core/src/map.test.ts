import { buildMapScene, canonicalizeMapSpec, canonicalMapSpecJson, serializeSceneToSvg, validateMapSpec } from "./map.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

Deno.test("MapSpec validation canonicalizes unordered overlays and produces deterministic SVG", () => {
  const validated = validateMapSpec({
    version: 1,
    bounds: [170, -20, -170, 20],
    width: 640,
    height: 360,
    points: [{ id: "b", longitude: 10, latitude: 20 }, { id: "a", longitude: 0, latitude: 0, color: "red" }],
    labels: [{ id: "label", longitude: 1, latitude: 2, text: "<safe>" }],
  });
  assertEquals(validated.isOk(), true);
  const canonical = canonicalizeMapSpec(validated._unsafeUnwrap());
  assertEquals(canonical.points.map((point) => point.id), ["a", "b"]);
  assertEquals(canonicalMapSpecJson(canonical).includes("\"theme\":\"light\""), true);
  const scene = buildMapScene(canonical, [{ id: "land", geometry: { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] } } }]);
  assertEquals(scene.isOk(), true);
  assertEquals(serializeSceneToSvg(scene._unsafeUnwrap()).includes("&lt;safe&gt;"), true);
});

Deno.test("MapSpec rejects unbounded dimensions and unsafe fields", () => {
  const result = validateMapSpec({ version: 1, bounds: [-1, -1, 1, 1], width: 200, height: 100, script: "no" });
  assertEquals(result.isErr(), true);
});

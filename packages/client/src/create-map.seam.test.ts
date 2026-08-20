import { JSDOM } from "jsdom";
import { ResultAsync } from "neverthrow";
import type { MapScene, MapSpec } from "../../core/mod.ts";
import { createMap } from "./create-map.ts";

const assertEquals = <Value>(actual: Value, expected: Value): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
};

const spec: MapSpec = { version: 1, bounds: [-180, -90, 180, 90], width: 200, height: 100 };
const scene: MapScene = {
  width: 200,
  height: 100,
  theme: "light",
  land: [{ id: "land", path: "M0,0Z" }],
  markers: [{ id: "marker", x: 50, y: 50, color: "#1769aa" }],
  labels: [{ id: "label", x: 56, y: 44, text: "Fixture", color: "#1769aa" }],
};

Deno.test("createMap mounts stable scene joins and cleans up its generated SVG", async () => {
  const dom = new JSDOM("<main id=host></main>");
  const host = dom.window.document.querySelector("#host") as unknown as HTMLElement;
  const controller = createMap(host, {
    initialSpec: spec,
    loadScene: () => ResultAsync.fromSafePromise(Promise.resolve(scene)),
  });
  await controller.setSpec(spec);
  assertEquals(host.querySelectorAll("path[data-land]").length, 1);
  assertEquals(host.querySelectorAll("circle[data-marker]").length, 1);
  assertEquals(host.querySelector("text[data-label]")?.textContent, "Fixture");
  await controller.setSpec(spec);
  assertEquals(host.querySelectorAll("svg[data-cloudmappr]").length, 1);
  controller.destroy();
  assertEquals(host.querySelectorAll("svg[data-cloudmappr]").length, 0);
});

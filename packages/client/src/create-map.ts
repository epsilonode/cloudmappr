import { select } from "d3-selection";
import type { ResultAsync } from "neverthrow";
import type { MapFailure, MapScene, MapSpec } from "../../core/mod.ts";

export type MapController = Readonly<{
  readonly setSpec: (spec: MapSpec) => Promise<void>;
  readonly destroy: () => void;
}>;
export type CreateMapOptions = Readonly<{
  readonly initialSpec: MapSpec;
  readonly loadScene: (spec: MapSpec) => ResultAsync<MapScene, MapFailure>;
  readonly onFailure?: (failure: MapFailure) => void;
  readonly onPointClick?: (id: string) => void;
}>;

const renderScene = (
  host: HTMLElement,
  scene: MapScene,
  onPointClick: ((id: string) => void) | undefined,
): void => {
  const svg = select(host).selectAll<SVGSVGElement, MapScene>("svg[data-cloudmappr]")
    .data([scene])
    .join("svg")
    .attr("data-cloudmappr", "true")
    .attr("viewBox", (value) => `0 0 ${value.width} ${value.height}`)
    .attr("role", "img")
    .attr("aria-label", "Cloudmappr map");
  svg.selectAll<SVGPathElement, MapScene["land"][number]>("path[data-land]")
    .data(scene.land, (value) => value.id)
    .join("path")
    .attr("data-land", (value) => value.id)
    .attr("d", (value) => value.path)
    .attr("fill", "#d1d9de")
    .attr("stroke", "#6f7f88");
  svg.selectAll<SVGCircleElement, MapScene["markers"][number]>("circle[data-marker]")
    .data(scene.markers, (value) => value.id)
    .join("circle")
    .attr("data-marker", (value) => value.id)
    .attr("cx", (value) => value.x)
    .attr("cy", (value) => value.y)
    .attr("r", 4)
    .attr("fill", (value) => value.color)
    .attr("tabindex", 0)
    .attr("role", "button")
    .on("click", (_event, value) => onPointClick?.(value.id))
    .on("keydown", (event, value) => {
      if (event.key === "Enter" || event.key === " ") onPointClick?.(value.id);
    });
  svg.selectAll<SVGTextElement, MapScene["labels"][number]>("text[data-label]")
    .data(scene.labels, (value) => value.id)
    .join("text")
    .attr("data-label", (value) => value.id)
    .attr("x", (value) => value.x)
    .attr("y", (value) => value.y)
    .attr("fill", (value) => value.color)
    .text((value) => value.text);
};

export const createMap = (host: HTMLElement, options: CreateMapOptions): MapController => {
  const controller = new AbortController();
  const setSpec = async (spec: MapSpec): Promise<void> => {
    const result = await options.loadScene(spec);
    if (controller.signal.aborted) return;
    if (result.isErr()) {
      options.onFailure?.(result.error);
      return;
    }
    renderScene(host, result.value, options.onPointClick);
  };
  void setSpec(options.initialSpec);
  return {
    setSpec,
    destroy: () => {
      controller.abort();
      select(host).selectAll("svg[data-cloudmappr]").remove();
    },
  };
};

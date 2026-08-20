import { geoMercator, geoPath } from "d3-geo";
import { err, ok, type Result } from "neverthrow";

export type GeoBounds = readonly [number, number, number, number];
export type Theme = "light" | "dark";
export type MapPoint = Readonly<{
  readonly id: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly label?: string;
  readonly priority?: number;
  readonly category?: "default" | "accent";
  readonly color?: "blue" | "red" | "green";
}>;
export type MapLabel = Readonly<{
  readonly id: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly text: string;
  readonly priority?: number;
  readonly category?: "default" | "accent";
  readonly color?: "blue" | "red" | "green";
}>;
export type MapSpec = Readonly<{
  readonly version: 1;
  readonly bounds: GeoBounds;
  readonly width: number;
  readonly height: number;
  readonly theme?: Theme;
  readonly points?: readonly MapPoint[];
  readonly labels?: readonly MapLabel[];
}>;
export type CanonicalMapSpec = Readonly<{
  readonly version: 1;
  readonly bounds: GeoBounds;
  readonly width: number;
  readonly height: number;
  readonly theme: Theme;
  readonly points: readonly MapPoint[];
  readonly labels: readonly MapLabel[];
}>;
export type MapFailure = Readonly<{
  readonly kind: "invalid_spec" | "invalid_geometry" | "artifact";
  readonly message: string;
}>;
export type LandGeometry = Readonly<{ readonly id: string; readonly geometry: unknown }>;
export type MapScene = Readonly<{
  readonly width: number;
  readonly height: number;
  readonly theme: Theme;
  readonly land: readonly Readonly<{ readonly id: string; readonly path: string }>[];
  readonly markers: readonly Readonly<{ readonly id: string; readonly x: number; readonly y: number; readonly color: string }>[];
  readonly labels: readonly Readonly<{ readonly id: string; readonly x: number; readonly y: number; readonly text: string; readonly color: string }>[];
}>;

const maxDimension = 4096;
const maxLayerItems = 250;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validCoordinates = (longitude: unknown, latitude: unknown): boolean =>
  finite(longitude) && finite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
const isBounds = (value: unknown): value is GeoBounds =>
  Array.isArray(value) && value.length === 4 && validCoordinates(value[0], value[1]) &&
  validCoordinates(value[2], value[3]) && value[1] <= value[3];
const supportedColor = (value: unknown): value is NonNullable<MapPoint["color"]> =>
  value === undefined || value === "blue" || value === "red" || value === "green";
const colorValue = (color: MapPoint["color"]): string =>
  color === "red" ? "#c62828" : color === "green" ? "#157f3b" : "#1769aa";
const rounded = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;
const failure = (message: string): Result<never, MapFailure> => err({ kind: "invalid_spec", message });

const parsePoint = (value: unknown): Result<MapPoint, MapFailure> => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "longitude", "latitude", "label", "priority", "category", "color"]) || typeof value.id !== "string" || value.id.trim().length === 0 ||
    !validCoordinates(value.longitude, value.latitude) ||
    (value.label !== undefined && typeof value.label !== "string") ||
    (value.priority !== undefined && !finite(value.priority)) || !supportedColor(value.color) ||
    (value.category !== undefined && value.category !== "default" && value.category !== "accent")) {
    return failure("A point has unsupported fields or invalid geographic coordinates.");
  }
  return ok({ id: value.id, longitude: rounded(value.longitude as number), latitude: rounded(value.latitude as number), ...typeof value.label === "string" ? { label: value.label.slice(0, 120) } : {}, ...finite(value.priority) ? { priority: rounded(value.priority) } : {}, ...value.category === "default" || value.category === "accent" ? { category: value.category } : {}, ...supportedColor(value.color) && value.color !== undefined ? { color: value.color } : {} });
};

const parseLabel = (value: unknown): Result<MapLabel, MapFailure> => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "longitude", "latitude", "text", "priority", "category", "color"]) || typeof value.id !== "string" || value.id.trim().length === 0 ||
    typeof value.text !== "string" || value.text.trim().length === 0 ||
    !validCoordinates(value.longitude, value.latitude) ||
    (value.priority !== undefined && !finite(value.priority)) || !supportedColor(value.color) ||
    (value.category !== undefined && value.category !== "default" && value.category !== "accent")) {
    return failure("A label has unsupported fields or invalid geographic coordinates.");
  }
  return ok({ id: value.id, text: value.text.slice(0, 160), longitude: rounded(value.longitude as number), latitude: rounded(value.latitude as number), ...finite(value.priority) ? { priority: rounded(value.priority) } : {}, ...value.category === "default" || value.category === "accent" ? { category: value.category } : {}, ...supportedColor(value.color) && value.color !== undefined ? { color: value.color } : {} });
};

const parseLayer = <Item>(value: unknown, parser: (entry: unknown) => Result<Item, MapFailure>): Result<readonly Item[], MapFailure> => {
  if (value === undefined) return ok([]);
  if (!Array.isArray(value) || value.length > maxLayerItems) return failure("Map layers must be bounded arrays.");
  const parsed = value.map(parser);
  const rejected = parsed.find((entry) => entry.isErr());
  return rejected?.isErr() ? err(rejected.error) : ok(parsed.map((entry) => entry._unsafeUnwrap()));
};

const uniqueIds = (items: readonly Readonly<{ readonly id: string }>[]): boolean =>
  items.every((item, index) => items.findIndex((candidate) => candidate.id === item.id) === index);

export const validateMapSpec = (input: unknown): Result<MapSpec, MapFailure> => {
  if (!isRecord(input) || !hasOnlyKeys(input, ["version", "bounds", "width", "height", "theme", "points", "labels"]) || input.version !== 1 || !isBounds(input.bounds) || !finite(input.width) || !finite(input.height) ||
    input.width < 1 || input.height < 1 || input.width > maxDimension || input.height > maxDimension ||
    (input.theme !== undefined && input.theme !== "light" && input.theme !== "dark")) return failure("MapSpec has invalid version, bounds, dimensions, or theme.");
  const points = parseLayer(input.points, parsePoint);
  const labels = parseLayer(input.labels, parseLabel);
  return points.isErr() ? err(points.error) : labels.isErr() ? err(labels.error) :
    !uniqueIds(points.value) || !uniqueIds(labels.value) ? failure("Point and label IDs must be unique within their layers.") :
    ok({ version: 1, bounds: input.bounds, width: Math.round(input.width), height: Math.round(input.height), ...input.theme === "light" || input.theme === "dark" ? { theme: input.theme } : {}, ...points.value.length > 0 ? { points: points.value } : {}, ...labels.value.length > 0 ? { labels: labels.value } : {} });
};

export const canonicalizeMapSpec = (spec: MapSpec): CanonicalMapSpec => ({
  version: 1,
  bounds: [rounded(spec.bounds[0]), rounded(spec.bounds[1]), rounded(spec.bounds[2]), rounded(spec.bounds[3])],
  width: spec.width,
  height: spec.height,
  theme: spec.theme ?? "light",
  points: [...(spec.points ?? [])].sort((first, second) => first.id.localeCompare(second.id)),
  labels: [...(spec.labels ?? [])].sort((first, second) => first.id.localeCompare(second.id)),
});

export const canonicalMapSpecJson = (spec: CanonicalMapSpec): string => JSON.stringify(spec);

export const buildMapScene = (spec: CanonicalMapSpec, land: readonly LandGeometry[]): Result<MapScene, MapFailure> => {
  const projection = geoMercator().fitSize([spec.width, spec.height], { type: "Sphere" });
  const path = geoPath(projection);
  const landPaths = land.map((item) => ({ id: item.id, path: path(item.geometry as never) }));
  const missing = landPaths.find((item) => item.path === null);
  return missing !== undefined ? err({ kind: "invalid_geometry", message: `Land ${missing.id} cannot be projected.` }) : ok({
    width: spec.width,
    height: spec.height,
    theme: spec.theme,
    land: landPaths.map((item) => ({ id: item.id, path: item.path ?? "" })),
    markers: spec.points.flatMap((point) => {
      const position = projection([point.longitude, point.latitude]);
      return position === null ? [] : [{ id: point.id, x: rounded(position[0]), y: rounded(position[1]), color: colorValue(point.color) }];
    }),
    labels: spec.labels.flatMap((label) => {
      const position = projection([label.longitude, label.latitude]);
      return position === null ? [] : [{ id: label.id, x: rounded(position[0] + 6), y: rounded(position[1] - 6), text: label.text, color: colorValue(label.color) }];
    }),
  });
};

const escapeXml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

export const serializeSceneToSvg = (scene: MapScene): string => {
  const background = scene.theme === "dark" ? "#102027" : "#f7fbff";
  const land = scene.land.map((item) => `<path data-land="${escapeXml(item.id)}" d="${item.path}" fill="#d1d9de" stroke="#6f7f88" stroke-width="0.5"/>`).join("");
  const markers = scene.markers.map((item) => `<circle data-marker="${escapeXml(item.id)}" cx="${item.x}" cy="${item.y}" r="4" fill="${item.color}"/>`).join("");
  const labels = scene.labels.map((item) => `<text data-label="${escapeXml(item.id)}" x="${item.x}" y="${item.y}" fill="${item.color}" font-family="system-ui, sans-serif" font-size="12">${escapeXml(item.text)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cloudmappr map" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}"><rect width="100%" height="100%" fill="${background}"/><g data-layer="land">${land}</g><g data-layer="markers">${markers}</g><g data-layer="labels">${labels}</g></svg>`;
};

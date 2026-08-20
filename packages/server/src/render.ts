import { Resvg } from "@resvg/resvg-js";
import { err, ok, ResultAsync } from "neverthrow";
import {
  buildMapScene,
  canonicalizeMapSpec,
  canonicalMapSpecJson,
  serializeSceneToSvg,
  validateMapSpec,
  type CanonicalMapSpec,
  type LandGeometry,
  type MapFailure,
} from "../../core/mod.ts";

export type RenderFailure = Readonly<{ readonly kind: "invalid_request" | "geometry" | "storage" | "raster"; readonly message: string }>;
export type RenderRecord = Readonly<{ readonly id: string; readonly svg: Uint8Array; readonly png: Uint8Array }>;
export type LandProvider = Readonly<{ readonly load: (spec: CanonicalMapSpec) => ResultAsync<readonly LandGeometry[], RenderFailure> }>;
export type RenderStore = Readonly<{
  readonly read: (id: string, format: "svg" | "png") => ResultAsync<Uint8Array | undefined, RenderFailure>;
  readonly write: (record: RenderRecord) => ResultAsync<void, RenderFailure>;
}>;
export type RenderServiceConfig = Readonly<{
  readonly release: string;
  readonly provider: LandProvider;
  readonly store: RenderStore;
  readonly baseUrl?: string;
}>;

const rendererVersion = "cloudmappr-v1";
const text = new TextEncoder();
const renderFailure = (kind: RenderFailure["kind"], message: string): RenderFailure => ({ kind, message });
const mapFailure = (failure: MapFailure): RenderFailure => renderFailure("invalid_request", failure.message);
const toHex = (bytes: ArrayBuffer): string => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const renderIdentity = async (spec: CanonicalMapSpec, release: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", text.encode(JSON.stringify({ spec: canonicalMapSpecJson(spec), release, rendererVersion, style: "builtin-v1", projection: "mercator-fit-sphere-v1" }))));

const rasterize = (svg: string): ResultAsync<Uint8Array, RenderFailure> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng()),
    () => renderFailure("raster", "Canonical SVG could not be rasterized."),
  );

export const renderCanonical = (input: unknown, config: RenderServiceConfig): ResultAsync<RenderRecord, RenderFailure> => {
  const validated = validateMapSpec(input);
  if (validated.isErr()) return ResultAsync.fromSafePromise(Promise.resolve(err(mapFailure(validated.error)))).andThen((result) => result);
  const spec = canonicalizeMapSpec(validated.value);
  return ResultAsync.fromPromise(renderIdentity(spec, config.release), () => renderFailure("storage", "Render identity could not be calculated.")).andThen((id) =>
    config.provider.load(spec).andThen((land) => {
      const scene = buildMapScene(spec, land);
      if (scene.isErr()) return ResultAsync.fromSafePromise(Promise.resolve(err(mapFailure(scene.error)))).andThen((result) => result);
      const svg = serializeSceneToSvg(scene.value);
      return rasterize(svg).map((png) => ({ id, svg: text.encode(svg), png }));
    })
  );
};

export const createFilesystemRenderStore = (root: string): RenderStore => ({
  read: (id, format) => ResultAsync.fromPromise(
    Deno.readFile(`${root}/${id}.${format}`).catch((error: unknown) =>
      error instanceof Deno.errors.NotFound ? undefined : Promise.reject(error)
    ),
    () => renderFailure("storage", "Stored render could not be read."),
  ),
  write: (record) => ResultAsync.fromPromise(
    Deno.mkdir(root, { recursive: true }).then(() => Promise.all([
      Deno.writeFile(`${root}/${record.id}.svg`, record.svg),
      Deno.writeFile(`${root}/${record.id}.png`, record.png),
    ])).then(() => undefined),
    () => renderFailure("storage", "Canonical render could not be stored."),
  ),
});

const response = (status: number, body: string | Uint8Array, contentType: string, immutable = false): Response =>
  new Response(typeof body === "string" ? body : new Uint8Array(body), { status, headers: { "content-type": contentType, "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-store" } });
const errorResponse = (failure: RenderFailure): Response => response(failure.kind === "invalid_request" ? 400 : 500, JSON.stringify({ error: failure.kind }), "application/json");

export const createRenderApi = (config: RenderServiceConfig): ((request: Request) => Promise<Response>) => async (request) => {
  const url = new URL(request.url);
  const post = request.method === "POST" && url.pathname === "/v1/renders";
  const match = /^\/v1\/renders\/([a-f0-9]{64})\.(svg|png)$/.exec(url.pathname);
  if (post) {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > 100_000) return response(413, JSON.stringify({ error: "invalid_request" }), "application/json");
    const body = await request.text();
    if (body.length > 100_000) return response(413, JSON.stringify({ error: "invalid_request" }), "application/json");
    const parsed = await Promise.resolve().then(() => JSON.parse(body)).then(ok).catch(() => err(renderFailure("invalid_request", "Request body must be JSON.")));
    if (parsed.isErr()) return errorResponse(parsed.error);
    const record = await renderCanonical(parsed.value, config);
    if (record.isErr()) return errorResponse(record.error);
    const stored = await config.store.write(record.value);
    return stored.isErr() ? errorResponse(stored.error) : response(201, JSON.stringify({ id: record.value.id, svgUrl: `${config.baseUrl ?? ""}/v1/renders/${record.value.id}.svg`, pngUrl: `${config.baseUrl ?? ""}/v1/renders/${record.value.id}.png` }), "application/json");
  }
  if (request.method === "GET" && match !== null) {
    const [, id, format] = match;
    if (id === undefined || (format !== "svg" && format !== "png")) return response(404, "Not found", "text/plain");
    const stored = await config.store.read(id, format);
    return stored.isErr() ? errorResponse(stored.error) : stored.value === undefined ? response(404, "Not found", "text/plain") : response(200, stored.value, format === "svg" ? "image/svg+xml" : "image/png", true);
  }
  return response(404, "Not found", "text/plain");
};

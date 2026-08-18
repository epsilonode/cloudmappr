---
id: cloudmappr-isomorphic-baseline-implementation-plan
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#canonical-cloud-image-rendering
  - roadmaps/cloudmappr.md#phased-implementation
  - roadmaps/cloudmappr.md#parity-and-delivery-evidence
hook: "detailed handoff plan; read before implementing Cloudmappr baseline, creating flights, or changing client/server rendering boundaries"
---

# Isomorphic Baseline Implementation Plan

## Product Objective

Cloudmappr is a global map product that serves two equal use cases. First, a
browser MJS map editor/component lets users compose a map, render it with D3,
add geographic points/labels, embed it in any framework, and save or copy an
image. Second, the same composition can be sent to Deno for a canonical SVG/PNG
render URL that is suitable for social media, messaging, embeds, and other users
who only need the image.

The shareable server PNG is authoritative. Browser local exports are convenient
but can differ at pixel level due to font and canvas rasterization differences.
The browser and server must instead be semantically identical: same validated
MapSpec, world-data release, projection, scene geometry, layers, styles, text,
and output dimensions.

## Explicit Non-Goals

- Do not build Cloudmappr in the Corfeed repository or depend on Corfeed code.
- Do not make MapLibre, PMTiles, a tile protocol, streamed geometry, or a spatial
  database part of the initial delivery.
- Do not accept arbitrary SVG, CSS, JavaScript, fonts, image URLs, or screen
  coordinates from render callers.
- Do not support arbitrary runtime projection changes in version 1.
- Do not adopt pre-rendered SVG land until its experiment proves it superior to
  TopoJSON/D3 without reducing parity or fidelity.

## Repository Shape

Start at `c:/proj/cloudmappr`. Keep pure/browser-safe code physically separate
from browser DOM and Deno HTTP/raster logic.

```text
packages/
  core/          MapSpec, validation, canonicalization, projection, scene model
  world-data/    source provenance, shard generator, manifest, emitted artifacts
  client/        MJS createMap controller and optional thin adapters
  server/        Deno HTTP handlers, artifact resolver, SVG/PNG renderer
```

The package layout may begin as source folders if workspaces add needless setup,
but dependency direction is fixed: client and server import core/world-data;
core imports neither; client does not import server; server does not import the
browser DOM.

## Shared Map Specification

Use one JSON-safe versioned format. Version 1 requires bounds and dimensions so
the server can bootstrap an image without UI session state. Optional point/label
layers begin in the schema immediately to avoid a separate incompatible render
endpoint later.

```ts
type GeoBounds = readonly [west: number, south: number, east: number, north: number];

type MapPoint = Readonly<{
  id: string;
  longitude: number;
  latitude: number;
  label?: string;
  priority?: number;
  category?: string;
  color?: string;
}>;

type MapLabel = Readonly<{
  id: string;
  longitude: number;
  latitude: number;
  text: string;
  priority?: number;
  category?: string;
  color?: string;
}>;

type MapSpec = Readonly<{
  version: 1;
  bounds: GeoBounds;
  width: number;
  height: number;
  theme?: "light" | "dark";
  points?: readonly MapPoint[];
  labels?: readonly MapLabel[];
}>;
```

Validation checks finite longitude/latitude values, valid non-empty dimensions,
maximum raster dimensions, bounded array sizes, stable unique IDs, supported
categories/themes, allowed colors, text length, and antimeridian rules. It
rejects arbitrary style/script/svg fields. Canonicalization supplies defaults,
normalizes number precision and bounds representation, sorts unordered layers by
stable ID, and serializes a stable JSON representation for hashing.

## Projection And Scene Contract

Choose one global `d3-geo` projection and document its name, logical viewBox,
center, scale, translate, clip behavior, panning bounds, resize behavior, and
antimeridian policy before generating data artifacts. This contract is a versioned
renderer input, not an accidental browser layout implementation detail.

Core exposes:

```ts
validateMapSpec(input): MapSpec;
canonicalizeMapSpec(spec): CanonicalMapSpec;
selectWorldArtifacts(spec, manifest): readonly ArtifactId[];
buildMapScene(spec, decodedArtifacts, rendererConfig): MapScene;
serializeSceneToSvg(scene): string;
```

`MapScene` is semantic render data: projected land paths, marker paths/circles,
escaped text labels, layer order, styles, dimensions, and accessibility data.
Browser client code uses D3 selection to join scene records into SVG DOM. Server
code serializes the same scene to SVG and invokes a controlled Deno-compatible
SVG-to-PNG renderer. D3 selection is browser-only; `d3-geo` belongs in shared
core; `topojson-client` decodes released data before scene generation.

Land, markers, labels, and export all share the same projection. Client/server
callers submit geographic lon/lat, never screen pixels. Any future server overlay
also begins as MapSpec data and passes through the shared projector.

## World Data And Five Shards

The initial global layer is not one large file. Generate five standalone TopoJSON
artifacts from the World Atlas source:

1. `world-basemap`: all minor islands, including Micronesia, and land not assigned
   to a major group; it loads immediately.
2. `americas`: major North and South American land.
3. `afro-eurasia`: Africa, Europe, and Asia major land.
4. `oceania-major`: Australia, New Zealand, and assigned major Oceania land.
5. `antarctica`: Antarctic land.

Partition source multipart geometry into atomic land parts before group assignment
so no part is duplicated or omitted. Re-topologize each shard independently.
Each artifact contains all arcs it needs and can decode by itself with
`topojson-client`.

The manifest declares a release identity plus artifact ID, immutable URL, object
name, bbox, eager/lazy state, and optional size/integrity metadata. Bounds that
cross the antimeridian are split into two comparisons. Browser and server use one
selection function and must select identical artifact sets for a given MapSpec.

## Browser MJS Controller

Expose a framework-neutral controller:

```ts
const map = createMap(host, {
  manifestUrl,
  initialSpec,
  onPointClick,
});
```

The controller owns the root SVG, land/marker/label/control groups, D3 joins,
projection/camera, resize observer, fetch cache, event listeners, transitions,
and cleanup. Consumers own business data and compose MapSpec inputs.

The load sequence is:

1. Fetch/cache the versioned manifest.
2. Decode/render the eager world basemap.
3. Normalize initial bounds and select missing major shards.
4. Fetch/decode/render selected shards with one shared promise per immutable URL.
5. Join land records by stable path ID in manifest order, not network completion.
6. Project and join points, markers, and labels by stable ID.
7. On bounds or overlay change, update camera/overlays and fetch only missing data.
8. On destroy, cancel map-owned work, disconnect observers, remove listeners, and
   clear generated DOM.

Browser labels begin with deterministic offsets and explicit priorities. Markers
remain visible if labels are suppressed. A collision engine is a later enhancement
only after deterministic export requirements are understood.

## Canonical Deno Render Service

Deno owns validation, canonical image creation, content-addressed caching, and
public image delivery. It does not execute client code or trust client SVG.

```text
POST /v1/renders
  MapSpec -> validation -> canonical spec -> artifact release -> hash
  -> load/decode artifacts -> build scene -> SVG -> canonical PNG
  -> response containing immutable SVG and PNG URLs

GET /v1/renders/:id.svg
GET /v1/renders/:id.png
```

The render hash includes canonical MapSpec JSON, selected output format,
dimensions, theme, projection configuration, font/style configuration, renderer
version, and world-data manifest release. The same identity always maps to the
same stored/generated output. Canonical results are safe to cache immutably and
to embed directly in media without JavaScript.

PNG rendering is mandatory. SVG is the canonical vector output. Server WebP is
deferred until a Deno-compatible encoder has explicit compatibility, alpha,
quality, font, and output tests. Apply request limits before geometry/raster work:
bounds validity, output area, input bytes, point/label counts, render duration,

## Export, Sharing, And Framework Consumers

The client supports local SVG export and browser PNG export from the assembled
scene. WebP is opportunistic: request it only when the browser returns an actual
WebP Blob and otherwise report/download PNG. Cap output dimensions because canvas
memory is width times height times four bytes before encoding.

For exact share/copy behavior, the client requests the server canonical render
and exposes its PNG URL. Copy-to-clipboard fetches that PNG and requires a user
gesture plus HTTPS ClipboardItem support. Download is the fallback if clipboard
write cannot occur.

The editor is one consumer. Plain MJS components in Svelte, React, or vanilla
applications use the same `createMap` API. Any future adapters or Custom Element
only translate lifecycle/props; they do not fork scene construction, rendering,
export, or canonical render logic.

## GitHub And esm.sh Release Flow

GitHub stores source and generated release artifacts. Build automation generates
MJS entries, five TopoJSON artifacts, and the release manifest; it runs coverage
and manifest validation before publishing a public release reference.

esm.sh serves the public GitHub controller/manifest MJS entries. Use one immutable
reference so controller, manifest, and shard URLs are compatible. The controller
does not import all world geometry; it resolves lazy URLs from the manifest. Deno
uses the identical released manifest, not a mutable branch or unrelated asset set.

## Implementation Sequence

1. Initialize Cloudmappr repository/tooling and its project ledger.
2. Define MapSpec, validation, canonical JSON/hash behavior, projection/viewBox,
   manifest schema, and fixture data.
3. Implement shared artifact selection, TopoJSON-to-GeoJSON decoding, and scene
   construction independently of DOM or HTTP.
4. Extract/build the MJS D3 browser controller against a one-shard fixture,
   including accessibility, cleanup, bounds, points, labels, and focus.
5. Build world-data partition tooling, five artifacts, and exact coverage proof.
6. Add lazy artifact loading, immutable URL caches, antimeridian selection, and
   regional/full-world browser fixtures.
7. Implement Deno SVG output from the shared scene, then canonical PNG rendering,
   content-addressed storage/cache, render API routes, and standalone image proof.
8. Add client local export, canonical render request/share/copy actions, then a
   clean framework consumer fixture.
9. Only after baseline proof, consider adapters, Custom Element, collision layout,
   WebP server output, or SVG pre-render experimentation.

## Required Proof

- Unit tests for validation, canonicalization, hash identity, bounds normalization,
  antimeridian splitting, artifact selection, and cache de-duplication.
- Data tests proving each atomic land part appears once, all five shards decode,
  and their union matches the unsplit source.
- Browser DOM tests for eager/lazy mounting, stable joins, panning, focus, points,
  labels, keyboard activation, resize, and repeated create/destroy cycles.
- Shared-core parity tests proving browser and Deno receive the same scene geometry,
  overlay coordinates, styles, and selected world-data release for one MapSpec.
- Render API tests proving immutable SVG/PNG URL behavior, cache reuse, input
  limits, no JavaScript image dependency, and standalone PNG media display.
- Export tests for SVG, PNG, local WebP fallback, canonical PNG copy/download, and
  no canvas taint from first-party assets.
- GitHub/esm.sh consumer proof that controller import does not eagerly fetch all
  world data and that dynamic artifacts resolve from one release set.

## Experimental SVG Boundary

The pre-rendered SVG land concept remains deferred. It must prove upstream
TopoJSON conversion fidelity, exact alignment with D3-projected dynamic points
and labels, artifact/network/parse/render advantage, server export parity, and
lifecycle benefits before it can replace any baseline TopoJSON/D3 behavior.

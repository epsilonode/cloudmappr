# cloudmappr

@roadmap cloudmappr
@log ../logs/cloudmappr.logfmt
@meta name=roadmap-format content="../format-guidance.md"
@meta name=memory-format content="../making-memories.md"
@meta name=ledger-router content="../control.yaml"
@meta name=discovery-guidance content="../discovery-guidance.md"
@meta name=roadmap-status content="active"
@updated 2026-08-18 @summary
Cloudmappr is an isomorphic world-map product: a browser MJS editor/component and
a Deno rendering API use one declarative map specification and the same released
world data to deliver interactive SVG maps and canonical shareable images.

## @tier8 active baseline

### @work @active isomorphic mjs d3 world map

@scope baseline product runtime @target Deliver the first Cloudmappr product as
a framework-neutral MJS D3 world map with static TopoJSON shards and a matching
server-rendered image API.

@memory ../memories/cloudmappr/strategy/isomorphic-baseline-implementation-plan.md
@memory ../memories/cloudmappr/contracts/map-spec-and-scene.md
@memory ../memories/cloudmappr/contracts/overlay-projection-parity.md
@memory ../memories/cloudmappr/strategy/world-topojson-shards.md
@memory ../memories/cloudmappr/strategy/github-esm-artifact-delivery.md
@memory ../memories/cloudmappr/strategy/map-component-migration-completeness.md

- [ ] @accept export a framework-neutral `createMap(host, options)` MJS entry;
      map coverage is global and is not tied to Corfeed or any UI framework
- [ ] @accept use D3 selection and `d3-geo` for SVG map rendering and use
      `topojson-client` to decode released TopoJSON shards before rendering
- [ ] @accept load one eager minor-island basemap plus four lazy major-land
      shards selected by viewport bounds and cached by immutable artifact URL
- [ ] @accept define one versioned `MapSpec` that drives browser rendering,
      server SVG/PNG rendering, image sharing, and future framework adapters
- [ ] @accept require a geographic bounding box in the first renderable spec and
      reserve validated points, labels, categories, and colors in the same model
- [ ] @accept use one projection, logical viewBox, antimeridian policy, map-data
      release, and scene order for all client/server rendering paths
- [ ] @accept keep pre-rendered SVG land paths out of this baseline until their
      upstream conversion and comparative delivery proof is accepted

### @work @active canonical cloud image rendering

@scope shareable map output @target A user can compose a map in the client and
receive an immutable cloud-rendered image link for media, messaging, and embeds.

@memory ../memories/cloudmappr/contracts/canonical-render-api.md
@memory ../memories/cloudmappr/strategy/client-export-and-sharing.md
@memory ../memories/cloudmappr/contracts/overlay-projection-parity.md

- [ ] @accept `POST /v1/renders` accepts a validated `MapSpec`, canonicalizes it,
      and returns content-addressed canonical SVG and PNG URLs
- [ ] @accept `GET /v1/renders/:id.svg` and `GET /v1/renders/:id.png` return
      immutable output rendered from the declared spec and artifact release
- [ ] @accept PNG is a hard server-side requirement; SVG is the canonical vector
      representation; server WebP is optional until a compatible encoder is proven
- [ ] @accept a shared map URL can display the PNG without downloading or running
      the MJS component
- [ ] @accept Deno renders server output with the same scene construction and
      projection contract as the browser, not from arbitrary client SVG
- [ ] @accept render identity includes canonical spec, output dimensions, theme,
      renderer version, fonts/styles, and released world-data manifest version

## @tier6 active contracts

### @contract @active map spec and scene model

@scope browser/server interchange @target Map composition is declarative, safe,
versioned, and sufficient for client editing as well as server rendering.

@memory ../memories/cloudmappr/contracts/map-spec-and-scene.md
@memory ../memories/cloudmappr/contracts/overlay-projection-parity.md
@memory ../memories/cloudmappr/contracts/label-placement-and-visibility.md

- [ ] @accept `MapSpec` has a format version, geographic bounds, output size,
      theme/style selection, and optional point and label layer arrays
- [ ] @accept points and labels use stable IDs, longitude/latitude, escaped text,
      explicit priority, and bounded category/color values
- [ ] @accept client/server share `validateMapSpec`, `canonicalizeMapSpec`,
      `buildMapScene`, and SVG serialization contracts from browser-safe code
- [ ] @accept scene layers render in deterministic order: land, markers, labels,
      and controls/overlays
- [ ] @accept the API rejects malformed bounds, excessive output dimensions,
      unbounded layer counts, arbitrary CSS, scripts, and arbitrary SVG payloads

### @contract @active world artifact manifest

@scope global map data @target Five standalone artifacts compose the global land
layer with lazy loading and reproducible server/client selection.

@memory ../memories/cloudmappr/strategy/world-topojson-shards.md
@memory ../memories/cloudmappr/strategy/github-esm-artifact-delivery.md
@memory ../memories/cloudmappr/contracts/world-artifact-provenance.md

- [ ] @accept generate `world-basemap`, `americas`, `afro-eurasia`,
      `oceania-major`, and `antarctica` as independent TopoJSON files
- [ ] @accept minor islands, including Micronesia, remain in the eager basemap;
      every atomic source land part appears in exactly one of five artifacts
- [ ] @accept the manifest declares artifact ID, URL, geographic bbox, object
      name, eager/lazy state, and world-data release identity
- [ ] @accept client and server select the same shards for the same normalized
      bounds, including bounds crossing the antimeridian

### @contract @active browser composition and export

@scope browser component use cases @target The editor is not the sole product;
plain map components work in any UI framework and may export/copy images.

@memory ../memories/cloudmappr/strategy/client-export-and-sharing.md
@memory ../memories/cloudmappr/contracts/overlay-projection-parity.md
@memory ../memories/cloudmappr/contracts/custom-element-wrapper.md
@memory ../memories/cloudmappr/contracts/map-presentation-and-accessibility.md
@memory ../memories/cloudmappr/contracts/label-placement-and-visibility.md
@memory ../memories/cloudmappr/contracts/svelte-wrapper-boundary.md

- [ ] @accept consumers can set bounds, points, labels, categories, and colors
      through MJS controller inputs without importing business/domain code
- [ ] @accept the component supports local SVG export and browser PNG export
      with dimension limits, plus optional WebP with PNG fallback
- [ ] @accept copy-to-clipboard runs only with a user gesture and HTTPS-capable
      Clipboard APIs, with download as a reliable fallback
- [ ] @accept callers can request the cloud canonical render and use its PNG URL
      for identical shared output rather than trusting local canvas rasterization
- [ ] @accept thin adapters for UI frameworks or a Custom Element are optional;
      they wrap the MJS controller and do not own rendering logic
- [ ] @accept a Svelte wrapper remains an optional consumer-layer adapter over
      the public MJS controller; it does not add SvelteKit or move map behavior
      into components, stores, or routes

### @contract @active component quality and provenance

@scope framework-neutral integration, accessibility, source lineage, and label
behavior @target Preserve generic map quality requirements without importing
Corfeed application behavior or creating a second rendering implementation.

@memory ../memories/cloudmappr/strategy/map-component-migration-completeness.md
@memory ../memories/cloudmappr/contracts/custom-element-wrapper.md
@memory ../memories/cloudmappr/contracts/map-presentation-and-accessibility.md
@memory ../memories/cloudmappr/contracts/world-artifact-provenance.md
@memory ../memories/cloudmappr/contracts/label-placement-and-visibility.md
@memory ../memories/cloudmappr/contracts/overlay-projection-parity.md

- [ ] @accept an optional `<cloudmappr-map>` is a thin MJS-controller wrapper
      with connection-safe property updates, idempotent registration, teardown,
      Shadow DOM isolation, and bubbling composed point events
- [ ] @accept CSS custom properties, host sizing, zero-size startup, resize,
      light/dark defaults, focus indication, and reduced-motion behavior preserve
      presentation without mutating the document-global theme
- [ ] @accept the SVG has an accessible name; only actionable markers are
      keyboard focusable; land and labels are not tab stops; pointer and marker
      interactions remain distinct
- [ ] @accept each world-data release records source/license/version/checksum,
      generator/tool versions, partition rationale, and immutable artifact
      provenance; regeneration tooling remains outside runtime dependencies
- [ ] @accept labels retain stable IDs, priority, and deterministic initial
      offsets; polygon anchor generation and collision layout remain separate;
      suppressed labels never hide their markers

## @tier4 implementation and proof

### @work @ready phased implementation

@scope delivery order @target Build reusable scene logic before deployment/UI
adapters so browser and server behavior cannot drift.

@memory ../memories/cloudmappr/strategy/isomorphic-baseline-implementation-plan.md
@memory ../memories/cloudmappr/strategy/map-component-migration-completeness.md
@memory ../memories/cloudmappr/strategy/runtime-and-functional-baseline.md

- [ ] @accept define public types, projection/viewBox policy, and fixture
      manifest before extracting any page-bound map behavior
- [ ] @accept implement shared spec validation, canonicalization, scene building,
      TopoJSON decoding, and D3 path generation before the MJS wrapper
- [ ] @accept implement the five-shard generator and exact-coverage proof before
      relying on lazy viewport selection
- [ ] @accept implement Deno SVG then PNG rendering from the same shared scene
      before exposing render URLs to the browser
- [ ] @accept add GitHub/esm.sh release delivery and a clean external consumer
      fixture before framework adapters or clipboard conveniences
- [x] @accept bootstrap the declared Deno runtime and record the functional,
      linting, and colocated-test baseline before creating source workspaces
      @evidence 2026-08-18: root `mise.toml` declares latest Deno; `mise run
      verify` passes Deno lint, functional ESLint, Deno type checking, and four
      colocated atomic/seam tests; `mise run test-live` passes the explicit live
      test convention
- [x] @accept migrate the generic Custom Element, presentation, accessibility,
      provenance, label, and deferred SVG-experiment planning contracts identified
      in `map-component-migration-completeness.md`
      @evidence 2026-08-18: component-quality-and-provenance now routes the four
      governing contracts; the deferred experiment remains governed by its own
      retained proof card

### @proof @ready parity and delivery evidence

@scope baseline acceptance @target Prove semantic and visual parity across the
editor, plain component use, server render service, and shared image URL.

@memory ../memories/cloudmappr/strategy/isomorphic-baseline-implementation-plan.md
@memory ../memories/cloudmappr/contracts/canonical-render-api.md

- [ ] @accept unit tests cover spec canonicalization, bbox normalization,
      antimeridian splits, manifest selection, hash identity, and cache de-duplication
- [ ] @accept DOM tests cover basemap/lazy shard mount, point/label updates,
      keyboard markers, resize, focus, and controller teardown
- [ ] @accept artifact tests prove no atomic land part is duplicated or omitted
      across five shards and each shard decodes independently
- [ ] @accept client and Deno fixtures produce the same scene geometry, marker,
      label, style, and world-data release selection for identical `MapSpec` input
- [ ] @accept canonical PNG URLs are stable cacheable image responses and render
      correctly when opened without JavaScript
- [ ] @accept client export tests verify SVG, PNG, WebP fallback, clipboard
      fallback, and canvas-safe assets

## @tier2 deferred experiments

### @work @deferred pre-rendered svg land paths

@scope alternative geometry delivery @target Evaluate pre-rendered SVG land only
after the TopoJSON/D3 baseline has delivery, export, and parity evidence.

@memory ../memories/cloudmappr/strategy/svg-pre-render-experiment.md

- [ ] @accept prove conversion from upstream TopoJSON into standalone SVG path
      artifacts preserves land coverage, antimeridian behavior, and geometry order
- [ ] @accept prove pre-rendered land aligns with runtime D3-projected points and
      labels under the same projection/viewBox contract
- [ ] @accept compare artifact size, network cost, parse work, render work,
      export parity, and lifecycle complexity against the active baseline
- [ ] @accept retain the D3/TopoJSON baseline unless the experiment has a measured
      advantage without reducing server/client map-spec fidelity

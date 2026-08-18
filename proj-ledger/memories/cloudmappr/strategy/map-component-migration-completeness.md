---
id: cloudmappr-map-component-migration-completeness
kind: strategy
status: complete
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#phased-implementation
  - roadmaps/cloudmappr.md#component-quality-and-provenance
hook: "read before importing generic map research; this records the completed Cloudmappr contract-migration gate"
---

# Map Component Migration Completeness

Cloudmappr owns the generic world-map product plan. The earlier Corfeed
`map-component` roadmap is background research only; do not import its Corfeed
application behavior, actor packaging, or deployment responsibilities.

## Required Generic Contracts To Migrate

### Custom Element

- Specify the optional `<cloudmappr-map>` wrapper over the proven MJS controller.
- Preserve Shadow DOM, property update before/after connection, teardown on
  disconnect, idempotent registration, and bubbling composed point events.
- Keep the wrapper free of rendering, data decoding, and API business logic.

### Presentation And Accessibility

- Define map CSS custom properties for background, land, labels, markers,
  selected markers, marker stroke, and focus indication.
- Define host-controlled sizing, initial zero-size behavior, resize handling,
  default light/dark legibility, and no document-global theme mutation.
- Require an SVG accessible name, keyboard point activation, non-tabstop land and
  labels, pointer/marker event separation, and reduced-motion behavior.

### Source And Artifact Provenance

- Record World Atlas/Natural Earth source provenance and the Atlas/Mapshaper
  generation workflow used for derived artifacts.
- Record generated artifact roles, source-to-shard partition rationale, and the
  difference between a permanent geometry crop and a visual SVG viewport clip.
- Keep regeneration tooling separate from browser/server runtime dependencies.

### Labels

- Preserve the research distinction between polygon anchor placement and
  cross-label collision resolution.
- Evaluate `polylabel` or equivalent only for deterministic build-time polygon
  anchors; it does not solve collisions.
- Keep explicit label ID/priority and deterministic initial offsets in baseline.
- Defer a receiver collision index such as RBush until it can preserve export
  determinism and marker visibility.

### Deferred SVG Fragment Experiment

- Carry forward the separate coordinate contract: one projection, viewBox,
  antimeridian policy, and transform for every fragment.
- Carry forward safe manifest/receiver requirements: fixed layer ordering,
  immutable artifact URLs, antimeridian selection, shared fetch cache, and only
  trusted generated SVG insertion.
- Carry forward SVG export requirements: an assembled root SVG is canonical;
  client PNG/WebP conversion must use explicit styles/assets and avoid tainted
  canvas sources.
- Retain this as an experiment. It cannot replace active TopoJSON/D3 rendering
  without conversion, alignment, size, performance, export, and lifecycle proof.

## Intentionally Excluded Corfeed Concerns

- Apify tokens, scrape actions, source chips, dialogs, browser token state, and
  Corfeed catalog/provider fields.
- Pacific-only page layout, stored Corfeed document theme, and direct `ui/app.ts`
  extraction mechanics.
- Actor runtime, Apify packaging, `dist-actor`, static Corfeed UI build split,
  deployment tasks, and wx-shells route ownership.

## Completed Migration Gate

The required generic concerns now have primary Cloudmappr contracts and are
routed from `component-quality-and-provenance`:

- `custom-element-wrapper.md` owns the optional wrapper boundary and lifecycle.
- `map-presentation-and-accessibility.md` owns visual tokens, sizing, interaction,
  and accessibility requirements.
- `world-artifact-provenance.md` owns source and generation lineage.
- `label-placement-and-visibility.md` owns deterministic label behavior.
- `svg-pre-render-experiment.md` remains the separate deferred experiment and its
  promotion proof.

Treat the long isomorphic baseline plan as the implementation source of truth.
This completed checklist preserves the split boundary: generic quality contracts
belong to Cloudmappr; Corfeed application behavior and deployment concerns do not.

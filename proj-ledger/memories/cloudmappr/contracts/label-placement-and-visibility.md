---
id: cloudmappr-label-placement-and-visibility
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#component-quality-and-provenance
  - roadmaps/cloudmappr.md#map-spec-and-scene-model
  - roadmaps/cloudmappr.md#browser-composition-and-export
hook: "read before changing label anchors, priority, visibility, collision behavior, or marker-label interactions"
---

# Label Placement And Visibility

Labels are declarative geographic overlays. Baseline placement must remain
deterministic so browser and server scenes agree even when canvas fonts or host
layout differ.

## Baseline Contract

- Every label has a stable ID, geographic longitude/latitude, escaped text, and
  an explicit or defaulted priority. Category and color resolve through the
  bounded style model defined by `MapSpec`.
- The scene applies documented deterministic offsets after projection. Inputs
  provide geographic coordinates, never screen coordinates or arbitrary SVG
  transforms.
- When a lower-priority label is suppressed, its marker remains visible and
  reachable. Labels complement marker activation; they do not replace it.
- Points with optional labels follow the same escaping, projection, priority, and
  visibility rules as standalone labels.

## Deferred Enhancements

- Polygon anchor placement and cross-label collision resolution are separate
  problems. A deterministic build-time polygon-anchor tool such as `polylabel`
  may be evaluated only for source-anchor generation; it does not solve runtime
  collisions.
- A receiver collision index such as RBush is deferred. It must prove stable,
  reproducible client/server/export output and marker visibility before entering
  the baseline.

## Required Proof

- Shared-scene fixtures prove labels use the same projected coordinates, styles,
  priority ordering, and escape rules in browser and Deno output.
- Browser tests cover deterministic updates, overlap suppression, keyboard marker
  access after label suppression, and stable joins keyed by label ID.

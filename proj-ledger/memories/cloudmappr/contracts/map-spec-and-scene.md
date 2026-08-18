---
id: cloudmappr-map-spec-and-scene
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#map-spec-and-scene-model
hook: "read before changing client/server map inputs, render identity, scene layers, or style validation"
---

# Map Spec And Scene

`MapSpec` is the only browser/server interchange format. Version 1 requires
geographic bounds and output dimensions, and supports optional theme, points,
labels, categories, and colors without any Corfeed-specific fields.

Points and labels use stable IDs and longitude/latitude. Text is escaped. Category
and color fields resolve through a bounded approved style model; consumers cannot
send arbitrary CSS, SVG, scripts, fonts, or URLs to the render service.

Shared browser-safe code validates and canonicalizes the spec, selects world
artifacts, builds the semantic scene, and serializes deterministic SVG. Browser
D3 consumes the scene as SVG DOM; Deno consumes the same scene for canonical SVG
and PNG. Layer order is land, markers, labels, then controls/overlays.

Canonical render identity includes normalized spec, dimensions, theme, renderer
version, fonts/styles, projection policy, and world-data release. The output hash
must change when any of these inputs changes.

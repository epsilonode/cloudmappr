---
id: cloudmappr-overlay-projection-parity
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#canonical-cloud-image-rendering
  - roadmaps/cloudmappr.md#map-spec-and-scene-model
  - roadmaps/cloudmappr.md#browser-composition-and-export
  - roadmaps/cloudmappr.md#component-quality-and-provenance
hook: "read before adding map points, labels, server overlays, focus behavior, or changing projection/viewBox settings"
---

# Overlay Projection Parity

Client and server overlays exchange geographic data only: stable ID, longitude,
latitude, optional escaped label, priority, category, and approved color. They
never exchange unqualified screen coordinates or arbitrary SVG fragments.

One `d3-geo` projection contract defines projection name, logical viewBox, center,
scale, translate, clipping, panning, resize behavior, and antimeridian handling.
Land paths, client points, client labels, server SVG, PNG output, focus targets,
and exported SVG all use it.

The controller renders keyed marker and label groups after land. Point activation
is keyboard and pointer accessible. A marker may remain visible if a lower-
priority label is hidden. Initial label placement uses deterministic offsets;
automatic collision layout is not a baseline dependency.

Browser canvas output can differ by font/raster implementation. The server PNG is
the authoritative identical share image; clients fetch that image for exact
sharing, copying, or media use.

---
id: cloudmappr-canonical-render-api
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#canonical-cloud-image-rendering
  - roadmaps/cloudmappr.md#parity-and-delivery-evidence
hook: "read before changing Deno render routes, image identity, storage, cache headers, or image formats"
---

# Canonical Render API

`POST /v1/renders` accepts a validated `MapSpec`, determines the released
world-data manifest, canonicalizes/hash-identifies the render, and returns SVG
and PNG URLs. It may render on first request and reuse content-addressed output
thereafter.

`GET /v1/renders/:id.svg` and `GET /v1/renders/:id.png` return immutable output.
The PNG URL must work as a standalone shared/media image without MJS, JavaScript,
or access to the map editor. Use long-lived immutable cache headers.

The Deno service builds SVG itself from shared scene code and trusted artifacts;
it never rasterizes arbitrary client-provided SVG. PNG is required. SVG is the
canonical vector representation. WebP is deferred until a Deno-compatible server
encoder has explicit output, font, and parity proof.

Enforce bounds, dimensions, point/label count, input size, and request-rate
limits before loading geometry or invoking the rasterizer.

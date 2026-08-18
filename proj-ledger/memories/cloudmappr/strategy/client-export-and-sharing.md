---
id: cloudmappr-client-export-and-sharing
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#canonical-cloud-image-rendering
  - roadmaps/cloudmappr.md#browser-composition-and-export
hook: "read before adding browser image export, clipboard copy, media sharing, or render-link UI"
---

# Client Export And Sharing

The MJS component supports local SVG export and browser PNG export from its
assembled scene. Local WebP may be offered only when `canvas.toBlob` returns a
WebP blob; otherwise it falls back to PNG. Dimension limits prevent excessive
browser raster memory use.

The cloud PNG is authoritative for sharing. After a user composes a `MapSpec`,
the component requests the canonical render and receives an immutable PNG URL.
That URL is appropriate for media posts, messages, embeds, and users who need an
image without loading Cloudmappr MJS.

Copy image requires a user gesture, HTTPS, and ClipboardItem support. Fetch the
canonical PNG for exact copy behavior. If the Clipboard API fails or is absent,
offer download of the same PNG as a fallback.

Framework adapters remain thin. They expose map composition and export/share
commands while delegating all rendering, spec, and image behavior to the MJS core.

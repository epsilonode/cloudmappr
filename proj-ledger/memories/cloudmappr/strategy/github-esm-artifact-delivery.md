---
id: cloudmappr-github-esm-artifact-delivery
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before changing GitHub releases, esm.sh imports, package entries, manifest URLs, or server artifact resolution"
---

# GitHub ESM Artifact Delivery

GitHub is the source and release-artifact surface. Build output publishes
compiled MJS controller entries, optional framework/Custom Element adapters, a
manifest entry, and separate world-data artifacts. TypeScript source is never the
browser runtime payload.

esm.sh delivers public GitHub modules through `/gh/<owner>/<repo>@<ref>`. Use one
immutable release reference for a compatible controller, manifest, and shard set.
The manifest owns dynamic artifact URLs; importing the controller never transfers
global geometry eagerly.

Release automation generates artifacts, validates exact world coverage and the
manifest, then publishes the reference clients and Deno resolve. The service must
not silently render a mutable branch or a different world-data release.

Browser module caching and controller fetch caches key by immutable URL. Render
URLs additionally encode the manifest/release identity in their content hash.

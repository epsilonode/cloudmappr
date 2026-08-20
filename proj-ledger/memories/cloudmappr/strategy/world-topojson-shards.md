---
id: cloudmappr-world-topojson-shards
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before generating world geometry, changing shard membership, or changing viewport artifact selection"
---

# World TopoJSON Shards

The baseline contains eight independently decodable TopoJSON files. The eager
`world-basemap` contains minor islands including Micronesia. The seven lazy
regional shards are `north-america`, `south-america`, `europe`, `africa`, `asia`,
`oceania-major`, and `antarctica`.

This granularity deliberately reduces the geometry that a regional browser view
and a bounded server image render decode and retain at once. It is a map-delivery
policy, not a server-rendering performance policy; broader render optimization is
considered separately.

## Assignment Policy

The generator owns a reviewed, versioned geographic partition policy. It must
not infer membership from a feature bounding box or apply a generic continent
field. Each source multipart geometry is first split into atomic land parts,
then deterministic seed paths, hard corridors, named geographic rules, and a
residual basemap fallback assign each part to exactly one of the eight artifacts.
The materialized output explains every choice. A source-release-scoped explicit
exception is allowed only when no geographic rule can express the intended
whole-part result.

`north-america` contains assigned major North American, Central American, and
Caribbean land; `south-america` contains assigned major South American land.
`europe`, `africa`, and `asia` replace the former combined Afro-Eurasian region.
`oceania-major` and `antarctica` retain their existing regional roles. Parts not
admitted to a major regional shard belong to the eager basemap through the named
residual fallback.

The generator partitions source multipolygons into atomic land parts before
assignment. Every part appears exactly once across all eight artifacts. Each shard
is re-topologized independently and cannot reference arcs or objects in another
file.

The released manifest declares ID, immutable URL, bbox, object name, eager/lazy
status, and release identity. Browser and Deno normalize requested bounds in the
same way, split antimeridian-crossing bounds, and select the same artifacts.

The browser fetches the basemap eagerly and caches pending/fulfilled lazy shard
loads by immutable URL. Deno renders against the same manifest release named in
the canonical render identity.

## Viewport And Resolution Policy

Panning is a camera interaction, not an availability constraint. The camera may
show any valid location, including open ocean, while the receiver selects the
eager basemap and viewport-relevant regional shards. It must never clamp, snap,
or hide a view merely because a lazy artifact is not yet decoded. The controller
uses viewport bounds for selection only; it retains already loaded shards and
adds a small geographic prefetch margin/hysteresis to prevent repeated loads at
a shard edge. It may abort superseded requests but must not remove already valid
geometry while a replacement request is in flight.

The released source is the Natural Earth / World Atlas 10m coastline-quality
source, not the former 110m candidate. The pinned `countries-10m` package
contains 255 country features and currently materializes 4,220 polygon parts,
so atomic polygons are a coverage and emission unit—not the review unit. Review
the seed/corridor policy, named geographic rules, and any exceptional parts;
materialize its inherited 10m assignments deterministically and prove exact
coverage. Do not approve the 282-part 110m candidate table for a 10m release.

Keep the eight delivery shards for the first 10m release. A typical regional view
needs the eager basemap plus one regional artifact; a boundary or zoomed-out view
may legitimately need several or all eight. Splitting further before measurement
would trade a small number of bounded requests for more URL, cache, and topology
overhead. Reconsider only after measuring compressed transfer, decode time, peak
memory, and path-generation time by shard at representative viewports.

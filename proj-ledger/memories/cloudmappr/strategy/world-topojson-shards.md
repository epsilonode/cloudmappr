---
id: cloudmappr-world-topojson-shards
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before generating world geometry, changing shard membership, or changing viewport artifact selection"
---

# World TopoJSON Shards

The baseline contains five independently decodable TopoJSON files: eager
`world-basemap` for minor islands including Micronesia, plus lazy `americas`,
`afro-eurasia`, `oceania-major`, and `antarctica` land clusters.

The generator partitions source multipolygons into atomic land parts before
assignment. Every part appears exactly once across all five artifacts. Each shard
is re-topologized independently and cannot reference arcs or objects in another
file.

The released manifest declares ID, immutable URL, bbox, object name, eager/lazy
status, and release identity. Browser and Deno normalize requested bounds in the
same way, split antimeridian-crossing bounds, and select the same artifacts.

The browser fetches the basemap eagerly and caches pending/fulfilled lazy shard
loads by immutable URL. Deno renders against the same manifest release named in
the canonical render identity.

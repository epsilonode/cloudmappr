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

The baseline contains eight independently decodable TopoJSON files. The eager
`world-basemap` contains minor islands including Micronesia. The seven lazy
regional shards are `north-america`, `south-america`, `europe`, `africa`, `asia`,
`oceania-major`, and `antarctica`.

This granularity deliberately reduces the geometry that a regional browser view
and a bounded server image render decode and retain at once. It is a map-delivery
policy, not a server-rendering performance policy; broader render optimization is
considered separately.

## Assignment Policy

The generator owns a reviewed, versioned source-part-to-shard assignment table.
It must not infer membership from a feature's bounding box or apply a generic
continent field without review. Each source multipart geometry is first split
into atomic land parts, then each part is assigned to exactly one of the eight
named artifacts. The table records decisions for transcontinental land, overseas
territories, and offshore parts so regeneration is deterministic.

`north-america` contains assigned major North American, Central American, and
Caribbean land; `south-america` contains assigned major South American land.
`europe`, `africa`, and `asia` replace the former combined Afro-Eurasian region.
`oceania-major` and `antarctica` retain their existing regional roles. Parts not
assigned to a major regional shard belong to the eager basemap only when the
assignment table explicitly records that role.

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

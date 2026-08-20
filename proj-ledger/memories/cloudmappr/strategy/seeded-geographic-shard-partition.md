---
id: cloudmappr-seeded-geographic-shard-partition
kind: strategy
status: ready
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before changing 10m atomic-part bucketing, regional seed policy, frontier expansion, or hard geographic cuts"
---

# Seeded Geographic Shard Partition Proposal

This proposal retains the eight delivery artifacts: eager `world-basemap` plus
lazy `north-america`, `south-america`, `europe`, `africa`, `asia`,
`oceania-major`, and `antarctica`. It replaces a one-row-per-atomic-polygon
review process with deterministic materialization from a small reviewed policy.
It is not yet an approved production assignment table.

## Partition Model

Each major shard has a fixed versioned geographic seed, a maximum seed-distance
budget, a maximum local frontier gap, and a named set of forbidden corridors.
Start from the seed's admitted land, then grow only through allowed adjacency or
short geodesic-frontier links. A polygon is admitted only if its path from the
seed remains inside the regional distance budget and does not cross a forbidden
corridor. Stable `(cost, seedId, polygonId)` ordering resolves ties.

All unadmitted polygons are placed in `world-basemap`. This bucket contains
residual land and minor islands; it does not contain ocean geometry.

```ts
type RegionPolicy = Readonly<{
  readonly id: ShardId
  readonly seed: readonly [longitude: number, latitude: number]
  readonly maxSeedDistanceKm: number
  readonly maxFrontierGapKm: number
  readonly forbiddenCorridors: readonly CorridorId[]
}>
```

Distance is an expansion constraint, never the only boundary rule. A rectangle
or unbounded nearest-neighbor chain can bridge small water gaps and merge regions
incorrectly.

## Proposed Hard Corridors

| Boundary | Prohibit expansion across |
| --- | --- |
| North America / South America | Panama–Colombia / Darién corridor |
| Europe / Africa | Gibraltar, Mediterranean, Sicily/Malta, Aegean, eastern Mediterranean |
| Africa / Asia | Suez/Sinai, Red Sea, Gulf of Suez |
| Europe / Asia | Ural–Ural River–Caspian–Caucasus–Black Sea–Turkish Straits |
| Asia / Oceania | Torres, Arafura, Timor, Wallacea corridors |
| Asia / North America | Bering Strait and Aleutian chain |
| Antarctica / other regions | Antarctic ocean boundary |

Country/territory rules take precedence around political or source-geometry
exceptions. Russia, Kazakhstan, Turkey, Egypt/Sinai, Caucasus territories,
Cyprus, Caribbean islands, Indonesia/New Guinea, and subantarctic islands are
expected override candidates. If a single 10m atomic polygon crosses a policy
line, assign it explicitly as a whole part first; introduce policy-driven
geometry splitting only when measurement justifies it.

## 10m Source And Review Scope

The released coastline source must be the World Atlas/Natural Earth 10m source.
Its country data has 255 features and the pinned package currently materializes
about 4,220 polygon parts. Those polygons
remain the exact-coverage and emission unit, but not the manual review unit.

Review seven regional policies, country/territory membership, and a small list of
polygon exceptions. Materialize inherited atomic assignments deterministically,
then prove one-and-only-one coverage and independent shard decoding. The existing
282-part 110m candidate is only a generator mechanics proof and must not be
approved for a 10m release.

## Viewport Relationship

Camera availability is independent of data availability. The UI may pan across
any valid world location, including open ocean. The receiver selects the eager
basemap plus viewport-intersecting shards, adds a documented prefetch margin and
retention/hysteresis, and never clamps or snaps the camera because a lazy shard is
not yet loaded. Hard corridors affect generator assignment only; they do not
restrict panning.

## Promotion Evidence

Promote this proposal only after a 10m candidate release reports compressed
transfer size, decode time, path-generation time, and peak memory for regional,
boundary, antimeridian, and world views. Keep eight delivery shards unless that
evidence shows a particular shard—likely Asia—needs subdivision.

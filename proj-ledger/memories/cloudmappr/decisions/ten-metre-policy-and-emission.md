---
id: cloudmappr-ten-metre-policy-and-emission
kind: decision
status: active
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before changing the 10m source, partition graph, corridor semantics, basemap membership, or shard-emission geometry"
---

# 10m Policy And Emission Decisions

## Context

Cloudmappr needs auditable eight-shard map delivery from fine coastline data
without a manual assignment table for every atomic polygon. The 110m assignment
proof is not a release input. The seeded geographic policy needs executable
definitions for its source, graph, rules, artifacts, and review boundary.

## Decisions

1. Use `world-atlas@2.0.2/countries-10m` as the pinned 10m classification
   source. Its source digest and the policy revision belong in the release
   identity and provenance record.
2. Retain country/territory identity only for partition classification and audit.
   Emit coastline land by dissolving/merging assigned country geometry within
   each shard, then independently re-topologize each shard. Country borders must
   not be an accidental rendered land layer.
3. Derive the geographic graph reproducibly from the pinned source: topology
   shared boundaries define adjacency; a deterministic spatial candidate search
   plus a specified geodesic boundary-distance primitive defines short-water
   frontier links. Generic clustering is not introduced as a dependency because
   it does not encode barriers, provenance, or deterministic policy semantics.
4. Represent hard corridors as versioned executable geometry and use an explicit
   crossing predicate. A blocked link cannot participate in regional expansion.
5. Keep seven regional seeds and the eager residual `world-basemap`. The exact
   seed locations, priorities, reach budgets, and frontier-gap budgets are
   versioned policy data calibrated against the first 10m candidate; they are not
   hidden implementation constants.
6. Whole atomic parts are assigned intact. Source geometry splitting is deferred
   and needs a separate measured decision; it is not a convenience mechanism for
   removing an exception.
7. The basemap is the total residual fallback for unadmitted land and minor
   islands. Named geographic rules may assign a recognised island group to a
   regional shard; absent such a rule it remains residual. This is delivery
   membership, not a limitation on panning or camera availability.
8. The policy result is an explained, exact-coverage materialization. Explicit
   part exceptions are release-scoped, justified, reviewer-attributed, and only
   valid when named geographic rules and deterministic whole-part selection
   cannot express the intended result.

## Consequences

The current `countries-110m` importer, centroid-review template, release name,
and hand-authored full assignment-table input must be replaced rather than
approved. The Mapshaper adapter needs a dissolve/merge transformation contract
before it can produce a release candidate. The 10m candidate is reviewable by
policy and explanations, while atomic parts continue to provide exact coverage
and topology-emission proof.

## Reconsideration

Reconsider these decisions only if a 10m candidate demonstrates unacceptable
compressed transfer, decode, path-generation, or peak-memory costs; source
topology makes the graph unreliable; or whole-part assignment produces a
material visual defect. The evidence must identify the affected view and
artifact before changing the eight-shard baseline or adding geometry splitting.

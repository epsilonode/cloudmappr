---
id: cloudmappr-rule-first-geographic-exceptions
kind: strategy
status: ready
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before adding a shard-membership exception, changing a geographic cut, or approving a 10m assignment policy"
---

# Rule-First Geographic Exceptions

## Objective

The eight-artifact delivery policy must remain geographically coherent without a
manually maintained assignment row for every 10m atomic polygon. The partition
is a total, deterministic policy program: it assigns every source part once and
explains why. It is not a continent lookup, a bounding-box heuristic, or a
nearest-neighbour chain with unbounded reach.

The baseline remains eager `world-basemap` plus lazy `north-america`,
`south-america`, `europe`, `africa`, `asia`, `oceania-major`, and `antarctica`.
This card refines the proposal in
`seeded-geographic-shard-partition.md`; that card owns the seven seed and hard
corridor policy. This card owns how exceptional cases are represented and
minimized.

## Default Rule Hierarchy

For a validated, stable source part, evaluate the following ordered rules:

1. reject an invalid or unknown part before partitioning;
2. apply a narrowly scoped, reviewed explicit exception when one exists;
3. apply a named geographic rule, such as a seed-affinity area, exclusion area,
   or island-group rule;
4. calculate every admissible seed path using allowed adjacency or bounded
   geodesic frontier links; links crossing a forbidden corridor are unavailable;
5. assign the whole part to the lowest stable `(pathCost, seedPriority, partId)`
   candidate that remains inside its seed-distance budget; and
6. assign a part with no admissible regional candidate to `world-basemap`.

The final fallback makes the policy total. `world-basemap` contains residual
land and minor islands only; it never means ocean geometry, an error, or a
missing assignment.

The hierarchy is data, not a cascade of undocumented special-case branches.
Every rule carries a stable ID and an intent description. Rules may change an
eligible seed set or prevent crossing a boundary; they may not silently add a
ninth delivery shard or assign a part to more than one artifact.

## What May Need Special Treatment

The following classes are candidates for a *geographic rule* first, and only an
explicit part exception if no defensible rule describes them:

| Class | Examples | Preferred representation |
| --- | --- | --- |
| Transcontinental mainland | Russia, Kazakhstan, Turkey, Egypt/Sinai, Caucasus | hard corridor plus seed-affinity area or explicit territory rule |
| Distant territory or island group | Caribbean, overseas territories, subantarctic islands | named island-group or residual-basemap rule |
| Short-water bridge | Indonesia/New Guinea, Aleutians, Mediterranean islands | prohibited corridor and maximum frontier gap |
| Source multipart spanning a cut | one indivisible 10m polygon intersects a policy line | deterministic whole-part choice; exception only if that choice is unacceptable |
| Source error or source revision anomaly | malformed identity or changed topology | reject the release or use a temporary, justified explicit exception |

An explicit exception is not a general country-to-shard table. It is a last
resort keyed by `(sourceRelease, atomicPartId)` and records the intended shard,
reason, reviewer, and source-policy rule it could not express. It expires when
the source release or the governing geographic rule changes. The generator must
fail if an exception targets a missing part, duplicates another exception, or
has no rationale.

## Avoiding an Override List

Do not begin with a list of thousands of manually labelled 10m parts. First express
the seven seed policies, hard corridors, bounded frontier gaps, and the small
number of named affinity/exclusion areas. Materialize their result, then review
only the parts whose explanation is surprising, ambiguous, or unstable at a
cut. This turns manual review into an evidence-driven audit.

Prefer, in order:

1. a corridor or distance-budget correction that fixes an entire class;
2. a named geographic rule for a recognised territory or island group;
3. a stable whole-part tie-break; then
4. an explicit part exception.

Never split source geometry merely to erase an exception. Splitting is a new
geometry policy with potential topology and rendering consequences. Introduce it
only after measurements show that whole-part assignment causes a material
delivery or visual problem, and give it its own contract.

## Evidence And Review

The proposed policy is promoted only after a 10m candidate release reports:

- one-and-only-one coverage, no unknown parts, and no unused exceptions;
- assignment explanations grouped by rule, seed, and residual fallback;
- a focused review of all parts near a corridor, antimeridian, or geographic
  rule boundary;
- compressed bytes, decode time, path time, and peak memory for regional,
  boundary, antimeridian, and world views; and
- independent decoding of every emitted artifact after re-topologization.

Reviewers approve the policy and any small exception record, not opaque output
rows. A source revision regenerates the materialized output and forces review of
new, removed, or differently explained parts.

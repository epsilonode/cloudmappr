---
id: cloudmappr-geographic-partition-functional-core
kind: contract
status: ready
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before implementing geographic partitioning, shard assignment resolution, or generator policy validation"
---

# Geographic Partition Functional Core

## Boundary And Ownership

The geographic partition core owns policy validation, graph construction from
validated atomic parts, seed expansion, rule resolution, assignment explanation,
and exact-coverage proof. Given identical validated inputs, it produces identical
assignments and errors. It performs no filesystem access, source retrieval,
Mapshaper execution, topology decoding, clock access, randomness, logging, or
release writing.

The source adapter owns raw 10m data decoding and stable atomic-part identity.
The geometry adapter may calculate adjacency, distances, and corridor crossings,
but returns validated readonly facts rather than hiding assignment decisions.
The composition module injects those adapters, invokes the core, then hands its
validated plan to Mapshaper and artifact ports. The release/provenance adapter
persists the policy identity and materialized explanations only after all core
proofs pass.

## Domain Primitives

Use closed branded types. Raw coordinates, GeoJSON, source properties, CLI text,
paths, environment variables, and untrusted JSON never enter these types without
parsing and validation.

```ts
type AtomicPartId = string & { readonly __brand: "AtomicPartId" }
type SourceRelease = string & { readonly __brand: "SourceRelease" }
type RegionId = Exclude<ShardId, "world-basemap">
type PolicyRuleId = string & { readonly __brand: "PolicyRuleId" }
type CorridorId = string & { readonly __brand: "CorridorId" }
type Metres = number & { readonly __brand: "Metres" }

type AtomicPart = Readonly<{
  readonly id: AtomicPartId
  readonly sourceRelease: SourceRelease
  readonly bounds: LonLatBounds
  readonly representativePoint: LonLat
}>

type PartitionExplanation =
  | Readonly<{ readonly kind: "explicit-exception"; readonly ruleId: PolicyRuleId }>
  | Readonly<{ readonly kind: "geographic-rule"; readonly ruleId: PolicyRuleId }>
  | Readonly<{ readonly kind: "seed-path"; readonly region: RegionId; readonly cost: Metres }>
  | Readonly<{ readonly kind: "residual-basemap" }>

type ExplainedAssignment = Readonly<{
  readonly partId: AtomicPartId
  readonly shardId: ShardId
  readonly explanation: PartitionExplanation
}>
```

`RegionId` prevents a regional policy from targeting the basemap. The only
function permitted to produce a `world-basemap` assignment is the named residual
fallback or a specifically validated geographic rule. Constructors reject blank
IDs, non-finite coordinates and distances, inverted bounds, unknown shard or
corridor IDs, duplicate rule IDs, and policy rules whose source release does not
match the input.

## Pure Composition

The public operation has one explicit policy and one explicit fact set:

```ts
const partitionWorld = (
  policy: PartitionPolicy,
  facts: PartitionFacts,
): Result<PartitionResult, PartitionError>
```

Its composition is intentionally linear:

```text
validate policy and facts
  -> classify allowed/frontier-blocked links
  -> calculate bounded multi-seed paths
  -> resolve explicit and geographic rules
  -> deterministically choose whole-part seed winners
  -> assign residual basemap parts
  -> prove exact coverage and explanation completeness
```

Each stage is a total `Result`-returning transformation of readonly input to
readonly output. `ts-pattern` exhaustively handles closed unions; `remeda` (or
equivalent immutable transformations) handles collections. Expected failures use
a closed `PartitionError` union: invalid policy, invalid fact, unknown part,
duplicate assignment, ambiguous rule, unassigned part, stale exception,
coverage mismatch, and inconsistent explanation. No stage throws, logs, or
performs I/O.

The shortest-path implementation may use an encapsulated local work queue only
if it remains observationally pure: no mutable value escapes, ordering is fully
specified, and tests prove the same result for equivalent unordered input. If
the functional lint configuration forbids that implementation form, use a
persistent priority queue or isolate the proven algorithm behind the same pure
function. Performance is not permission for nondeterminism.

## Determinism And Invariants

- Normalize and sort input parts, rules, graph edges, and seed IDs before any
  selection.
- Tie-break exactly by `(pathCost, seedPriority, atomicPartId)`; never rely on
  object enumeration, network arrival, map iteration, or source-file order.
- A forbidden corridor removes a candidate frontier edge; it does not change the
  camera, manifest selection, or ability to pan across that geography.
- An explicit exception has a unique part ID, matching source release, rationale,
  reviewer, and governing policy rule reference.
- Every input part produces one `ExplainedAssignment`; each assignment names one
  of the canonical eight shard IDs.
- The coverage proof reports duplicate, omitted, unknown, and stale-exception
  IDs rather than a generic boolean.
- The materialized assignment and explanation are release inputs and therefore
  participate in the provenance/release digest.

## Required Proofs

Atomic tests cover each validator, corridor block, seed budget, tie-break,
residual fallback, and explanation type. Seam tests inject stable geometry facts
and confirm the composition layer cannot call source, Mapshaper, filesystem, or
publication ports until core validation and coverage proof succeed. A 10m live
proof compares repeat runs with shuffled raw input and requires byte-identical
canonical assignment output, then independently decodes all eight artifacts.

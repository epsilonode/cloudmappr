---
id: cloudmappr-ocean-and-polar-island-shards
kind: strategy
status: deferred
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#ocean-and-polar-island-shard-expansion
hook: "read before splitting world-basemap, adding ocean or polar island artifacts, or changing manifest geographic coverage"
---

# Ocean And Polar Island Shard Expansion

## Objective

Shrink the eager `world-basemap` by moving residual island geometry into lazy,
geographically selected artifacts. This is a proposed expansion beyond the
eight-shard first-10m baseline, not a replacement for the accepted major-region
policy or an instruction to generate ocean geometry.

The candidate must classify atomic land parts before dissolve and TopoJSON
emission. Do not decode an already emitted `world-basemap` and rebucket it:
that would weaken source-part provenance, exact coverage, and independent
re-topology guarantees.

## Observed Candidate Composition

The corrected 10m candidate's eager basemap is 1,942,319 bytes raw and has 3,601
residual parts. The preceding Antarctica-only candidate was 2,089,976 bytes, so
routing Southern Ocean residuals to the existing lazy Antarctica artifact removed
another 147,657 eager raw bytes. Pre-emission source-geometry counts are planning
evidence, not
compressed artifact-size forecasts:

| Candidate group | Parts | Raw source-geometry bytes |
| --- | ---: | ---: |
| Arctic residuals, representative latitude at least 50 N | 1,167 | 4,171,239 |
| Southern residuals, representative latitude at most 50 S | 282 | 1,250,732 |
| Pacific residuals | 1,301 | 2,715,796 |
| East Pacific half | 413 | 663,645 |
| West Pacific half | 888 | 2,052,151 |

Groups may overlap until the final ordered classifier resolves them. Do not add
these byte counts together.

## Completed Correctness Prerequisite

Policy revision `seeded-frontier-v2-antarctica` adds the named
`antarctica-mainland` `force-shard-for-parts` rule for source part `010:0`.
The policy report and live candidate prove that it is assigned to the existing
`antarctica` artifact as a `geographic-rule`, never as residual basemap land.
The emitted Antarctica artifact was 131,502 bytes raw after the mainland repair.

## Completed Southern Ocean Reduction

Policy revision `seeded-frontier-v3-southern-ocean` adds the named
`southern-ocean-land` bounds rule for all representative points south of 50 S.
Before the rule, the only southern non-residual parts were the four already in
`antarctica`; all other 281 southern parts were residual. The policy proof now
places every part south of 50 S in `antarctica`, growing that lazy artifact to
275,601 bytes while reducing eager `world-basemap` to 1,942,319 bytes. This
keeps the eight-artifact manifest; an independent `islands-southern-ocean`
artifact remains deferred until the multi-footprint migration is justified.

## Historical v4/V5 Residual Classifier Order (Superseded)

After major regional assignment and before the residual basemap fallback:

1. retain main Antarctica in `antarctica` through `antarctica-mainland`;
2. assign qualifying detached land north of 50 N to lazy `islands-arctic`, with
   explicit policy exclusions for continental or major-region geometry;
3. retain qualifying detached land south of 50 S in the existing lazy
   `antarctica` artifact; evaluate a separate `islands-southern-ocean` only
   after multi-footprint evidence justifies it;
4. assign Pacific residuals to `islands-epac` or `islands-wpac` at the dateline;
5. later evaluate `islands-atlantic` and `islands-indian` under the same rules;
   and
6. place only remaining residual land in the eager `world-basemap`.

This is a policy-level residual classifier, not a generic cluster pass. Each
assignment still has an explanation and exact one-and-only-one coverage proof.

The Arctic-first/Pacific-second candidate order above describes the completed
v4/v5 experiment only. Its v3 comparison is `not-promotable`; it is not the
next delivery sequence.

## Dateline Policy And Manifest Requirement

An east/west Pacific split reduces the ordinary coverage of each island artifact,
but it cannot by itself solve antimeridian selection. Five current residual
parts cross the dateline: Fiji-area `242:3`, `242:4`, and `242:5`, plus Russian
Arctic `643:4`. These whole parts must not be silently split merely to fit a
bucket.

Before adding `islands-epac` or `islands-wpac`, replace the manifest's one
descriptor `bounds` rectangle with a readonly non-empty `coverageBounds` list.
Each coverage rectangle is antimeridian-normalized; selection loads an artifact
when any footprint intersects the requested normalized/prefetched viewport.
The artifact remains one immutable URL and one decoded land object. A whole
dateline-crossing part may be assigned by the deterministic policy to one
Pacific artifact while that descriptor advertises coverage on both sides of the
dateline. This avoids a fabricated `[-180, 180]` box that would select the
artifact for every viewport.

Geometry splitting remains deferred. It needs an independent policy, topology,
visual, and measurement proof rather than being an implementation convenience.

## Implementation Plan

Deliver the successor as independently reviewable slices. Do not combine the
manifest migration, policy expansion, and all island artifacts in one release:
that would make a selection regression indistinguishable from a classification
or geometry regression.

1. **Freeze and measure the eight-shard control.** Complete the 10m candidate
   promotion record for v3 first. It is the control for every successor trial:
   the policy/source digests, real-release receiver results, and scenario
   measurements must be reproducible before any optional artifact is enabled.
   The v3 candidate remains a valid release while this work is in progress.
2. **Make manifest coverage multi-footprint without broadening trust.** Add a
   manifest-format discriminator and normalize parsed descriptors internally to
   a non-empty readonly `coverageBounds` list. A v1 descriptor's existing
   `bounds` normalizes to a one-element list, so current eight-shard releases
   remain readable. A v2 descriptor emits `coverageBounds` directly. Retain a
   closed catalog: the eight core IDs are always required, and only the named
   optional IDs (`islands-arctic`, `islands-epac`, `islands-wpac`, later
   `islands-atlantic` and `islands-indian`) may occur at most once. Reject an
   unknown ID, duplicate, empty/malformed footprint list, unsafe URL, multiple
   eager artifacts, or a release that omits a core descriptor.
3. **Prove pure selection before generation changes.** Replace
   `intersectsBounds(descriptor.bounds, viewport)` with `some` intersection
   across the normalized footprint list. Preserve manifest order, immutable
   descriptor keys, cache ownership, digest-before-decode, and browser/Deno
   parity. Add atomic fixtures for a normal v1 descriptor, v2 one-footprint
   descriptor, a Pacific descriptor with footprints on both sides of the
   dateline, a dateline-crossing viewport, a polar viewport, and rejection
   cases. The browser HTTP and Deno filesystem live proofs must consume the
   same v2 fixture release before a real optional artifact is emitted.
4. **Introduce a pure residual-classifier phase.** Keep the current major
   geographic rules and seven-seed frontier result as the first phase. Feed
   only its `residual-basemap` assignments, immutable part facts, and a
   versioned ordered residual policy to a second pure reducer. A residual rule
   matches a representative point against named antimeridian-normalized
   coverage footprints and assigns a closed optional artifact ID. Its report
   records rule ID, source territory, point, prior residual status, chosen
   artifact, and every rejected higher-priority rule. Thus a part already in a
   major shard cannot migrate merely because it is north of 50 N or lies in a
   broad Pacific extent. Extend the policy/report schema and exact-coverage
   tests before changing the checked-in policy JSON.
5. **Review classifier candidates rather than write overrides.** Generate a
   canonical candidate report from the frozen source: first Arctic residuals
   at or north of 50 N, then Pacific residuals partitioned at the dateline.
   Define each final footprint from reviewed report evidence, with narrow
   named exclusions expressed as ordinary policy footprints. An atomic-part
   exception is forbidden for ordinary bucketing; it is permitted only when a
   geographic rule cannot represent a whole-part result, and then requires the
   existing source-release-scoped rationale/reviewer/governing-rule contract.
6. **Emit and evaluate one expansion at a time.** Add `islands-arctic` as the
   first nine-artifact candidate, derive its coverage footprints from the
   assigned pre-dissolve parts, dissolve/re-topologize it, and compare it with
   v3. Only then add `islands-epac` and `islands-wpac` together as an
   antimeridian-aware pair; each is one URL/one decoded topology even when its
   coverage list has several rectangles. Keep Southern Ocean land in the
   existing `antarctica` artifact. Do not create `islands-southern-ocean`,
   `islands-atlantic`, or `islands-indian` unless a new residual report shows a
   distinct ordinary-view win after the earlier candidates are measured.
7. **Promote only a complete release variant.** For every trial, generate a
   new policy/source-digest release directory and prove one-and-only-one
   pre-dissolve part coverage, derived-footprint coverage of every assigned
   part, independent TopoJSON decode/dissolution, digest integrity, and shared
   real-release selection. Publish none of the trial artifacts until the
   comparison record is accepted.

### Required Type And Boundary Changes

Keep core and effect boundaries explicit:

- model `CoreShardId`, `OptionalShardId`, and their closed union separately;
  do not replace them with bare strings;
- make parsed `ArtifactDescriptor.coverageBounds` canonical and readonly;
  keep raw v1/v2 decoding at the manifest I/O boundary;
- make residual classification a total pure function from validated policy and
  facts to explained assignments; keep World Atlas loading, report writing,
  Mapshaper, compression, timing, and HTTP/filesystem access in adapters; and
- derive descriptor footprints and manifest records from the immutable
  pre-dissolve assignments, never from a post-emission TopoJSON rebucket.

### Trial Matrix And Promotion Rule

Use v3 as control and compare these variants in order: v3 eight-shard control,
v4 plus Arctic, then v5 plus Arctic and both Pacific shards. Test North America,
Europe/Africa boundary, ordinary Pacific, Arctic, Southern Ocean, Atlantic,
antimeridian, and full world. Record raw/gzip/Brotli bytes, selected descriptor
and request count, decode time, path-generation time, and peak retained memory
as median and range.

Promote a variant only if ordinary pan views demonstrate repeatable reduction in
initial transfer or client/server geometry work, there is no correctness or
selection regression at the antimeridian or poles, and its extra
request/cache/decode cost does not worsen an affected ordinary pan. Full-world
composition remains a recorded compatibility measurement, not a veto: the
product has no global-map view. The initial viewport may receive all of its
selected shards in one wrapped payload; later pan-induced selections are the
lazy-request budget. Set numerical thresholds from the v6 control measurements,
rather than inventing a percentage before a baseline exists.

## Implemented Evidence And Current Decision

The implementation now supplies manifest v1 normalization, emitted v2
`coverageBounds`, a closed optional-ID catalog, pure residual rules with a
minimum distance from already assigned major land, policy-selectable generation,
real-release browser/Deno parity, and reproducible measurement/comparison
commands. The generator derives optional-artifact footprint lists from assigned
pre-dissolve source parts, including split antimeridian footprints; it does not
use the broad classifier extent as an artifact's delivery extent.

Three locally generated releases provide the first comparison set:

| Release | Artifacts | Status |
| --- | ---: | --- |
| `v3-southern-ocean` | 8 | active measurement control |
| `v4-arctic` | 9 | evidence-only candidate |
| `v5-arctic-pacific` | 11 | evidence-only candidate |
| `v6-coastal-attachment` | 11 | accepted pan-first release |

`deno task artifacts:measure --release <directory> --output <record> --runs 3`
records raw/gzip/Brotli bytes, request count, JSON decode time, path time, and
retained heap across the required scenarios. `deno task artifacts:compare`
produces the promotion record. The historical v3-to-v5 record is
`not-promotable` under the now-superseded full-world gate: v5 adds three
full-world requests and 13,278 raw bytes, even though it reduces raw geometry in
Pacific and antimeridian scenarios. v6 adds same-territory coastal attachment
and is accepted as the pan-first release because its ordinary-view reductions
are the governing objective. Publication remains a separate GitHub/esm.sh gate.

## Remaining Eager Basemap Reduction

The v5 candidate reduces eager `world-basemap` to 441,055 raw bytes, but it
still contains 1,204 of 4,220 atomic parts. Its diagnostic, mutually exclusive
representative-point windows contain 501 parts in the Indian Ocean window, 307
in the Atlantic window, 235 north of 50 N, and 161 elsewhere. These are triage
counts, not artifact-size forecasts and not a license to bucket every part in a
rectangle.

### Coastal Attachment Before New Ocean Artifacts

The next phase runs after major-region rules/seed paths and before the detached
residual classifier. It exists to move near-coast fragments out of the eager
basemap without adding an extra request:

1. Preserve a typed `SourceFeatureId` when World Atlas features are split into
   atomic parts; do not repeatedly infer provenance by parsing a string ID.
2. For a preliminary `world-basemap` part, consider only already-major-assigned
   parts with the same `SourceFeatureId`. Compute its deterministic nearest
   major-land candidate from representative points and source geometry facts.
3. Attach it only when the owning major shard is unique and its distance is at
   or below a checked-in, source-release-scoped attachment budget. A tie, absent
   owner, cross-territory candidate, corridor violation, or distance over budget
   leaves the part residual. The report records the candidate IDs, distance,
   budget, winning shard, and rejection reason.
4. The reducer remains total and pure: facts plus policy in, explained
   assignment out. Source loading, report serialization, Mapshaper, and release
   I/O stay at effect boundaries. No ordinary attachment may use an atomic-part
   override list.

This preserves the user-visible major-region request model: a Canadian, US, or
other territory-owned coastal fragment can move with its already-selected major
artifact instead of staying eager or creating an unrelated island fetch.

### Current Refined Delivery Order

The active sequence is deliberately narrow and evidence-gated:

1. run major-region assignment;
2. apply reviewed same-territory coastal attachment with the versioned policy;
3. classify the remaining detached residual parts and emit the post-attachment
   report;
4. prove bounded optional-footprint compaction against that report before it
   becomes release behavior;
5. trial `islands-indian`; and
6. evaluate `islands-atlantic` only if the Indian comparison and remaining
   residual report show a distinct ordinary-view win.

No Arctic split or separate Southern Ocean artifact is currently in this path.
The preliminary 350 km audit's 519 attachable rows are triage evidence, not an
approved mutation: review must select the exact source-release-scoped budget
before assignments change. Each later step consumes the measured output of the
prior step; a broad diagnostic window or an earlier v4/v5 candidate cannot
substitute for that evidence.

### Implemented Dry-Run Audit Slice

`AtomicPart` now carries a branded `SourceFeatureId`, preserved by the World
Atlas feature splitter. `auditCoastalAttachments` is a pure read-only operation:
it receives partition facts, explained assignments, and a maximum-distance
policy, then returns one deterministic decision per residual part. It has no
assignment, manifest, Mapshaper, or filesystem effect.

At the provisional 350 km budget, the real v5 audit writes 1,204 decisions:
519 `attachable`, 5 `corridor-blocked`, 374 `no-same-territory-major`, and 306
`too-distant`. The attachable destinations are Asia (186), Europe (149), North
America (123), Antarctica (25), South America (17), Africa (15), and
Oceania-major (4). These are an audit result, not authorization to promote a
release. The v6 evidence-only candidate makes the same budget a named,
source-release-scoped, exception-free `coastalAttachment` policy and applies it
inside the pure partition core before residual rules. Its generated report
accounts for all 4,220 parts: 1,204 residual before attachment, 519 attached,
924 residual after attachment, and a 369,007 raw-byte eager basemap. The
post-attachment diagnostic groups are Indian 451, Atlantic 293, north of 50 N
128, and other 52.

The v6 candidate is accepted for this product's pan-first delivery. It improves
v5 North America by 99,598 raw bytes, Europe/Africa by 18,591, and Pacific by
69,535. Its full-world v5 selection adds 2,036 raw bytes and, compared with v3,
three requests and 15,314 raw bytes; this remains recorded compatibility
evidence, not a promotion veto. Cloudmappr has no global-map use case and no
material zoom workflow. Initial delivery may wrap every artifact selected for
the initial viewport into one payload; each descriptor retains its immutable URL
and digest, and only later pan-induced selections are fetched lazily.

Run the report with:

```text
deno task artifacts:world:coastal-audit --policy <policy.json> --output <audit.json> --budget-km 350
```

### Remaining Optional Candidate Order

After the approved attachment release, its post-attachment residual report, and
the compaction proof:

1. Trial `islands-indian` first because its diagnostic window is the largest
   remaining concentration. Its policy must be a named, antimeridian-normalized
   footprint set and the same detached-land predicate used by prior candidates.
2. Compare the resulting release against v3 and the immediately preceding
   candidate before attempting `islands-atlantic`.
3. Trial `islands-atlantic` only if the remaining Atlantic report identifies a
   geographically detached set with ordinary-view benefit; Caribbean or coastal
   fragments that attach to North/South America remain in those major shards.
4. Keep residual high-latitude parts attached to their owning major shard when
   eligible. Create no new Arctic artifact variant until the post-attachment
   report demonstrates a distinct detached group.
5. Keep all land south of 50 S in `antarctica`; do not reopen a separate
   Southern Ocean artifact without new contrary measurement evidence.

### Footprint Compaction Discipline

Optional artifacts may have many source-derived `coverageBounds[]` footprints.
After assignment, a pure compactor may merge only overlapping or adjacent
normalized footprints belonging to the same artifact. Its policy records the
adjacency tolerance and maximum permitted envelope expansion. The proof must
show that every assigned source part is covered, no dateline part is split, the
manifest/coverage bytes fall, and scenario selection does not add an artifact
to an unrelated ordinary viewport. Do not replace a sparse footprint set with a
world-wide or ocean-wide rectangle merely to shorten the manifest.

### Required Candidate Evidence

Every coastal-attachment, Indian, or Atlantic trial requires a policy report
with pre/post shard counts and explanations; source/assignment/manifest digests;
independent dissolve/decode proof; browser/Deno real-release selection parity;
and v3 plus immediate-predecessor measurements. Review North America,
Europe/Africa, Indian Ocean, Atlantic, Arctic, Pacific, Southern Ocean,
antimeridian, and full-world views. Full-world measurements are compatibility
evidence only. Reject a candidate when it improves eager bytes by shifting a
disproportionate request, cache, decode, path, retained-memory, or selection
cost onto an affected ordinary pan view.

## Promotion Evidence

Promote this expansion only after:

- the Antarctica assignment rule and exact-coverage proof remain intact;
- client and Deno share `coverageBounds` selection, including antimeridian and
  dateline-crossing whole-part fixtures;
- every new artifact dissolves, re-topologizes, and decodes independently;
- measurements compare initial wrapped-payload and later pan-induced transfer,
  decode time, path-generation time, retained memory, cache behavior, and request
  count for continental, polar, Pacific, Atlantic, and antimeridian views;
  full-world composition is retained as compatibility evidence; and
- measurements show that extra manifest/cache/request overhead is outweighed by
  reduced ordinary pan-view work.

---
id: cloudmappr-ten-metre-candidate-promotion
kind: strategy
status: ready
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#ten-metre-candidate-promotion-and-measurement
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before approving a 10m policy revision, measuring a world artifact release, or publishing an immutable world-data candidate"
---

# 10m Candidate Promotion And Measurement

## Objective

Promote the runnable local 10m policy candidate into a measured, reviewable,
immutable release candidate without treating local generation as production
publication. The active policy is
`world-atlas-10m-seeded-frontier-v3-southern-ocean`; it retains eight artifacts
and leaves `world-basemap` at 1,942,319 raw bytes after the Antarctica and
Southern Ocean corrections.

## Non-Goals

This work does not add ocean-island artifacts, alter camera availability, split
whole source parts, publish to GitHub, or approve the final geography policy.
The deferred ocean/polar strategy owns those concerns. The target here is a
repeatable evidence package that makes the next approval and delivery decision
informed.

## Ordered Delivery

1. **Policy audit.** Generate canonical assignment/explanation reports from the
   checked-in policy. Group results by shard, explanation kind, geographic rule,
   source country/territory, corridor proximity, antimeridian crossing, and
   residual fallback. Review the seven seeds, distance budgets, corridors,
   `antarctica-mainland`, and `southern-ocean-land`; reject stale part IDs,
   unreferenced rules, missing explanations, or unexplained policy changes.
2. **Candidate hygiene.** Generate to a directory named by source digest and
   policy revision. Require only eight TopoJSON artifacts, `manifest.json`, and
   `provenance.json`; temporary source GeoJSON and intermediate command files
   must not appear in the release directory. Re-read manifest and provenance,
   verify artifact digests, exact atomic coverage, artifact independence, and
   dissolution of country-boundary properties.
3. **Real-release receiver proof.** Exercise the browser HTTP and Deno
   filesystem receivers against the same v3 generated release, not just the
   fixture. For normalized regional, boundary, antimeridian, polar, and
   full-world bounds, assert identical selected descriptor IDs and decoded land
   identities. The test must retain the eager artifact, use immutable URLs, and
   make no fallback fetch outside the manifest.
4. **Measurement harness.** Write a canonical measurement record beside the
   candidate, keyed by source digest, policy revision, generator version, runtime
   version, platform, and scenario. Measure raw bytes plus gzip and Brotli bytes,
   network-equivalent transfer bytes, JSON/TopoJSON decode time, path-generation
   time, peak retained memory, and descriptor/request counts. Scenarios are
   North America, Europe/Africa boundary, Pacific, Arctic, Southern Ocean,
   antimeridian, and full world. Run each enough times to report median and range.
5. **Review gate.** Compare the v3 candidate against the previous v2 candidate
   and, when available, deferred ocean/polar alternatives. Approval requires an
   explanation diff, no coverage/provenance regression, acceptable ordinary-view
   eager cost, and a written disposition for each exception or proposed policy
   adjustment.
6. **Publication handoff.** Only after approval, stage the immutable release
   directory for the GitHub/esm.sh delivery process. Publish the manifest and
   per-artifact digests together; do not expose a mutable branch, `latest` URL,
   local development route, or build-only package dependency as production data.

## Required Evidence

The promotion record contains the policy JSON and digest, source digest, complete
assignment report digest, manifest/provenance digests, scenario measurements,
receiver parity results, independent artifact decode result, and a human review
identity/date. A failure is diagnostic: it names the policy rule, part ID,
artifact, scenario, or invariant that failed rather than collapsing to a generic
release error.

## Exit Conditions

This strategy is complete when the evidence package is reproducible locally and
ready for human policy approval. Production publication remains governed by the
GitHub/esm.sh delivery strategy and must consume this exact immutable candidate.

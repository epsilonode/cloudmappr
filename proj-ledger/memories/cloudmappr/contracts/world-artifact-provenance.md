---
id: cloudmappr-world-artifact-provenance
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#component-quality-and-provenance
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before changing world-data sources, generator tooling, shard membership, or release artifacts"
---

# World Artifact Provenance

Every released world-data manifest must make its geometry reproducible and
auditable. Runtime consumers use only generated, immutable artifacts; source
retrieval and regeneration tooling are build concerns.

## Required Release Record

- Record the World Atlas/Natural Earth source name, source version, retrieval
  URL and date, license or attribution terms, and input checksum.
- Record the Atlas/Mapshaper generation workflow, including tool versions,
  generator source revision, input options, and the exact source-to-shard
  partition rationale.
- Record each emitted artifact's role, object name, bbox, immutable URL,
  integrity metadata when available, and the world-data release identity shared
  by the manifest and canonical render hash.
- Preserve the distinction between permanent geometry cropping performed by the
  generator and visual clipping performed by an SVG viewport. A visual viewport
  must not be represented as a changed source artifact.

## Ownership And Proof

- Keep source download, conversion, partition, topology, and coverage tooling out
  of browser and Deno runtime dependency paths.
- Regeneration produces a new immutable release only after manifest validation,
  independent shard decoding, and exact atomic-part coverage prove that no land
  part was duplicated or omitted.
- Release evidence must identify the source record and generator revision that
  created the served artifacts. The server must resolve the declared release, not
  a mutable source branch or unrecorded local artifact.

---
id: cloudmappr-world-artifact-generation-toolchain
kind: strategy
status: ready
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
  - roadmaps/cloudmappr.md#phased-implementation
hook: "read before adding world-data build dependencies, Mapshaper commands, generator modules, or artifact-generation contracts"
---

# World Artifact Generation Toolchain

World geometry is generated outside browser and Deno render-runtime dependency
paths. The build toolchain has two deliberate roles:

- `mapshaper` `0.7.53` is a pinned development-only CLI adapter. It imports,
  cleans, simplifies, filters, and writes topology-aware intermediate or emitted
  geometry. Invoke it through the declared Deno runtime; do not add it to the
  browser or server runtime module graph.
- The Deno TypeScript generator owns Cloudmappr-specific behavior: source-part
  identity, the reviewed eight-shard assignment table, coverage validation,
  manifest construction, release digests, and provenance records. Mapshaper
  neither selects the release policy nor replaces these rules.

Mapshaper's transitive native build scripts are not approved for this workflow.
The normal geometry pipeline must work without them; approving a script requires
an explicit compatibility and security review.

## Functional Primitive Types

The generator's pure core defines closed, immutable domain primitives before any
CLI or file integration. These include a closed `ShardId` union for the eight
artifact names; branded `AtomicPartId`, `SourceRevision`, `ArtifactDigest`, and
`ReleaseIdentity` strings; a readonly `LonLatBounds` tuple; and readonly records
for `AtomicPart`, `ShardAssignment`, `ArtifactDescriptor`, and `WorldManifest`.

Raw GeoJSON/TopoJSON, command-line text, file paths, environment variables, and
untrusted source metadata are boundary values, not core domain types. Parsing
and validation convert them to primitives or return a closed `GenerationError`
union. A valid `ShardAssignment` is impossible to construct from an unknown
shard ID, a blank part ID, or malformed bounds.

Pure functions accept readonly values and return new readonly values. They use
`neverthrow` `Result` for expected invalid source, duplicate assignment, omitted
part, invalid manifest, and digest mismatch failures; they do not throw or log.
Use `ts-pattern` for exhaustive result/error branches and `remeda` for immutable
collection transformations. Their determinism is what makes regeneration,
coverage proof, and release identity auditable.

## Effect Boundary

Only adapter modules may perform effects. They receive explicit configuration and
provide typed ports to the pure composition layer:

- **Source port:** retrieves or reads a named, checksummed source input.
- **Mapshaper port:** runs one declared, version-pinned command plan and returns
  parsed output or a typed command failure; it does not decide assignment.
- **Artifact port:** reads/writes temporary and release files and computes bytes
  or digests.
- **Release-record port:** persists provenance and manifest output only after the
  pure validator accepts it.

The composition boundary converts port responses into core primitives, calls
pure functions, and sequences the next effect. The pure modules import neither
`Deno`, Node compatibility APIs, `mapshaper`, process spawning, filesystem APIs,
nor `fetch`. Ports are injected in seam tests, so the assignment and manifest
logic can be proven without a network, executable, or disk.

## Required Component Contracts

Every build component needs its own narrow contract before implementation:

1. source retrieval and checksum verification;
2. Mapshaper command-plan input/output and supported geometry transformations;
3. atomic-part extraction and stable ID formation;
4. reviewed assignment-table schema and eight-shard membership validation;
5. independent topology emission and decoding validation;
6. exact-coverage, duplicate, and omission proof;
7. manifest, digest, and release-identity construction; and
8. release record and immutable artifact publication.

Contracts name accepted input, rejected input, ownership, output invariants, and
proof. They remain separate so a change in geometry tooling cannot silently
weaken assignment, manifest, or release guarantees.

## Delivery Sequence

1. Define the primitive types, error union, ports, and component contracts.
2. Add pure atomic-part, assignment, coverage, bounds, and manifest functions
   with colocated atomic tests.
3. Add Mapshaper and filesystem adapters with fake-port seam tests.
4. Add an explicit live generation task that runs the pinned CLI against a
   checksummed fixture and validates all eight independently decodable artifacts.
5. Publish only validated immutable artifacts and their release record.

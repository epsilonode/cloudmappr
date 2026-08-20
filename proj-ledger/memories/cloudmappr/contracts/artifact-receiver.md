---
id: cloudmappr-artifact-receiver
kind: contract
status: ready
created: 2026-08-19
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before adding artifact fetching, manifest parsing, shard caching, local receiver routes, or TopoJSON decode behavior"
---

# Artifact Receiver

The artifact receiver consumes one configured world-data release. It is used by
the browser controller and Deno image renderer, but it does not generate data,
choose an arbitrary release, or render SVG itself. Both callers share its pure
validation, bounds selection, command planning, and state reduction.

## Ownership And Non-Goals

The receiver owns validated manifest intake, immutable descriptor resolution,
required-shard selection, digest verification coordination, and received-shard
state. The scene builder owns geometry-to-scene conversion; a transport adapter
owns HTTP or filesystem I/O; a TopoJSON decoder adapter owns parsing decoded
bytes; and the generator owns release creation.

The baseline receiver never accepts a caller-supplied artifact URL, raw TopoJSON,
SVG fragment, mutable branch, or `latest` release. It does not insert SVG markup.
The deferred SVG-fragment receiver remains a separate experiment.

## Domain Primitives

Define closed, readonly types before adapters:

```ts
type ReleaseRef = string & { readonly __brand: "ReleaseRef" }
type ManifestUrl = string & { readonly __brand: "ManifestUrl" }
type ImmutableArtifactUrl = string & { readonly __brand: "ImmutableArtifactUrl" }
type ArtifactKey = string & { readonly __brand: "ArtifactKey" }

type ReceiveState = Readonly<{
  readonly release?: ReleaseIdentity
  readonly manifest?: WorldManifest
  readonly shards: readonly ReceivedShard[]
}>

type ReceiveCommand =
  | Readonly<{ readonly kind: "load_manifest"; readonly release: ReleaseRef }>
  | Readonly<{ readonly kind: "load_shard"; readonly artifact: ArtifactDescriptor }>
```

`ArtifactKey` is the complete immutable artifact URL plus its expected digest;
it is not merely a shard ID. `ReceivedShard` contains a descriptor and decoded,
validated geometry. A shard ID cannot appear twice in one `ReceiveState`.

Expected failures are a closed `ReceiveFailure` union: `unknown_release`,
`malformed_manifest`, `mixed_release`, `rejected_url`, `digest_mismatch`,
`transport`, `invalid_topology`, `decode`, and `state_conflict`. Failures carry a
safe diagnostic message and, where applicable, a descriptor ID; they never leak
filesystem paths, credentials, or arbitrary response bodies.

## Pure Core API

Pure functions import neither `Deno`, DOM APIs, `fetch`, `crypto`, TopoJSON
libraries, mutable `Map`, nor promises. They return `neverthrow` `Result` and
readonly values.

```ts
parseManifest(raw: unknown, source: ManifestUrl): Result<WorldManifest, ReceiveFailure>
resolveArtifactUrl(manifest: WorldManifest, descriptor: ArtifactDescriptor): Result<ImmutableArtifactUrl, ReceiveFailure>
selectArtifacts(manifest: WorldManifest, bounds: LonLatBounds): readonly ArtifactDescriptor[]
planReceive(state: ReceiveState, release: ReleaseRef, bounds: LonLatBounds): Result<ReceivePlan, ReceiveFailure>
reduceManifest(state: ReceiveState, manifest: WorldManifest): Result<ReceiveState, ReceiveFailure>
reduceShard(state: ReceiveState, shard: ReceivedShard): Result<ReceiveState, ReceiveFailure>
```

`planReceive` is the critical purity boundary. Given only immutable state,
configured release, and normalized bounds, it returns a new state plus commands
for the absent manifest or absent selected artifacts. It must select the eager
basemap and every intersecting lazy shard, including both sides of an
antimeridian-split bounds input. It never executes a command or records a cache
hit by mutation.

`reduceManifest` rejects a different release after a manifest is already loaded.
`reduceShard` rejects descriptors not listed by the loaded manifest, mismatched
release identities, duplicate keys, and artifacts whose declared ID conflicts
with the received value. Stable output ordering follows manifest order, never
network completion order.

## Implemented First Slice

`packages/world-artifacts/src/receiver.ts` implements the transport-free core:
explicit release references, safe descriptor URL admission, immutable artifact
keys, antimeridian-aware selection, `load_manifest`/`load_shard` planning, and
manifest/shard reduction. Its atomic tests prove manifest order, eager basemap
selection, antimeridian splitting, absent-shard planning, and duplicate-shard
rejection. It also validates raw parsed manifest values: exactly the canonical
eight IDs, one eager `world-basemap`, finite legal bounds, `land` object name,
SHA-256 digest shape, and admitted descriptor URLs. Effects, digest comparison,
and decoding remain outside this pure core by design; the following interpreter
slice owns the effect-boundary portion.

## Implemented Interpreter Slice

`receiver-runtime.ts` interprets a `ReceivePlan` through injected manifest-byte,
manifest-decoder, artifact-byte, digest, and Topology-decoder ports. It feeds
raw decoded manifest values through the pure parser, runs commands in planner
order, compares the computed digest before invoking the topology decoder, and
reduces only verified decoded land IDs. The seam fixture proves a browser/Deno
agnostic success path and proves digest mismatch halts before decode or state
reduction.

The interpreter no longer accepts an already validated manifest from a store.
Concrete JSON, HTTP, and filesystem adapters remain pending. No port
implementation may bypass the parser, planner, or call the reducer with
unverified topology.

## Implemented Adapters

`packages/world-artifacts/src/local.ts` supplies filesystem, JSON, SHA-256, and
TopoJSON adapters plus the constrained local artifact route. `http.ts` supplies
the browser fetch store and preserves descriptor-relative URLs against one trusted
manifest URL. Browser HTTP and Deno filesystem fixture paths are live-proven to
select matching land. Promise coalescing remains the next receiver refinement;
the current adapters deliberately preserve immutable URL identity without a
mutable cache hidden in the core.

## Effect Ports And Composition

The composition layer interprets `ReceiveCommand` values through injected ports:

```ts
type ArtifactStore = Readonly<{
  readonly readManifest: (release: ReleaseRef) => ResultAsync<Uint8Array, ReceiveFailure>
  readonly readArtifact: (url: ImmutableArtifactUrl) => ResultAsync<Uint8Array, ReceiveFailure>
}>

type ManifestDecoder = Readonly<{
  readonly decode: (bytes: Uint8Array, source: ManifestUrl) => ResultAsync<unknown, ReceiveFailure>
}>

type DigestPort = Readonly<{
  readonly sha256: (bytes: Uint8Array) => ResultAsync<ArtifactDigest, ReceiveFailure>
}>

type TopologyDecoder = Readonly<{
  readonly decode: (bytes: Uint8Array, descriptor: ArtifactDescriptor) => ResultAsync<DecodedLand, ReceiveFailure>
}>
```

The interpreter calls `ArtifactStore`, passes bytes to `DigestPort`, compares the
result to the descriptor, then calls `TopologyDecoder`. Only a successful
digest-and-decode result may be passed to `reduceShard`. `ResultAsync` is the
only expected-failure effect model; do not add an effect runtime.

Promise coalescing is an adapter concern. An adapter may keep a private mutable
map from `ArtifactKey` to an in-flight or fulfilled promise, but it must expose
only completed `ReceivedShard` values to the pure core. Its cache may not cause a
different release or descriptor to be reused. Eviction and TTL policy are also
outside the core; baseline artifact URLs are immutable.

## URL And Release Safety

Release configuration is supplied by trusted application composition, not user
input. The receiver resolves descriptor URLs only relative to the loaded manifest
or against an explicit configured release origin. It rejects path traversal,
credentials, fragments, a changed origin, non-HTTPS production URLs, and URLs
outside the configured local development root. A Deno server must not turn a
request parameter into a filesystem path or upstream fetch URL.

Every manifest declares one release identity. Every descriptor URL and digest
belongs to that identity. Browser and Deno may use different store adapters, but
they must validate the same manifest bytes and select the same descriptor IDs.

## Required Proof

- Atomic tests cover manifest parsing, URL rejection, descriptor ordering,
  antimeridian selection, duplicate reduction, and digest mismatch handling.
- Seam tests use fake store, digest, and decoder ports to snapshot commands and
  prove that no network or filesystem effect occurs in the pure core.
- A browser-like HTTP adapter and a Deno filesystem adapter consume the same
  local release fixture and yield identical selected descriptor IDs and decoded
  land IDs for regional, global, and antimeridian bounds.
- A live proof serves the generated fixture through the local artifact route and
  confirms no request outside the manifest-listed release paths is accepted.

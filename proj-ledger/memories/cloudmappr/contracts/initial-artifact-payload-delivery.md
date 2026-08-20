---
id: cloudmappr-initial-artifact-payload-delivery
kind: contract
status: ready
created: 2026-08-20
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before adding a Deno Deploy initial artifact endpoint, changing wrapped payload framing, compression, edge caching, or browser cache seeding"
---

# Initial Artifact Payload Delivery

## Purpose

Cloudmappr is a pan-first, effectively non-zooming map. An initial viewport may
receive every selected v6 artifact in one response. The response reduces startup
round trips, while preserving the immutable per-artifact identity used by the
manifest, digest verifier, browser cache, Deno renderer, and later lazy pans.

This contract governs the Deno Deploy production endpoint. GitHub/esm.sh remains
the immutable module/artifact publication source; it does not dynamically assemble
viewport-specific payloads.

## Delivery Model

The server accepts an initial viewport only to derive a canonical selected-artifact
set. It must use the shared pure manifest selector, never a separate server-side
geographic implementation. The canonical set is the release ID plus the selected
artifact IDs in manifest order. A hash of that canonical tuple is the selection
key.

Use two routes:

1. a convenience initial route validates and normalizes bounds, selects artifacts,
   then redirects to the canonical immutable pack URL; and
2. `GET /v1/world-releases/<release>/initial/<selection-key>.pack` returns that
   pack only when its decoded key exactly names a valid selection for the release.

The canonical pack route is the cache key. Never cache arbitrary raw bounds as
the artifact-payload identity. The pack must contain exactly the selected manifest
descriptors and their canonical source bytes; it may not contain a broader
regional, global, or caller-selected URL set.

The server is not an artifact authorization bypass. It admits one configured
release origin and manifest-listed immutable URLs only. Reject an unknown release,
malformed bounds, invalid/unknown selection key, duplicate descriptor, unexpected
artifact ID, unsafe URL, failed upstream response, byte-length mismatch, or digest
mismatch.

## Pack Format And Integrity

Use a versioned binary framed format, not JSON base64. The canonical uncompressed
body is:

```text
magic | format version | UTF-8 index length | UTF-8 canonical index | raw member bytes...
```

The index is canonical JSON and records the complete parsed release manifest,
release, selection key, each selected artifact ID, immutable URL, object name,
SHA-256 digest, raw byte length, and byte offset. This lets the receiver plan a
later pan without a separate startup manifest request. Members follow manifest
order and consist of the exact emitted `.topo.json` bytes.
Offsets and lengths must be monotonic, non-overlapping, and within the body.

The pack identity is derived from pack-format version, release ID, ordered member
IDs, and the manifest digests. It is not a replacement digest for members. The
receiver validates framing, index/release/selection agreement, every member length,
and every member digest before decoding or seeding a cache entry. A malformed pack
is all-or-nothing: seed and render none of its members.

Base64 is forbidden because it adds encoding overhead and forces avoidable string
allocation. Pre-compressing individual members inside the pack is also forbidden:
the outer response is compressed once and member digests name their canonical raw
bytes.

## Compression

The Deno Deploy handler negotiates `br`, then `gzip`, then identity from
`Accept-Encoding`. It compresses the entire canonical pack once, sets
`Content-Encoding`, and sets `Vary: Accept-Encoding`. It uses a binary pack
content type such as `application/vnd.cloudmappr.artifact-pack`.

Do not rely on automatic compression for the binary MIME type. The handler may
use Deno `CompressionStream` explicitly so local and Deploy behavior are the
same. Automatic compression remains suitable for manifest and other recognized
JSON/text responses, but it must be validated by a response-header proof before
becoming a dependency. A caller receives transparently decompressed bytes from
browser `fetch`; integrity checks always run over the decompressed canonical pack.

The response must not set `no-transform`. Do not set a strong encoded-body ETag:
content encoding changes the transferred representation. The canonical immutable
URL and release/selection identity are the primary cache validators.

## Cache Ownership

The Deno Deploy edge cache owns packed-response caching. Canonical pack URLs use
long-lived `Cache-Control: public, max-age=31536000, immutable`; a deploy cache
identifier/tag is derived from the release and selection key so immutable packs
can survive code deployments and be invalidated only with an explicit release
operation. Encoding variants remain separated by `Vary: Accept-Encoding`.

The browser HTTP cache owns the wrapper response, not automatically its extracted
members. After whole-pack validation, the browser artifact-cache adapter seeds a
validated `ReceivedShard` under each member's immutable descriptor URL and digest.
A later pan asks the existing pure receiver only for absent artifact keys. If
persistent CacheStorage/service-worker seeding is introduced, it must store a
synthetic response only under that exact immutable artifact URL and must preserve
the verified raw bytes, content type, and release/digest association.

No mutable cache belongs in the functional core. Edge cache, HTTP cache,
CacheStorage, service-worker storage, promise coalescing, upstream fetches,
compression, and response streaming are adapters behind explicit ports.

## Functional Boundaries

Pure primitives:

- normalize bounds and select descriptors from the parsed manifest;
- derive the canonical ordered selection key;
- validate a claimed key against release/descriptor identities;
- construct and parse framed canonical pack values;
- validate index monotonicity, membership, offsets, lengths, and digests; and
- produce ordered cache-seed commands or typed failures.

Effect adapters:

- Deno Deploy request parsing, redirect, upstream immutable artifact reads,
  compression, response headers, and edge-cache controls;
- browser fetch, transparent decompression, persistent/in-memory cache writes,
  and TopoJSON decode; and
- local filesystem/HTTP fixture servers and timing/header instrumentation.

The server may not decode TopoJSON merely to construct a pack. The browser may
not decode a member before its digest validates. Neither side may infer a URL from
a member payload rather than the parsed manifest.

## Required Proof

Before production use, prove all of the following:

1. browser and Deno share normalized initial selection and canonical key fixtures,
   including antimeridian bounds;
2. encoded and identity responses unpack to identical canonical bytes; `br` is
   preferred when offered and gzip/identity fallbacks are correct;
3. every packed member verifies to its manifest digest, then seeds the same cache
   key/direct-receive state as an individual artifact response;
4. corruption, a bad offset/length, duplicate member, unknown ID, wrong release,
   unsafe URL, and one bad digest cause no cache seed or decode;
5. a second initial request uses the canonical edge-cached URL, while a later pan
   fetches only genuinely absent selected IDs;
6. Deno Deploy response headers prove content type, `Content-Encoding`,
   `Vary: Accept-Encoding`, immutable cache policy, and cache-key isolation; and
7. measurements record compressed initial payload bytes, unpack/verification time,
   seeded-cache hit behavior, and pan-induced request/transfer/decode/path/memory
   behavior for normal regional and antimeridian views.

Full-world composition remains compatibility evidence only; it is not an initial
payload or promotion target for this product.

## Implemented Core Slice

`packages/world-artifacts/src/initial-payload.ts` now provides the transport-free
format-1 pack core: canonical selected-set key derivation, manifest-carrying
binary framing, selected-member identity checks, offset/length validation, and
per-member SHA-256 verification. Atomic tests prove a round trip and that a wrong
selection key or corrupted member is rejected before it could seed a cache.

The Deno Deploy route, outer-compression adapter, and browser cache-seeding
adapter are deliberately still open. The core does not yet claim a one-request
startup path merely because it can encode and verify a pack.

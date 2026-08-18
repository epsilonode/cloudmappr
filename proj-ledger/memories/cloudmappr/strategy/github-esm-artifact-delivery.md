---
id: cloudmappr-github-esm-artifact-delivery
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#isomorphic-mjs-d3-world-map
  - roadmaps/cloudmappr.md#world-artifact-manifest
  - roadmaps/cloudmappr.md#esmsh-selected-shard-delivery
hook: "read before changing GitHub releases, esm.sh imports, package entries, manifest URLs, or server artifact resolution"
---

# GitHub ESM Artifact Delivery

GitHub is the source and release-artifact surface. Build output publishes
compiled MJS controller entries, optional framework/Custom Element adapters, a
manifest entry, and separate world-data artifacts. TypeScript source is never the
browser runtime payload.

esm.sh delivers public GitHub modules through `/gh/<owner>/<repo>@<ref>`. Use one
immutable release reference for a compatible controller, manifest, and shard set.
The manifest owns dynamic artifact URLs; importing the controller never transfers
global geometry eagerly.

Release automation generates artifacts, validates exact world coverage and the
manifest, then publishes the reference clients and Deno resolve. The service must
not silently render a mutable branch or a different world-data release.

Browser module caching and controller fetch caches key by immutable URL. Render
URLs additionally encode the manifest/release identity in their content hash.

## Public Module Surface

The release package exposes only intentional entry points: one controller, one
manifest, optional adapters, and one entry point per world shard. For example,
the public export map may expose `./controller`, `./manifest`, and
`./shards/<id>`. No convenience or barrel entry point may statically re-export
all shards, because that turns a lazy world-data boundary into an eager module
graph.

The browser imports the controller and manifest first. The manifest's normalized
bounds selection then chooses the eager `world-basemap` plus any required lazy
shards. It constructs dynamic imports or fetches from the exact, per-artifact
URLs declared by that release. The controller must never infer, rewrite, or
substitute an artifact URL.

## Release Identity And URL Shape

esm.sh GitHub module URLs use the `/gh/<owner>/<repo>@<ref>` form. A release may
have a human-readable Git tag, but generated manifest URLs must pin the resolved
commit SHA (or another release reference proven immutable) for the controller,
manifest, and every shard. One manifest may not mix references.

Each manifest record includes the shard ID, immutable module or data URL, bbox,
TopoJSON object name, eager/lazy status, content digest, and the shared world-data
release identity. Cache keys use the complete immutable URL. The Deno service
accepts only a known manifest identity and resolves the corresponding recorded
URLs; it does not fetch a branch, latest tag, or arbitrary caller-provided URL.

## Shard Delivery Options

The product has not yet chosen between the following payload encodings. The
release fixture must compare their transferred bytes, parse cost, cache behavior,
and Deno compatibility before selecting one.

1. **MJS shard wrapper.** Each selected module is dynamically imported and
   exports shard metadata plus a JSON payload or loader. This is appropriate when
   the module itself needs executable decoding or a stable ESM-only consumer API.
2. **Separate TopoJSON asset.** The manifest fetches the selected immutable
   `.topo.json` file directly. This is the default candidate for large geometry:
   it avoids embedding data in JavaScript while preserving independent caching
   and the shared browser/Deno decoder.

esm.sh raw delivery may be evaluated for the second option when it can serve the
tag-pinned JSON unchanged. It is a data transport choice, not a substitute for
the controller's public ESM entries. The selected option must keep every shard
independently decodable and retain the manifest as the sole selector.

## esm.sh Transform Policy

Use an explicit browser `target` in public URLs so output does not vary by
request User-Agent. Start with `bundle=false` for controller and shard entry
points, because default submodule bundling can obscure dynamic-import boundaries
and affect `import.meta.url` semantics. Do not use `standalone` for the
controller: it optimizes for a single all-dependency file, not independent
shard caching.

If the controller has runtime dependencies shared with host applications, it may
mark them `external` and document the required import-map entries. This remains
an opt-in integration mode; the default consumer path must resolve without host
import-map configuration. `exports` query tree-shaking is useful only for small
code utilities and must not be used as the geographic shard-selection mechanism.

## Delivery Sequence And Proof

1. Build compiled MJS entries, eight independently decodable artifacts, and a
   manifest into a release directory; TypeScript source is never the payload.
2. Validate coverage, artifact digests, export paths, and that every manifest URL
   uses one release identity.
3. Publish the release to public GitHub, then create an external fixture using
   only the esm.sh controller and manifest URLs.
4. Record network requests for a narrow viewport, a broad viewport, and an
   antimeridian-crossing viewport. Each must fetch the eager basemap plus exactly
   the selected shard set, never all eight by importing the controller.
5. Run the same fixture through Deno and prove it resolves the same manifest and
   shard identities.

The local GitHub Pages pipeline is independent: it may host a demo UI but does
not determine these release URLs or run the Deno rendering API.

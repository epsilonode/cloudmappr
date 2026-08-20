---
id: cloudmappr-local-artifact-development
kind: strategy
status: ready
created: 2026-08-19
updated: 2026-08-20
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#world-artifact-manifest
hook: "read before adding the local artifact directory, development server route, browser artifact URL, or Deno filesystem receiver"
---

# Local Artifact Development

Local development exercises the same release/manifest receiver contract as a
public release. It does not mimic esm.sh, generate data on request, or use a
second unversioned collection of world geometry.

## Directory And URL Convention

The generator emits one complete local release below a configured build root:

```text
build/world/<release-id>/
  manifest.json
  world-basemap.topo.json
  north-america.topo.json
  south-america.topo.json
  europe.topo.json
  africa.topo.json
  asia.topo.json
  oceania-major.topo.json
  antarctica.topo.json
```

`<release-id>` is generated from the source revision, assignment-table revision,
generator revision, and artifact manifest identity. It is never the string
`latest`. Manifest descriptor URLs are relative to `manifest.json`; this makes
the exact release portable between a local route and a public immutable origin.

## Development Composition

The development server exposes only:

```text
GET /artifacts/<configured-release>/manifest.json
GET /artifacts/<configured-release>/<manifest-listed-shard-file>
```

It receives the build root and configured release ID at startup. It resolves a
request only by matching those fixed values to the validated manifest descriptor
set. It sends `404` for every other path, does not list directories, does not
accept a release override from query/path input, and does not proxy remote URLs.

The local manifest response uses `Cache-Control: no-store` so a newly selected
development release is immediately visible. Shards are immutable for the life of
their release ID and may use long-lived cache headers. Restrict CORS to the local
UI origin(s) required by the development task; do not use a permissive origin by
default.

The browser receives the configured localhost manifest URL through its app
composition. The Deno renderer receives the configured release directory through
the filesystem `ArtifactStore`. Neither caller derives a filename from bounds or
from user input. Both call the shared artifact-receiver pure core.

## Delivery Sequence

1. Add the pure receiver contract and fake-port tests first.
2. The fixture generator now writes a real `manifest.json` beside its eight
   generated files and its live proof validates that manifest through the shared
   receiver parser. Move this proven output into a new configured release
   directory only after real-source coverage validation succeeds.
3. Add the constrained local HTTP adapter and filesystem adapter.
4. Add one development task that starts the artifact route and reports the one
   configured manifest URL; keep it separate from the later render API task.
5. Prove browser-like HTTP and Deno filesystem resolution select the same data,
   then connect the browser controller and Deno renderer.

The local GitHub Pages demo can use a separately configured deployed manifest,
but GitHub Pages itself does not host the Deno render API or replace this local
development route.

## Implemented Local Composition

`deno task artifacts:fixture` creates the current fixture release under
`build/world/<release>`. `deno task dev:local` serves its one configured artifact
route plus the local render API. The route admits only the manifest and validated
descriptor files, sends no-store for the manifest and immutable cache headers for
shards, and restricts CORS to configured origins. Live proofs cover the route,
browser-style HTTP receiver, Deno filesystem receiver, shared scene, and
canonical SVG/PNG output. The fixture remains distinct from the pending reviewed
real-world source release.

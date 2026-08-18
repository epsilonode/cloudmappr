---
id: cloudmappr-svg-pre-render-experiment
kind: strategy
status: deferred
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#pre-rendered-svg-land-paths
hook: "read before proposing SVG path artifacts as a replacement for the active D3/TopoJSON baseline"
---

# SVG Pre-Render Experiment

Pre-rendered SVG land paths are not a baseline artifact. Upstream world geometry
is TopoJSON, and any path-artifact conversion must first prove source coverage,
topology/order preservation, antimeridian handling, projection alignment, and
compatibility with runtime geographic points and labels.

The experiment compares immutable SVG-path artifacts against active TopoJSON
shards plus D3 rendering. Measure compressed artifact size, browser network and
parse work, D3/render work, server render cost, image export parity, cache
behavior, and lifecycle complexity.

Retain the baseline unless the experiment improves measured delivery without
reducing the declarative MapSpec, client/server scene parity, canonical image
fidelity, or global-region capability.

## Receiver And Export Requirements

If the experiment is implemented, its receiver may insert only trusted,
release-generated fragments named by an immutable manifest. It must use the same
artifact selection, antimeridian policy, shared immutable-URL fetch cache, layer
order, projection, viewBox, and transform as the active renderer. It must never
accept caller-supplied SVG fragments.

The assembled root SVG remains the canonical export surface. PNG or WebP export
must inline or explicitly resolve styles and first-party assets so canvas output
is not tainted. These requirements are proof gates, not permission to replace the
active baseline before the experiment is accepted.

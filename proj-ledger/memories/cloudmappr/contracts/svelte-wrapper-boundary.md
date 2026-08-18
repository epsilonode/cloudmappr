---
id: cloudmappr-svelte-wrapper-boundary
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#browser-composition-and-export
  - roadmaps/cloudmappr.md#phased-implementation
hook: "read before adding a Svelte map component, Svelte build tooling, or Svelte-specific map behavior"
---

# Svelte Wrapper Boundary

Cloudmappr pre-installs standalone Svelte 5.56.9 as an optional consumer-layer
dependency. It does not use SvelteKit, and Svelte is not a dependency of the
core map specification, scene builder, world-data selection, server renderer, or
framework-neutral MJS controller.

## Ownership

- The preponderance of map work remains in `packages/client` MJS:
  `createMap(host, options)`, D3 joins, artifact loading, projection, overlays,
  export, cloud-render requests, accessibility, and teardown.
- A future Svelte component only creates the host element, constructs the MJS
  controller after mount, forwards declarative inputs and point events, and calls
  controller teardown on destroy.
- The wrapper imports the public MJS client entrypoint. The MJS client, core,
  world-data, and server packages must not import Svelte or depend on Svelte
  lifecycle, reactivity, components, stores, routes, or SvelteKit APIs.

## Non-Goals

- Do not add SvelteKit, file-based routing, server load functions, or a Svelte
  application shell for the map baseline.
- Do not duplicate map state, artifact caches, projection, scene construction,
  image export, or canonical-render behavior in Svelte stores or components.
- Do not make Svelte the required integration path. Vanilla, React, Vue, Custom
  Element, and future adapters continue to consume the same MJS controller.

## Proof Gate

- Add the wrapper only after a vanilla external-consumer fixture proves the MJS
  controller contract.
- A Svelte fixture must prove mount, reactive input forwarding, bubbling point
  events, and destroy cleanup without changing scene or artifact parity tests.

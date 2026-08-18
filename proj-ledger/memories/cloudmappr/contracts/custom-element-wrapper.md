---
id: cloudmappr-custom-element-wrapper
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#component-quality-and-provenance
  - roadmaps/cloudmappr.md#browser-composition-and-export
hook: "read before adding or changing the optional cloudmappr-map Custom Element wrapper"
---

# Custom Element Wrapper

`<cloudmappr-map>` is optional and may be introduced only after the MJS
`createMap(host, options)` controller is proven. It is an integration adapter,
not another map renderer, data decoder, export implementation, or render API
client.

## Public Boundary

- The wrapper accepts controller inputs through properties, including `MapSpec`
  and manifest configuration. Property updates made before connection are retained
  and applied once a controller exists; later updates delegate to that controller.
- The wrapper may expose serializable attributes only for simple configuration.
  `MapSpec` remains a property so geographic data and callbacks are not coerced
  through lossy attribute strings.
- A point activation is dispatched as a bubbling, composed `CustomEvent` whose
  detail contains only the trusted point identity and geographic data supplied by
  the controller. The wrapper does not introduce application business payloads.

## Lifecycle And Isolation

- Render within Shadow DOM so component styles and IDs cannot leak into a host
  application. Host-defined CSS custom properties remain the supported styling
  boundary.
- Connect creates at most one controller. Disconnect destroys it, cancels
  wrapper-owned work, and releases listeners and observers. Reconnection creates
  a fresh controller from the latest properties.
- Registration is idempotent: code checks the custom-element registry before
  defining the tag and never throws merely because another import registered the
  same Cloudmappr element first.
- The wrapper delegates rendering, artifact selection, export, and canonical
  rendering to the MJS controller. It imports neither Deno server code nor
  application/domain code.

## Required Proof

- DOM tests cover property assignment before and after connection, repeated
  connect/disconnect cycles, Shadow DOM ownership, and idempotent registration.
- Tests prove point events cross the shadow boundary and that teardown removes
  generated DOM, observers, and listeners.
- A framework-consumer fixture proves the element remains usable without a
  framework-specific adapter or a duplicate scene implementation.

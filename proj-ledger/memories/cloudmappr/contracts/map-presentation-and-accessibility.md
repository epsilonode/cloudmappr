---
id: cloudmappr-map-presentation-and-accessibility
kind: contract
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#component-quality-and-provenance
  - roadmaps/cloudmappr.md#browser-composition-and-export
hook: "read before changing map styling, sizing, pointer behavior, focus, keyboard support, or motion"
---

# Map Presentation And Accessibility

Cloudmappr presentation is host-controlled and framework-neutral. The map must
remain usable in a standalone MJS host, a future Custom Element, and framework
adapters without mutating page-global styles or accessibility state.

## Presentation Contract

- Expose CSS custom properties for map background, land, labels, markers,
  selected markers, marker stroke, and focus indication. Component defaults must
  be legible in light and dark contexts.
- The host owns dimensions. A zero-size host renders no misleading geometry and
  waits for a usable size; a resize observer updates the SVG camera and scene
  without changing document-global theme or layout.
- Keep visual SVG clipping separate from permanent world-data geometry cropping.
  Styling and viewport changes cannot alter artifact membership or projection
  inputs.
- Respect reduced-motion preferences. Transitions are optional enhancement and
  cannot be required to communicate map state or complete an update.

## Interaction And Accessibility Contract

- The root SVG has an accessible name supplied by the host or a documented
  default. Land paths and static labels are not keyboard tab stops.
- Actionable markers are independently focusable and activate through keyboard
  and pointer input. Pointer handling distinguishes a marker from the underlying
  map so marker activation does not accidentally become a pan or background
  interaction.
- Focus indication uses the configured focus token and remains visible against
  every supported theme. Labels supplement markers but are not the sole focus or
  activation target.

## Required Proof

- DOM tests cover zero-size startup, resize, both themes, reduced motion, marker
  keyboard activation, focus visibility, and the absence of tab stops on land and
  labels.
- Repeated controller lifecycle tests prove observers and event listeners are
  removed and no document-global theme mutation occurs.

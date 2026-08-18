---
id: cloudmappr-runtime-and-functional-baseline
kind: strategy
status: active
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#phased-implementation
hook: "read before adding Cloudmappr runtime dependencies, lint rules, source modules, or tests"
---

# Runtime And Functional Baseline

Cloudmappr uses the latest Deno runtime through root `mise.toml`. Invoke runtime
commands through `mise exec -- deno ...` so local development and automation use
the declared runtime until project tasks are introduced.

## Functional Core

- Core scene, validation, canonicalization, artifact selection, and projection
  functions are pure: explicit inputs produce explicit immutable outputs.
- Browser DOM, fetch/cache, Deno HTTP, rasterization, clock, randomness, and
  storage stay in adapters or composition code. They supply effects to the core;
  they do not own rendering policy.
- Use `readonly` input and output types, object/array copies for updates, and
  `ts-pattern` for exhaustive closed-union branches. Use `remeda` for composed
  collection transformations.
- Represent expected validation, decoding, and transport failures with
  `neverthrow` results. Do not add `effect` to the baseline: one typed-failure
  model is sufficient until a concrete workflow needs a larger effect runtime.
- Build generators follow the same boundary: typed, readonly domain primitives
  and `Result`-returning transformations stay pure; Deno filesystem, network,
  process, and third-party CLI calls are injected ports in composition modules.

## Enforcement And Tests

- ESLint and `eslint-plugin-functional` enforce immutable data, no `let`, no loop
  statements, no `this`, no `throw`, and no `try` in pure core modules. Tests may
  use assertions that throw. `readonly` types remain a source-level requirement:
  the type-aware functional rule is not enabled until a TypeScript project service
  can coexist with Deno-native module checking.
- Collocate tests with their implementation. `<name>.test.ts` covers the adjacent
  atomic function or module, `<name>.seam.test.ts` composes a public boundary with
  fake ports, and `<name>.live.test.ts` is an explicit opt-in real-runtime proof.
- Normal checks run atomic and seam tests without network access. Live tests never
  gate lint, type checks, or ordinary unit feedback. Fixtures live beside the
  behavior they reproduce.

## Research Basis

The baseline combines JTWC's `neverthrow`/`ts-pattern` pure planning approach,
render-web's immutable port-and-adapter boundaries plus colocated test tiers, and
wx-ui-melt's `remeda`/`ts-pattern` transformation discipline. The Deno workspace
pins `neverthrow` 8.2.0, `remeda` 2.39.0, and `ts-pattern` 5.9.0, with ESLint
10.8.0, TypeScript 6.0.3, `typescript-eslint` 8.65.0,
`eslint-plugin-functional` 10.0.0, `@eslint/js` 10.0.1, and `globals` 16.0.0.
These package names and candidate versions were checked on 2026-08-18 for
registry existence, deprecation, malware, and typosquatting signals. Deno's
minimum-dependency-age policy blocked newly published `remeda` 2.42.0, so the
workspace uses the established render-web version instead.

The build-only world-geometry adapter pins `mapshaper` 0.7.53 as a development
dependency. Its use and its stricter functional contract are governed by
`world-artifact-generation-toolchain.md`; it is not a browser or Deno render
runtime dependency.

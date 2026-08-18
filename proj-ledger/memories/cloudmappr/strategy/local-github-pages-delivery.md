---
id: cloudmappr-local-github-pages-delivery
kind: strategy
status: ready
created: 2026-08-18
updated: 2026-08-18
roadmap: cloudmappr
refs:
  - roadmaps/cloudmappr.md#local-github-pages-build-delivery
hook: "read before adding the Pages demo build, preview, or publication command"
---

# Local GitHub Pages Delivery

The Pages demo is built and verified on the developer machine. The repository
does not require a GitHub Actions workflow for this delivery path.

## Publication Boundary

The source branch holds source and build configuration. A local publish command
places the generated static site at the root of a dedicated `gh-pages` branch and
pushes that branch. GitHub Pages is configured to publish that branch root.

Build output is not committed to the source branch. The publication command must
refuse to publish if the local build or verification fails.

## Required Local Commands

- Build the complete static Pages payload into one deterministic output directory.
- Preview that same directory through a local static server before publication.
- Publish the verified directory to the `gh-pages` branch only.

The implementation may use Deno tasks and may use a UI bundler such as Vite if a
future UI needs one. A bundler is an implementation choice, not a Pages delivery
requirement.

## Deliberately Deferred

This decision does not define the public MJS controller, manifest, world-data
artifacts, CDN URLs, esm.sh integration, release tagging, or their build order.
Those remain governed by a later artifact-delivery decision.

## Proof Gate

Before marking this delivery path complete, demonstrate a local build, a preview
of the identical output directory, and a successful publication from the
dedicated branch with no generated Pages files added to the source branch.

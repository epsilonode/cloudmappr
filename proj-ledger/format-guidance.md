# Roadmap Format

Roadmaps are the current-work index for one product. They route a reader to the
one durable card that governs a concern; they do not duplicate a card's full
contract, rationale, or implementation sequence.

## Document Shape

- Begin with `@roadmap <id>`, one `@log` path, `@meta` references for the roadmap
  and memory guidance, `@meta name=roadmap-status`, and an `@updated YYYY-MM-DD`
  summary.
- Use `## @tierN <attention band>` headings. Higher numbers are more urgent.
  Use tier 8 for active delivery, tier 6 for active contracts, tier 4 for ordered
  implementation and proof, and tier 2 for explicitly deferred experiments.
- Use `### @work|@contract|@proof|@risk|@decision|@gap @active|@ready|@deferred`
  headings. Include one compact `@scope` and `@target` statement for every item.
- Keep criteria as `- [ ] @accept ...`. A completed criterion is `- [x] @accept
  ...` followed by a dated `@evidence` reference that is sufficient to audit the
  result.

## Routing

- Add an `@memory <relative path>` entry to every roadmap item that has a durable
  contract, decision, detailed plan, or evidence. The relative path must resolve
  from the roadmap file.
- Route each concern to one primary card. Link a secondary card only when it owns
  an independent cross-cutting constraint, such as projection parity or render
  identity.
- Add a new memory before adding broad roadmap prose when the work introduces a
  stable API, safety boundary, data contract, decision, or proof method.
- Keep an acceptance criterion in the roadmap and its exact rules in the memory.
  Update both links when either side changes; never leave an unlinked card or a
  criterion whose governing card cannot be found.
- Move completed, superseded, or deferred work to the appropriate state rather
  than deleting its routing history. Deferred experiments must state the evidence
  required to promote them.

## Grep Hooks

Roadmaps are a grepable routing surface. During orientation, search `@roadmap`,
`@log`, `@meta`, `## @tier`, and `### @work|@contract|@proof|@risk|@decision|@gap`
before reading a section. Within a selected section, search `@memory`, `@accept`,
and `@evidence` before opening linked card bodies.

Use headings and mentions as stable search anchors. Keep a work item's detailed
contract, rationale, or proof in its governing memory rather than making a
roadmap section too large to route efficiently.

## Quality Bar

- Acceptance criteria describe externally verifiable outcomes, not a file edit or
  a vague intention.
- State shared invariants once in their primary contract and cross-link it from
  dependent work. For Cloudmappr, projection parity, artifact release identity,
  and canonical render identity are cross-cutting invariants.
- Keep application-specific behavior out of framework-neutral product roadmaps.
- Refresh `@updated` whenever roadmap state, routing, or acceptance evidence
  changes.

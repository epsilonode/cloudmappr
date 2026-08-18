# Memory Guidance

Memory cards preserve durable decisions, contracts, plans, and evidence. A
roadmap answers what is current; a memory answers the rules, reasons, sequence,
or proof that remain useful after the work changes state.

## Required Frontmatter

Every card starts with YAML frontmatter containing these fields:

```yaml
id: product-concern-name
kind: contract | strategy | decision | proof | evidence
status: active | ready | deferred | complete | superseded
created: YYYY-MM-DD
updated: YYYY-MM-DD
roadmap: product-id
refs:
  - roadmaps/product.md#owning-roadmap-item
hook: "read before changing the governed boundary"
```

- `id` is stable, lowercase, and hyphenated. Do not reuse an ID for a different
  concern.
- Store cards below `memories/<product>/<kind>/` using the ID suffix as the file
  name. Keep card paths and `refs` relative to `proj-ledger/`.
- `hook` is an imperative routing cue that names the change a reader must check
  before making. It must be specific enough to select the card without reading
  every memory.
- `refs` points to every owning or materially dependent roadmap item. A new card
  is not complete until the owning roadmap also contains its `@memory` link.

## Card Shapes

- A `contract` states invariants, accepted inputs, rejected inputs, ownership
  boundaries, and the proof required to keep the boundary intact.
- A `strategy` states objective, non-goals, delivery sequence, dependencies, and
  proof gates. It may retain detailed implementation order.
- A `decision` states context, chosen option, alternatives, consequences, and the
  explicit trigger for reconsideration.
- A `proof` or `evidence` card states scope, fixture or method, result, limits,
  and links to the evidence artifact.

## Routing And Maintenance

- Read the relevant card before changing its governed concern, then update the
  card and its roadmap criterion together when the durable rule changes.
- Prefer one primary card per concern. Cross-link independent constraints instead
  of copying them, so projection, artifact, and render rules cannot drift.
- Mark a card `complete` only when its own planning or proof objective is met;
  use `superseded` rather than deleting a durable historical decision.
- Keep short cards as precise routing records. Expand only cards that need an
  exact sequence, API contract, or proof gate to prevent a costly regression.

## Discovery Is Grep-First

- Find relevant cards by searching memory Markdown for the task term, then inspect
  `^hook:`, `^id:`, `^kind:`, `^status:`, and `^refs:` before reading a body.
- Use a card's `hook` to decide whether it governs the proposed change. Read its
  body only after that routing check succeeds.
- Search source code only after a selected roadmap item or memory identifies an
  exact symbol, route, artifact, filename, or proof target. Use `Glob` to locate
  paths and `Grep` to narrow content before opening source files.

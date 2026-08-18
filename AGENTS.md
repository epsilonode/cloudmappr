# Cloudmappr Agent Entry

Start with `proj-ledger/control.yaml`. It is the active-roadmap router and
defines the project's progressive-disclosure path.

## Tiered Routing (T0)

Do not read an entire roadmap or all memory cards to orient. Read
`proj-ledger/control.yaml`, then use its grep pattern against the active roadmap
to select one tier and work item before opening detailed context.

Use `proj-ledger/discovery-guidance.md` when the relevant roadmap item, memory,
or source area is unclear. It defines the grep-first path from ledger orientation
to a narrow codebase search.

## File And Tooling Discipline

- Use native file tools for file reads, searches, and edits. Do not use PowerShell
  for file manipulation or one-off text processing.
- Use `Glob` to locate candidate paths and `Grep` to find headings, ledger hooks,
  exact symbols, route paths, filenames, and error text before reading bodies.
- `mise.toml` owns the project runtime. Use `mise exec -- deno ...` for Deno
  commands rather than relying on a globally installed binary.
- Read `proj-ledger/format-guidance.md` before changing a roadmap and
  `proj-ledger/making-memories.md` before creating or changing a memory card.
- Keep durable outcomes in the roadmap, memory cards, and append-only log named
  by the selected ledger route; do not leave important discoveries only in chat.

# Discovery Guidance

Use this guide when the active roadmap item, governing memory, or source area is
unclear. It preserves the T0-T3 routing budget while giving agents a repeatable
path to relevant implementation context.

## Grep-First Orientation

Search hooks before reading bodies. At T1, grep the active roadmap for
`@roadmap`, `@log`, `@meta`, `## @tier`, and `### @work|@contract|@proof|@risk|@decision|@gap`.
Choose the tier and item that match the request, then read only that section.

At T2, inspect the selected section's `@memory`, `@accept`, and `@evidence`
lines. Grep linked memory cards for `^id:`, `^kind:`, `^status:`, `^refs:`, and
`^hook:` before opening a card body. The hook determines whether the card governs
the intended change.

## Source Exploration

Move to source exploration only after T1 or T2 identifies an implementation
question, contract boundary, or proof target.

- Use `Glob` to locate a known filename, extension, or source area.
- Use `Grep` for exact exported symbols, API routes, filenames, manifest fields,
  error text, and identifiers from the selected roadmap item or memory card.
- Read only the files returned by those searches. Expand the search deliberately
  when the result shows a direct caller, implementation, or test dependency.
- Prefer a narrow symbol or path search over broad tree browsing. Do not search
  unrelated historical material unless the active route or user request names it.

## Promotion And Boundaries

If exploration finds a durable constraint, decision, proof gap, or risk, update
the selected roadmap item and its primary memory card together. Append a concise
log entry for a meaningful outcome. Do not let a finding remain only in chat.

Return to the ledger when a source search broadens scope. Record the new blocker,
gap, or follow-up instead of silently expanding the task beyond the selected item.

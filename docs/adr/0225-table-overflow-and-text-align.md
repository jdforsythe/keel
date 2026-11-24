# ADR-0225: k.ui: a scroll region for a wide table, and `textAlign` (RFC 0203)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** A table keeps its words whole, so at a narrow viewport it can be wider than the page: golden-2's catalog table is 569px at 390px (582px in de-DE) and the whole page scrolls sideways. The style vocabulary has no overflow, and a plain scroll container a keyboard cannot reach, or one with no name, fails WCAG 2.1.1 and 4.1.2. Every `th` is centred by the browser's own stylesheet over cells that start at the start, and the vocabulary has no text alignment, so a numeric column cannot be aligned to its end either. The compiler collects style props only from the app's own literals, so a std component cannot pick a class itself.

**Decision.**
- `Box scroll="x"` is the one scroll container: a `div` with `role="region"`, `tabindex="0"`, class `k-scroll`, and a name from `label` or `labelledBy`, exactly one (E1802). `scroll` is structural, read at build, and takes no `as`.
- `textAlign` is a keyword style prop with the logical values `start`, `center`, `end`; there is no `left` or `right`, and an unknown keyword is E1801.
- The `keel.base` layer holds `th{text-align:inherit}` and `.k-scroll{overflow-x:auto;min-width:0}` with any tokens.
- `DataTable` takes `scroll?: "x"`, which wraps its `table` alone, not the pager, in a `Box scroll="x"` named as the table is. Its `styles` take `column.<col>` per shown column, spread on that column's header and cells after `header` and `cell`; an unknown key is E2851.
- No new diagnostic code.

**Alternatives.**
- An `overflow` style prop: a look, state or breakpoint could set it, and the role, tab stop and name would follow a class.
- A region around every `DataTable`: a Tab stop and a landmark on tables that do not overflow.
- Alignment in `columns` with a `number` default: `DataTable` would have to emit a class the app never wrote.
- `left` and `right`: wrong in `rtl` locales.

**Consequences.** golden-2's catalog fits 390px in en-US and de-DE and its table scrolls in a named, focusable region. Every app's headers align with their cells, and its stylesheet grows by 60 bytes. A numeric `DataTable` column is aligned `end` by the app through `column.<col>`, not by default. std.tables reads `implemented` until its new clauses are covered.

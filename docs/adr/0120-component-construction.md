# ADR-0120: components and op children are built untracked (RFC 0097)

**Status:** accepted

**Context.** `renderUnit` builds each child of `If`, `For`, `Match`, `Boundary`, a route page and the `mount` root inside an `effect`, and components are called inline while it runs, so a reactive read in any component body subscribes the nearest unit. A change then disposes the unit and builds it again: local signals reset and focus falls to `<body>`. A `Combobox` whose `options` read a page signal rebuilt the page on each keystroke; std-headless and std-tables each read through an `owner().run` helper to avoid it. The spec already treats a top-level read as read once (E1405, the keyed `For` row, k.head's revalidation sentence), and bindings are the documented way to update.

**Decision.**
- D1: `renderUnit` runs its render through the unit scope's `run`: a read made while a component or an op child is built is its value at build and subscribes nothing. Bindings, `computed`, `effect` and each op's own input still track. Stated as a new k.component Build paragraph.
- D2: the router root renders the committed view through a `list` keyed by the view; the hand-built `For` keys rows by item object (first per `key`), so a navigation and a new row object still render anew. k.router states that `data` is a getter revalidation updates in place.
- D3: both `untracked` helpers, their four call sites and the keyed row's per-read untracking are removed.
- 0593 (keep the page across a search-only navigation) is its own RFC after D1 lands; the recommendation is to keep the page and update `search` and `data` cells in place.
- Budgets: none re-based. runtime-dom 4,230 B (-7), router 10,372 B (+44).

**Alternatives.**
- Untrack in the compiler (`scoped` and each JSX call site), rejected: hand-built widgets built inside a stdlib op child stay tracked, the helpers stay, and the compiler has 44 B left.
- A public `untracked` for widget authors, rejected: the workaround made public; app components still reset their page.
- A diagnostic for top-level reads, rejected: a read through a function prop or another module's store is invisible to a static rule.
- Keeping the tracked re-render as a documented way to rebuild a subtree, rejected: it loses state and focus and contradicts E1405 and k.head.

**Consequences.**
- With D1 to D3, every package suite and golden-1, golden-2, inspector and sessions pass; 6 tests in 5 files relied on the re-render, all hand-built fixtures: `packages/runtime-dom/test/keyed-rows.test.ts:171` (a plain `each`) and `packages/std-sessions/conformance/group-fixtures.ts:160-181` (string-returning `children` thunks), fixed by a getter and a `computed`.
- Two app reads that reset today stop resetting: golden-2 `BoxShell.tsx:60`, `:74` on revalidation, golden-1 `OutboxPanel.tsx:98`.
- Label-like props of 18 hand-built widget bodies show their first value if an app changes them while mounted; none does.
- A `Case` reading `value()` at its top level no longer re-renders under the same tag.
- Resume keeps claimed nodes when a top-level read changes; the server render is untouched.
- k.component goes to 1,458 tokens, k.router to 1,343; four new ledger items.

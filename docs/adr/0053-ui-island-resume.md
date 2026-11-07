# ADR-0053: base elements and child components resume in place (RFC 0064)

**Status:** accepted

**Context.**
- Islands built from `@keel/ui` elements re-rendered at resume (E1253). Base elements were made with `createElement`, which claims nothing. A child component in a template replaced its anchor, so the template's shape never matched its server element (backlog 0174).
- The re-render lost text typed before the runtime loaded, and the focus.

**Decision.**
- **One claim cursor.** `element(tag, fill)` in `@keel/runtime-dom/ops` creates an element, or while resuming claims the next server element, and runs `fill` with that element's children as the region. Base elements build every node through it, in document order. `clone` and `element` share `claimNext`.
- **Slots.** The compiler lowers each non-flow template child to `slot(anchor, () => child)`. Components and nested elements get the anchor `<!--+-->`, which the shape check reads as one element of any tag. While resuming, `slot` hands that element to the child as its root.
- **Text is re-created.** A claimed base element drops its text and comments, and `fill` writes them again. A textarea keeps its text, which is its default.
- **No moves where avoidable.** `appendChildren` leaves a claimed node in place and inserts new nodes before the next one. Compiled fragments still move nodes, so resume gives the focus back and silences and drops the focus events of the moves.
- **Edits win.** A ui control's first reactive write checks `edited` and keeps a changed control (as `Field.bind`, rfc:0062).

**Alternatives.**
- Copy control state into fresh nodes. Server nodes would lose identity.
- `data-k` on every base element. Every route using one would become an island.
- A fragment op in compiled output. More compiler bytes than the focus repair.

**Consequences.**
- A `Box`-rooted island and a template with ui controls or compiled child components resume without E1253. The server nodes, the user's edits and the focus are kept.
- Compiled modules emit `__k.slot` and `<!--+-->`. Rendered HTML is unchanged.
- `@keel/compiler` +27 B gzip (24,532 of 24,576). `@keel/ui` +314 B (3,031 of 4,096). The `@keel/runtime-dom` entry is unchanged.
- **Known limits.** A route made only of base elements is not an island on the server (no `data-k`). A structural op directly under a base element, and a slot child that renders text or several nodes, are still E1253.

# RFC 0090: a keyed `For` row keeps its element

Status: accepted by the orchestrator (2026-11-12) under WORKFLOW RFC defaults 1 and 6, after the user said to decide and keep moving; the user confirms or reverses it (`docs/HANDOFF.md`, pending decisions). For backlog 0392 and 0439.

## Decisions (orchestrator, 2026-11-12)
- D1: the guarantee of Proposal 1 as written.
- D2: Proposal 3 is a kernel check rule, E1405, an error with a fix.
- D3: the hand-built `For` keeps its present behavior.

## Problem
In golden-1's list page, focus drops to `<body>` after every write. Measured in a browser (backlog 0392) and reproduced in `packages/runtime-dom` tests:

1. A write is followed by a refresh that re-reads the board, so every todo is a new object.
2. A `For` row re-renders when its body reads the item at top level and the item object changed (`packages/runtime-dom/src/ops/list.ts`, the row's render effect). A compiled row passes the item to a component as a getter prop, and `@keel/ui` `Box` reads `props.id` at top level, so every row reads it.
3. Every row is rebuilt for one toggle; the focused control's element is replaced.
4. `place()` also moves surviving rows when a row is inserted, which drops focus without any rebuild.

No spec section says what a key keeps. k.component has only `<For each={} key="id">`.

## What was tried
A patch (`tasks/0432-friction-batch1/keyed-rows-0392.patch`) makes a top-level read of the item untracked in a keyed row and places rows in one forward pass. Surviving rows keep their element and focus; bindings still update. `@keel/runtime-dom` grows 62 B.

It cannot land alone. A component that reads a getter prop once goes stale in a kept row: `@keel/ui` `Checkbox` reads `checked` once and its label reads `label` once, so a toggled row shows the old state (two golden-1 tests fail). `ui-getter-bindings-0392.patch` binds those two; `Link` `to` has the same read and no test. Any app component has the same hazard, in a row or anywhere a prop changes after the first render.

## Proposal
1. **Guarantee (k.component).** A `For` row whose key stays across a change of `each` keeps its nodes. Its bindings update from the new item. A top-level read of the item in the row body does not re-render the row. An insert or a removal moves no surviving row.
2. **`@keel/ui` binds every prop it renders.** No control reads a prop once into the DOM.
3. **A check rule for the hazard.** A component that writes a prop to the DOM outside a binding (a top-level `props.x` read whose value reaches an attribute, a text node or a child's props) is a diagnostic with a fix that wraps the read in a binding. The compiler already emits getters for props at call sites, so the rule is local to the component file. It is E1405 (k.component), an error.
4. **Unkeyed `For`** keeps its present behavior.

## Alternatives
- **Keep rebuilding, restore focus by element id after the rebuild.** Loses caret, selection, scroll and IME state, and announces the control again to a screen reader.
- **Patch the old row's DOM from the new render (a morph).** The row body runs again and a diff is applied. Larger runtime, a second way to update the DOM, and identity rules of its own.
- **Keep item identity in the store (structural sharing in `syncAfter`).** Fewer rows rebuild, but the changed row is the focused one, so focus is still lost.
- **Land the runtime patch and the two `ui` fixes without the rule.** Fixes golden-1 and leaves the stale-prop hazard for every other component.

## Spec diff
- **k.component** Control flow: one sentence (Proposal 1) and one Conformance clause: "Replacing `each` with new objects of the same keys keeps each surviving row's element and `document.activeElement`, and updates the changed row's text."
- **k.component** Rules: E1405.

## Token impact
k.component gains about 50 tokens. `@keel/runtime-dom` 4,066 B to 4,128 B of 6 kB.

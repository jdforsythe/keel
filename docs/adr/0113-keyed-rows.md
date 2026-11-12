# ADR-0113: a keyed `For` row keeps its element; a one-time prop read that reaches the DOM is E1405 (RFC 0090)

**Status:** accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults 1 and 6; awaiting the user's confirmation.

**Context.** A refresh replaced every item object, every `For` row re-rendered, and focus fell to `<body>` after each write. Keeping the row exposes components that read a prop once: they show the old value in a kept row.

**Decision.** A `For` row whose key stays keeps its nodes; its bindings update from the new item; a top-level read of the item re-renders nothing; an insert or removal moves no other row. `@keel/ui` binds every prop it renders. A prop read once at a component's top level whose value reaches the DOM or a child's props is E1405, with a fix that reads it in a binding. The hand-built `For` keeps its present behavior.

**Alternatives.**
- Rebuild and restore focus by id, rejected: caret, selection, scroll and IME state are lost.
- Morph the old row from a new render, rejected: a second way to update the DOM.
- Structural sharing in the store only, rejected: the changed row is the focused one.

**Consequences.**
- Focus, selection and input state survive a refresh.
- Existing components with a one-time prop read fail `keel check` until the fix is applied.

# @keel/runtime-dom

**Spec:** k.runtime · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `.`: `mount(Component, el) -> dispose` · intrinsics `If`, `For`, `Match`, `Case`, `Boundary`. `./ops` (compiler and generated entry only): `template`, `clone`, `text`, `attr`, `prop`, `on`, `cond`, `list`, `match`, `boundary`, `resume(root, components, stores?) -> { warnings }`.
- **Invariants:** each binding is one `effect` in the owning scope writing one DOM location, only on change. `attr`: `null`/`false` removes, `true` sets empty; URL attributes with a scheme other than http/https/mailto/tel become `about:blank`. Bubbling events: one root listener per type, innermost handler first, `stopPropagation` honored; non-bubbling types bind on the element. `dispose` removes nodes, listeners, and subscriptions. Structural ops render before an anchor node; keyed `list` rows move, never re-create. `Boundary` catches render, binding, and handler throws or rejections; fallback gets `keel.unexpected` with `data.at`. `resume` claims server nodes in place (identity kept; regions `<!--[-->…<!--]-->`); a mismatch re-renders that island and warns E1253.
- **Import-time effect (only one):** importing `./ops` (which exports `resume`) adds capture listeners on `document` queueing events inside unresumed islands; `resume` replays them once, in order. The generated entry imports it first.
- **Dependencies:** `@keel/reactive`, `@keel/schema`.
- **Rungs:** conformance; properties (attr sequences, delegation order, listener hygiene, URL rule, keyed rows, resume).

## Extension points

None.

## Unsafe

count: 0

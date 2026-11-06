# @keel/runtime-dom

**Spec:** k.runtime · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `.`: `mount(Component, el) -> dispose` · intrinsics `If`, `For`, `Match`, `Case`, `Boundary`. `./ops` (compiler and generated entry only): `template`, `clone`, `text`, `attr`, `prop`, `on`, `cond`, `list`, `match`, `boundary`, `resume(root, components, stores?) -> { warnings }`.
- **Invariants:** each binding is one `effect` writing one DOM location, only on change. `attr`: `null`/`false` removes, `true` sets empty; URL attributes (incl. `poster`, `ping`) with a scheme outside http/https/mailto/tel, and any `srcdoc`, become `about:blank`. Events: one root listener per bubbling type, innermost first, once per element across nested mounts, `stopPropagation` honored; non-bubbling types bind directly. `dispose` removes nodes, listeners, subscriptions. Structural ops render before an anchor; keyed rows move, never re-create. `Boundary` catches render, binding, handler, and app `effect`/`computed` throws and handler rejections; fallback gets `keel.unexpected` with `data.at`. `mount` adds a root Boundary (`<pre data-k-error>`). `resume` claims server nodes in place (regions `<!--[-->…<!--]-->`); a mismatch re-renders that island, drops its queued events, warns E1253.
- **Import-time effect (only one):** importing `./ops` adds capture listeners on `document` queueing events in unresumed islands; `resume` replays them once, in order. The generated entry imports it first.
- **Dependencies:** `@keel/reactive`, `@keel/schema`.
- **Rungs:** conformance; properties (attrs, delegation, listeners, URLs, keyed rows, resume, boundaries).

## Extension points

None.

## Unsafe

count: 0

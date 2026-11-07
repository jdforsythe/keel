# @keel/runtime-dom

**Spec:** k.runtime · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `.`: `mount(Component, el, { ctx?, onError? }) -> dispose` · intrinsics `If`, `For`, `Match`, `Case`, `Boundary`. `./ops` (compiler and generated entry only): `template`, `clone`, `text`, `attr`, `prop`, `on`, `cond`, `list`, `match`, `boundary`, `resume(root, components, { ctx?, stores? }) -> { warnings }`; root components get `ctx` third. `./url` (kernel packages only: compiler, ui; the one URL policy): `URL_ATTRS` (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `ping`, `data`, `srcset`, `imagesrcset`, `to`, `from`, `by`, `values`), `RAW_HTML_ATTRS` (`srcdoc`), `isSafeUrl(name, value) -> boolean`, `isRefusedAttr(tag, name) -> boolean`, `safeUrl(name, value) -> value | "about:blank"`. `./jsx-runtime` (types only): the `JSX` namespace for `jsxImportSource: "@keel/runtime-dom"`.
- **Invariants:** each binding is one `effect` writing one DOM location, only on change. `attr`: `null`/`false` removes, `true` sets empty; URL attributes (incl. `poster`, `ping`) with a scheme outside http/https/mailto/tel in any list item (`ping`/`srcset`/`imagesrcset` split at whitespace and commas, `values` at `;`), and any `srcdoc`, become `about:blank`; an `on*` name or a `<base>` `href` binds nothing (rfc:0056). Events: one root listener per bubbling type, innermost first, once per element across nested mounts, `stopPropagation` honored; non-bubbling types bind directly. `dispose` removes nodes, listeners, subscriptions. Structural ops render before an anchor; keyed rows move. Each row/branch is a render unit created in its op's own scope (`scope.run`), disposed on removal; no per-commit nodes. `Boundary` catches render, binding, handler, and app `effect`/`computed` throws and handler rejections; fallback gets `keel.unexpected` with `data.at`. `mount` adds a root Boundary (`<pre data-k-error>`) and calls `onError(error)` for each error it catches. `resume` claims server nodes in place (regions `<!--[-->…<!--]-->`); a mismatch re-renders that island, drops its queued events, warns E1253.
- **Import-time effect (only one):** importing `./ops` adds capture listeners on `document` queueing events in unresumed islands; `resume` replays them once, in order. The generated entry imports it first.
- **Dependencies:** `@keel/reactive`, `@keel/schema`, `@keel/ctx`.
- **Rungs:** conformance; properties (seed 1337).

## Extension points

None.

## Unsafe

count: 0

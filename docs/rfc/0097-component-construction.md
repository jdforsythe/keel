# RFC 0097: components and op children are built untracked

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 1, 3, 6; open questions answered as recommended; the user confirms or reverses, tasks/0337-s7-ui-modules/PLAN.md D20). For backlog 0571; backlog 0593 gets its own RFC (section 0593 below). Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0120 records it.

## Decisions
- D1 (0571): every unit render is untracked. `renderUnit` (`@keel/runtime-dom`), which builds each child of `If`, `For`, `Match`/`Case`, `Boundary`, a route page and the `mount` root, runs its render through `Scope.run`, so a reactive read made while a component or an op child is built is its value at build and subscribes nothing. This covers every component however it is called: compiled JSX, a hand-built `.ts` call, stdlib widgets, the router, `mount` and the harness. Only bindings, `computed` and `effect` made there, and each op's own input (`when`, `each` and its keys, `on` and its tag, a Boundary's `reset`) track (defaults 1, 6, 3).
- D2 (0571): the two kernel places that relied on a tracked unit render track explicitly. The router's root renders the committed page through a `list` op keyed by the committed view, so a navigation still renders the new page and revalidation still updates `data` in place. The hand-built `For` keys its rows by item object (the first item per `key` wins, as today), so a new object for a kept key still renders that row anew (defaults 3, 2).
- D3 (0571): the stdlib workarounds go. `packages/std-headless/src/internal/untracked.ts`, `packages/std-tables/src/internal/untracked.ts` and their four call sites are removed, and the compiled row's per-read untracking in `list` (`reaction() === top`) is removed, since the row render is untracked as a whole (default 2).
- D4 (0593): separate RFC, after D1 lands. Recommendation: keep the page across a search-only navigation and re-run its loaders into the existing tree, as revalidation does; keeping only live regions is a second mechanism for one symptom. What that RFC must decide is listed under 0593.

New codes: none. No compiler change; k.runtime, k.reactive and k.head are untouched.

## Problem
Measured on `jdforsythe/test-impl` at `1dd29eb` (the rest of the tree changed since touches no file named here).

**How a component tag is built today.**
- The compiler lowers `<Child a={x}/>` to a direct call `Child({ get a() { return (x); } }, undefined, ctx)`, emitted inline in the parent's code (`packages/compiler/src/internal/lowerFile.ts:556-590`). A compiled component's body is wrapped in `scoped(() => …)` (`lowerFile.ts:750-777`), and `scoped` is `(f) => { let v; scope(() => { v = f(); }); return v; }` (`lowerFile.ts:780-785`). A non-detached `scope(fn)` keeps the running reaction (`packages/reactive/src/scope.ts:20-27`, `:52-60`; only `detached` and `Scope.run` untrack, `:36-41`), so the body runs tracked by whatever computation called it.
- That computation is a unit. `renderUnit` runs `render` inside an `effect` (`packages/runtime-dom/src/internal/renderUnit.ts:53-87`); the op calls it inside `home.run` so the op's own effect is not subscribed (`cond.ts:43-45`, `boundary.ts:59-63`, `match.ts:51-62`, `list.ts:101-131`). Every read the render makes, including the synchronous body of every component called inside it, subscribes that unit's effect.
- On a change, the effect re-runs `clear()` first: it disposes the unit's owner (every scope, signal and binding made in it) and removes its nodes (`renderUnit.ts:46-52`, `:56`), then renders from scratch. Local signals reset, the focused element is removed (focus falls to `<body>`), and an `input`'s typed text is lost.
- The unit is the nearest op child, not the reading component. A read in a component with no `If`, `For`, `Match` or `Boundary` above it inside its page re-renders the whole page: the router's root renders the page inside the root `boundary`'s unit (`packages/router/src/internal/createRouterWith.ts:358-365`), and a route with an `errorElement` adds its own `boundary` (`renderView.ts:44-52`).
- Uncompiled components (every stdlib widget and every `@keel/ui` element is hand-built `.ts`) get no scope of their own and run in the caller's (`grep scope( packages/std-*/src packages/ui/src`: no component creates one). The compiler's `scoped` therefore cannot reach them; only the unit can.

**Where it hurt.** Building golden-2's catalog, a `Combobox` whose `options` read a signal re-rendered the whole page on each keystroke (`tasks/0337-s7-ui-modules/PLAN.md` D13). Two packages now read through `owner().run`: `packages/std-headless/src/internal/untracked.ts:7-10`, used at `internal/listChart.ts:36`, `:39` and `Toaster.ts:48`; `packages/std-tables/src/internal/untracked.ts:7-10` (the same five lines), used at `DataTable.ts:85` (the header slot) and `:233` (the first view). The regression tests are `packages/std-headless/test/signalLists.test.ts` and `packages/std-tables/test/parentSignals.test.ts`: each counts parent runs and asserts 1 after the signal changes.

**What the spec says today.** No section states that a top-level read re-renders. Three sentences say the opposite or assume it:
- k.runtime Ops: "Each binding is an `effect` in the owning component's scope that writes exactly one DOM location." This is the documented way to make a component reactive: read the value in a binding (`{props.x}`, an attribute expression), or, in hand-built code, pass a signal or computed as the value or child (k.ui Base elements: "a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound").
- k.component Shape, E1405: a top-level `const` of props used in JSX "reaches the DOM or a child's props once; the fix reads it in the binding."
- k.component Control flow: in a keyed `For` row "a top-level read of the item re-renders nothing", implemented as a per-read exception (`list.ts:112-121`), whose doc comment says "other top-level reads still do, as in any unit" (`list.ts:19-20`).
- k.head Client: "Revalidation (an action's `ok(null)`) … changes nothing else: no element or text node is rebuilt." Today a page that reads `props.data` at its top level is rebuilt by revalidation: `data` is a getter over the level's cell (`renderView.ts:20-35`), the cell is set in place (`createRouterWith.ts:261-264`), and the read subscribed the root unit.
- k.reactive: `scope.run` runs "untracked (writes are still checked)"; the conformance has "Reads inside `run` do not register dependencies of an enclosing effect." D1 reuses exactly that.

**Kernel code that relies on the tracked render.** Found by reading every caller of `renderUnit`, `boundary`, `cond`, `list` and `match` in `packages/*/src` (8 sites), then confirmed by running the suites with D1 alone:
- The router root: its `boundary` children read `view.get()` in the render (`createRouterWith.ts:360-363`); a committed navigation re-renders the page only through that read.
- The hand-built `For` (`packages/runtime-dom/src/intrinsics/For.ts:29-40`): rows get plain values and re-render on a new item object through `computed(item).get()` in the row render ("this row must track it").
- `match` passes `value.get` to the case (`match.ts:60`); its doc comment says "within a case, `value()` tracks the current union value". A binding reading `value()` still tracks; a top-level read stops re-rendering the case. No test asserts the top-level form.
- `Form` (`packages/router/src/Form.ts:12-16`), `mount`, `renderView`'s per-route `boundary`, the harness (`openHarness.ts:66-75` through `mount`) and `resumeIsland` read nothing reactive in their render.

**Measured: the suites with D1 and D2 applied** (a copy of the tree, `vitest run` per package, 39 packages and apps):
- Green with no edit: every other package suite (35, including runtime-dom's 435 other tests, router, testing, ui, forms, store, server, compiler's 990, every `std-*` but std-sessions, `check`, `cli`, `scaffold`), and golden-1 (124 tests), golden-2 (75), inspector (17), sessions (14).
- Red, 6 tests in 5 files, all hand-built fixtures that read a signal in a render and relied on the re-render:
  - `packages/runtime-dom/test/keyed-rows.test.ts:171-184` ("For (hand-built, plain values) re-renders a row for a new item object"): passes `each: items.get()`, a plain array read in the `mount` root, so only the root's re-render ever showed the new item.
  - `packages/std-sessions/conformance/group-fixtures.ts:160-181`: the `board.show` page passes `children: () => view.get("title")` (and `note`, `caller`, `items`, `status`) to `Text`; `@keel/ui` calls a children thunk once at build (`packages/ui/src/internal/renderChildren.ts:5-6`), so the text updated only by re-rendering the page. It fails `conformance/group-isolation.test.ts:23` and its property, `group-replay.test.ts` (1), `group-schedule.test.ts` (1) and `test/group-handle.test.ts:16`. Each passes on the unchanged tree.
- With D3 as well (workarounds removed, the two fixtures given a getter and a `computed`): runtime-dom, router, testing, ui, std-headless, std-tables, std-sessions, golden-1 and golden-2 green, including `signalLists.test.ts` and `parentSignals.test.ts` with no `untracked` left in the stdlib.

**What apps and the stdlib read at build.** A read-only pass over every component body (golden-1 8, golden-2 6, inspector 7, sessions 1, and 24 hand-built in `@keel/ui`, the router, std-headless, std-tables and std-health) classified each build-time read by what D1 does to it:
- Fixes a reset, 2 in apps. `apps/golden-2/modules/recipes/BoxShell.tsx:60`, `:74` pass `label={props.data.text.navLabel}` (and `localesLabel`) to `Box`, which reads the getter at build (`packages/ui/src/elements/Box.ts:34`); toggling a favorite on `recipes.show` revalidates (`ok(null)`), so today the shell and page are rebuilt and focus is lost. `apps/golden-1/modules/todos/OutboxPanel.tsx:98` `disabled={… editorStuck()}` is read at build by `applyDisabled` inside an `If` branch, so today both buttons are rebuilt when it flips. After D1 both update through the bindings `@keel/ui` already makes.
- No change, the rest of the app reads: `props.params` and `props.search` are plain values per view (`renderView.ts:18`); `props.data` reads that only seed a form (`apps/golden-1/modules/todos/EditTodoPage.tsx:44`, `apps/golden-2/modules/recipes/NewRecipePage.tsx:23`) on routes whose action navigates; inspector and sessions read nothing at build.
- Value at build in hand-built widgets, 18 bodies, none changing while mounted in any app: label-like getter props read once (`Combobox.ts:64`, `:82`, `Listbox.ts:50`, `Tabs.ts:48`, `Dialog.ts:41-43`, `:66`, `Disclosure.ts:35`, `Menu.ts:65`, `:94`, `Toaster.ts:105`, `TableSearch.component.ts:48`, `DataTable.ts:32` and its `text` reads, `std-health/src/HealthView.ts:6`), `Tabs.ts:92` building a panel in a row, and `@keel/ui`'s `as`, `level` and handler props. Today a change to any of them rebuilds the enclosing unit; after D1 it shows the first value. Every app passes literals, message-set text fixed per locale (a locale change is a navigation, a new view), or values that only change by navigation. Known limits lists it.

## Proposal

### D1. `renderUnit` renders untracked
In `renderUnit.ts:64-69`, inside the unit's `scope`, the render runs through that scope's `run`:

```ts
scope(
  () => {
    const sc = running(); // `owner` from @keel/reactive: this unit's scope
    box.out = sc === undefined ? withCx(o, hydrate, render) : sc.run(() => withCx(o, hydrate, render));
  },
  catcher === null ? {} : { onError },
);
```

`Scope.run` sets the owner to the unit's scope and the reaction to a disposed copy of the running one (`scope.ts:36-41`): reads subscribe nothing, writes are still checked against the unit effect's `writes` (E1201 keeps firing), and primitives made in the render belong to the unit's scope as today. The unit's `effect` now tracks nothing, so it runs once; `dispose` (the op's) is the only way a unit leaves. Hydration claims, the catcher, `onError` and node bookkeeping are unchanged.

What stays reactive, unchanged: each binding (`text`, `attr`, `prop`, `element` fill bindings) is its own `effect`; a `computed` or `effect` made in a body tracks its own reads; `If` re-renders on `when`'s truthiness (`cond.ts:20`, a computed outside the unit), `For` on its key set (`list.ts:36-43`), `Match` on its tag (`match.ts:27`), `Boundary` on `reset()` (its `state` signal, read by the op's effect, `boundary.ts:52`).

### D2. The router root and the hand-built `For` track explicitly
- **Router root.** The root `boundary`'s children become a fragment with one `list` (from `@keel/runtime-dom/ops`, as `boundary` is) over `() => { const v = view.get(); return v === null ? [] : [v]; }`, keyed by the view object, whose row renders `renderView(item(), ctx)`. A committed navigation sets a new `View`, so the old row is disposed and the new one renders, exactly as the tracked read did; revalidation keeps the `View` and sets its cells (`createRouterWith.ts:261-264`), so the page stays and its `data` bindings update. The root's error fallback and `reset` are unchanged.
- **Hand-built `For`.** `For.ts` passes `list` the first item per `key` (by the index map it already builds) keyed by the item object, and the row renders `props.children(item(), index)`. A new object for a kept key is a new row in the same place (the row before it was the same key's), a move keeps the row, an unchanged object keeps it. The `computed` import goes. Called from a `.ts` file, `each` must be a getter to change while mounted; every stdlib `For` call passes one already (7 calls: `Combobox.ts:86`, `Listbox.ts:69`, `Menu.ts:79`, `Tabs.ts:53`, `:79`, `Toaster.ts:116`, `DataTable.ts:169`).

### D3. Remove the workarounds
- `std-headless`: `listChart.ts:36` becomes `list.get();` (it still checks the keys at build, E2801), `:39` reads `list.get()` directly, `Toaster.ts:48` calls `items()`; `internal/untracked.ts` is deleted.
- `std-tables`: `DataTable.ts:85` calls the header slot directly, `:233` reads `view.get()`; `internal/untracked.ts` is deleted.
- `runtime-dom`: `list.ts` drops the `reaction` import from `@keel/reactive/internal`, the `top` capture and the `read` helper; the row gets `() => itemC.get()` and `() => indexC.get()`. The doc comments of `list.ts`, `renderUnit.ts`, `match.ts` ("within a case, `value()` tracks …": its bindings do) and `For.ts` state the new rule.
- `signalLists.test.ts` and `parentSignals.test.ts` stay as they are and now pass through the kernel.

### Why the unit and not the compiler
The compiler sees compiled components only. Every stdlib widget and `@keel/ui` element is hand-built, the router calls page components directly, and the reported bug was a hand-built widget built inside a hand-built page in the stdlib's own tests. Untracking in the compiler's `scoped` and at each JSX call site covers app components and widgets called from JSX, and leaves a widget built inside a stdlib `For` row or `If` branch tracked (DataTable builds its rows in `For.children`, `DataTable.ts:169`). The unit is the one place every build passes through.

## Alternatives
- **Compiler only: `scoped` untracked and every JSX component call wrapped in an untracked call.** Rejected: misses hand-built calls inside a stdlib op child (above), keeps the two `untracked` helpers, and spends compiler budget that has 44 B left; the router root and the hand-built `For` would keep their tracked reads, so two rules would coexist (default 2).
- **Stdlib only: a shared `untracked` export for widget authors.** Rejected: the workaround made public; an app component reading a signal at its top level still resets its page, and E1405 already tells the author that read happens once (defaults 1, 6).
- **A diagnostic instead (warn on a reactive read at a component's top level).** Rejected: E1405 is static and by name within a file; a read through a function prop (`props.options()`) or a store in another module is invisible to it, which is exactly the reported case. The runtime rule needs no detection (default 6).
- **Untrack only component bodies at runtime.** Not possible without a call wrapper: the runtime never calls a child component, the parent's code does.
- **Keep the tracked re-render and document it as the way to re-render a subtree.** Rejected: it resets local state and focus, contradicts E1405 and k.head's revalidation sentence, and has `If`, `For` and `Match` as the explicit ways to re-render structure.

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/kernel/*.md` at `1dd29eb`. k.runtime (1,497), k.reactive (1,118) and k.head (818) are unchanged: D1 reuses `Scope.run` as k.reactive states it, k.runtime's Ops sentence on bindings is the rule D1 makes exclusive, and k.head's revalidation sentence becomes true for top-level reads too.

### k.component (1,182 to 1,458)
**Control flow**, in the `For` parenthesis, delete "a top-level read of the item re-renders nothing; " (Build states it for every read). The parenthesis becomes:

> (a row whose key stays keeps its nodes and its bindings update from the new item; an insert or removal moves no other row)

**Build**, a new paragraph after Control flow:

> **Build.** A component body, and each child an `If`, `For`, `Match`, `Case` or `Boundary` renders, is built untracked however it is called (JSX, a call in a `.ts` file, a route, `mount`, `render`): a reactive read there (a signal, store or computed, a prop, a function prop it calls) is its value at build and re-renders nothing. Only these track and update: a binding (k.runtime), a `computed` or `effect` made there, and each op's own input: a branch renders anew when `when` flips, a row when its key arrives, a case when its tag changes, a Boundary's children on `reset()`. Called as a function, `For` takes `each` as a getter and renders a kept key's row anew for a new item object.

**Conformance**, appended:

> - A component reading a signal at its top level, rendered from JSX, from a `.ts` call and as a route page, keeps its nodes, focus and local signals when the signal changes; a binding reading it updates.
> - A `Case` reading `value()` at its top level renders once per tag; its binding reading `value()` shows each new value.
> - Called as a function with `each` a getter, `For` renders a kept key's row anew for a new item object and keeps every other row's nodes.

### k.router (1,287 to 1,343)
**Manifest**, the sentence on `component`, replacement text:

> `component` receives `{ params, search, data }`, `data` being its loader's `ok` value, a getter that revalidation updates in place (a top-level read keeps the value at build, k.component);

**Conformance**, appended:

> - After an `ok(null)` action, a binding reading `props.data` shows the new value and the page keeps its nodes and focus.

### Unchanged
k.runtime, k.reactive, k.head, k.ui, k.errors, k.testing. The k.component Shape sentence on E1405 is unchanged; with D1 it describes what the runtime does.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:

New files:
- `packages/runtime-dom/conformance/build-untracked.test.ts`:
  - `// Spec: k.component, Conformance "A component reading a signal at its top level, rendered from JSX, from a `.ts` call and as a route page, keeps its nodes, focus and local signals when the signal changes; a binding reading it updates."`
  - `// Spec: k.component, Build "A component body, and each child an `If`, `For`, `Match`, `Case` or `Boundary` renders, is built untracked however it is called (JSX, a call in a `.ts` file, a route, `mount`, `render`): a reactive read there (a signal, store or computed, a prop, a function prop it calls) is its value at build and re-renders nothing."`
  - Three renders of one component that reads an outer signal and a function prop at its top level, holds a local `signal` shown in a binding, and has a focused `Input`: compiled from JSX (`compiled` in `packages/testing/conformance/component-support.ts`), called from a hand-built page, and as a route page under `renderRoute`. After the outer signal changes: the same element objects, `document.activeElement` unchanged, the local signal's value kept, the binding's text new, and a body-run counter at 1. The same inside an `If` branch, a `For` row, a `Case` and a `Boundary`'s children. `// Seed: 1337.` Plus a property over generated sequences of outer writes: the counter stays 1 and the binding's text equals the last write.
- `packages/runtime-dom/conformance/case-value-once.test.ts`:
  - `// Spec: k.component, Conformance "A `Case` reading `value()` at its top level renders once per tag; its binding reading `value()` shows each new value."`
  - A compiled `Match` over a signal of a union: two writes with the same tag keep the case's nodes and update its binding; a write with another tag renders the other case.
- `packages/runtime-dom/conformance/for-hand-built-getter.test.ts`:
  - `// Spec: k.component, Conformance "Called as a function with `each` a getter, `For` renders a kept key's row anew for a new item object and keeps every other row's nodes."`
  - `For({ get each() { … }, key: "id", children })` from a hand-built root: a new object for key `a` gives a new row element for `a` with the new text, the row for `b` is the same element; a reorder keeps both.
- `packages/router/conformance/revalidate-data-binding.test.ts`:
  - `// Spec: k.router, Conformance "After an `ok(null)` action, a binding reading `props.data` shows the new value and the page keeps its nodes and focus."`
  - A page with a loader, a binding `{props.data.count}`, a top-level `const first = props.data.count` shown through a `computed` it never updates, and a focused button that submits a `Form` whose action returns `ok(null)`: after `settle`, the binding shows the new count, `first` the old, the page's `main` is the same element and the button keeps focus.

Changed files:
- `packages/std-sessions/conformance/group-fixtures.ts:160-181`: the five `Text` children thunks return `computed(() => view.get(…))` instead of the string, and `computed` is imported from `@keel/reactive` (`:10`). This makes `group-isolation.test.ts`, `group-replay.test.ts`, `group-schedule.test.ts` and `test/group-handle.test.ts` green again; their assertions do not change.
- Kept green with no edit (run with D1 and D2 across all 39 suites, and with D1 to D3 across the 9 suites D3 touches): every other file under `packages/*/conformance/**`, including `packages/runtime-dom/conformance/for-keyed-rows-0090.test.ts` (keyed rows), `slot-prop-scope.test.ts`, `boundary.test.ts`, `resume-*.test.ts`, `packages/testing/conformance/component-render-pure.test.ts` (render purity and the stable a11y tree), the router's conformance (navigation, scroll, focus, revalidation), `packages/std-headless/conformance/**` and `packages/std-tables/conformance/**`.
- Outside conformance: `packages/runtime-dom/test/keyed-rows.test.ts:171-184` passes `get each() { return items.get(); }` instead of `each: items.get()`; its name and assertions stay.
- Ledger: new items `k.component#14`, `#15`, `#16` and `k.router#13`; no item changes text or number (the deleted Control flow phrase is prose, not a clause).

## Lanes and build order
- **Step 1, orchestrator:** the spec diff in one commit (k.component, k.router).
- **Step 2, conformance-writers in parallel:** one for the three k.component files (runtime-dom), one for the k.router file. Red until step 3 lands.
- **Step 3, one kernel agent, in order:** `renderUnit.ts` (D1), then `createRouterWith.ts` and `For.ts` (D2) in the same commit, since D1 alone breaks every navigation; then `list.ts` and the doc comments (D3, runtime-dom part); then the `group-fixtures.ts` and `keyed-rows.test.ts` edits. The runtime-dom and router suites and the four new files go green here.
- **Step 4, in parallel after step 3:** the std-headless lane (`listChart.ts`, `Toaster.ts`, delete `internal/untracked.ts`) and the std-tables lane (`DataTable.ts`, delete `internal/untracked.ts`), each with its package's suite and its regression test.
- Root gates, budgets measured once all land, golden-1, golden-2, inspector and sessions suites, mutation for runtime-dom and router alone, ledger on a quiet tree, push. One changeset each for `@keel/runtime-dom`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` (patch: no API change).

## Migration
- Apps: none required. golden-1, golden-2, inspector and sessions pass unchanged with D1 to D3; no file in them changes. The two reads that reset today (`BoxShell.tsx:60`, `:74`; `OutboxPanel.tsx:98`) stop resetting with no edit.
- Stdlib: the two `untracked.ts` files and their four call sites (D3).
- Kernel: `renderUnit.ts`, `list.ts`, `For.ts`, `match.ts` (doc comment), `createRouterWith.ts`.
- Fixtures: `packages/std-sessions/conformance/group-fixtures.ts`, `packages/runtime-dom/test/keyed-rows.test.ts`.
- An app outside the repo that reads a signal, a store or `props.data` at a component's top level and relied on the page re-rendering sees the value at build after the change. The fix is the one E1405 already names: read it in a binding (`{props.data.count}`), or wrap a derived value in `computed`. This goes in the `@keel/runtime-dom` changeset as a migration note.
- Docs, same commits: the doc comments above; `docs/guide` and the `keel` skill describe bindings as the way to update and need no edit (grep for "re-render" and "untracked" in `docs/guide` and `.claude/skills`: no hit that states the old behavior).

## Token impact
| section | before | after |
| --- | --- | --- |
| k.component | 1,182 | 1,458 |
| k.router | 1,287 | 1,343 |

## Budget
Measured with `tooling/budgets.mjs`'s method (own code bundled from `src/index.ts`, dependencies external, minified, gzip) on a copy of the tree with the change.
- `@keel/runtime-dom`: 4,237 of 6,144 B today; 4,230 B after D1 to D3 (D1 and D2 add 33 B, D3's `list.ts` removes 40 B). No re-base.
- `@keel/router`: 10,328 of 10,496 B today; 10,372 B after D2 (+44 B, the root `list`), 124 B left. No re-base.
- `@keel/std-headless` 4,198 to 4,154 B; `@keel/std-tables` 4,126 to 4,090 B.
- `@keel/compiler` (44 B left) and `@keel/testing` (20 B left): untouched; no source in either changes.

## Risks
- **Resumability.** Improved. Today a top-level read in an island that changes after `resume` re-renders that island's unit on the client, replacing the server nodes it claimed; after D1 it changes nothing, so claimed nodes stay claimed. Claims, E1253 and the island's own re-render on a mismatch are untouched: `renderUnit`'s first run still takes `claim`, and a mismatch still renders the island client-side. The server render (`packages/server/src/internal/renderUnit.ts`) runs once and is untouched.
- **Ledger.** Four new items, each with a conformance file. No existing item changes. The verified count rises by four once step 3 lands; nothing is lowered.
- **Stale values in code outside the repo.** The one behavior change with no failing test in the repo: a top-level read that relied on the page re-rendering. Every reported instance of that reliance in the repo is a hand-built fixture (6 tests); the compiled apps had none (Migration).
- **Router root.** D1 without D2 freezes every page at its first render, so they ship in one commit (step 3), and the router's navigation, scroll and focus conformance runs with them.

## Known limits
- A hand-built `.ts` call of `For` with a plain `each` array, or a hand-built `children: () => value` thunk, shows the value at build. k.ui already says a hand-built reactive child is a signal or computed; the Build paragraph says `each` is a getter.
- A `Case` that reads `value()` at its top level to build structure shows the first value of its tag until the tag changes; the fix is a binding or an inner `Match`.
- A hand-built widget's label-like props (`label`, `title`, `trigger`, `summary`, `text`, a `Tabs` panel) are read once at build (Problem, inventory). No app changes one while mounted; a widget that must follow a changing value binds it. A backlog line lists the 18 bodies for the stdlib owners.
- The rule is per unit render. Code that a render calls later (a handler, a `setTimeout`, a `resource` fetcher) runs outside it and is unaffected.

## 0593: search-only navigation (own RFC)
**Facts.** A committed navigation sets a new `View` (`createRouterWith.ts:142-171`) and the root renders it anew (today through the tracked read, after D2 through the `list` keyed by the view), so a search-only navigation rebuilds the page. `packages/std-tables/test/review.test.ts:74-83` asserts it ("a search-only navigation rebuilds the page, so search is read fresh": `cat.table` is a new element after a sort). `props.params` and `props.search` are plain values (`renderView.ts:18`), so a kept page could not see a new search without a change of shape. Focus survives only because k.head moves it to the element with the same id (`afterNavigate.ts:16-19`); a live region (`DataTable.ts:212-218`, `role="status"`) is a new node and is usually not announced. `DataTable` keeps a module-level `pagerFocus` map (`DataTable.ts:18`, `:224-232`, `:280-284`) to hand focus across the rebuild.

**Recommendation.** Keep the page. A navigation whose route id and params equal the committed view's runs its guards and loaders as today and then, when all succeed, sets the level cells and a search cell in place (the revalidation path, `createRouterWith.ts:248-264`) instead of committing a new `View`; `props.search` becomes a getter over that cell, like `data`. A failure commits a new view as revalidation does. Keeping only live regions would need a registry of nodes kept across a rebuild, a second mechanism next to the page, and still loses every other node's state (an open `Menu`, a `Combobox`'s text).

**What its RFC must decide.**
1. What "same page" is: route id and params (recommended), or the whole chain's loader inputs.
2. `search` (and whether `params`) as a getter in `component` props, the k.router Manifest sentence, and what `title` (k.head) reads.
3. Guards on a kept page: re-run (recommended, as today), and a denial's redirect still navigates.
4. k.head Client: "on the element with the same id when the page is rebuilt" holds for a params change only; a search-only navigation keeps the same nodes, so focus needs no move. Scroll is already kept.
5. Migration: every `DataTable`, `TableSearch` and golden-2 page that reads `search` at build (after D1 that read is the value at build); the `pagerFocus` map removed; `review.test.ts:74` flips to "keeps the table element and its status node".
6. `route().pending` during a kept navigation, and the order of `nav` reports.
7. Budget: the router has 168 B left today and 124 B after this RFC.

## Questions
The defaults decide every item: 1 (a stdlib workaround becomes a kernel change), 6 (the runtime enforces the rule; no per-widget discipline or diagnostic), 3 (D1 reuses `Scope.run` and the existing `list` op; no new op), 2 (one way to update: bindings and op inputs; the per-read row exception and both `untracked` helpers go). No new user-facing API shape, no privacy or auth change, no external integration, no golden-app migration. Open points, with recommendations:
1. **`Case` top-level reads.** D1 stops a case from re-rendering when `value()` changes under the same tag. Recommendation: accept it as the For row rule already does; no repo code relies on it (the suites are green), and a binding or inner `Match` is the explicit form.
2. **A dev diagnostic for a hand-built `For` with a plain `each`.** Recommendation: none now. The only instance was one test; every stdlib call passes a getter. File a backlog line if an app hits it.
3. **0593 ordering.** Recommendation: write its RFC after step 3 lands, so its measurements run on the untracked build.

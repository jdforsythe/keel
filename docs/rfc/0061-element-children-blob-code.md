# RFC 0061: elements in a JSX child expression are E1403 and bind nothing, `If` lowers its `fallback`, and E1002/E1603 follow more forms

Status: implemented (ADR-0050)

## Problem
- **Backlog 0165.** `{p.on ? <b/> : <i/>}` compiled to a `text()` binding whose value was a node. The browser rendered "[object HTMLElement]" and the server DOM "[object Object]". The same happened for `{a && <b/>}` (already E1403, but still lowered), `{xs.map((x) => <li/>)}`, `{[<b/>]}`, a function child and `{row(x)}` with a same-file `row` that returns JSX. Only literal JSX and slot calls were inserted as nodes.
- **Found while fixing 0165.** `<If when={a} fallback={() => <i/>}>` dropped `fallback`. The runtime `If` and the `cond` op take it, but the lowering passed only `when` and the children.
- **Backlog 0170.** E1002 missed `let k = 'innerHTML'; el[k] = x` and the `var` form. The resolver's `assigned` set counted every name read inside an assignment target, so `k` in `el[k]` counted as written and the never-assigned `let` was not followed. It also missed `const o = { innerHTML: x }; Object.assign(el, o)` and `Object.defineProperties(el, d)`: only an inline object literal was read.
- **Backlog 0171.** E1603 missed `import(URL.createObjectURL(new Blob([x])))`, `new Worker(URL.createObjectURL(new Blob([x])))` and `Object.getPrototypeOf(async function () {}).constructor(x)`. RFC 0058 listed the first two as not covered.

## Proposal
1. **E1403 covers elements in any JSX child expression (k.component).**
   - k.component already makes `{a && <b/>}` E1403: conditional rendering goes through `If`, lists through `For`. A ternary, an array or a `map()` of elements is the same mistake, so it gets the same code (principle 1), not a new E10xx.
   - A child expression holds elements when, after parentheses and TS wrappers:
     - it is a `?:` with an element branch, `&&` with an element right operand, or `||`/`??` with an element on either side (an element is truthy, so `<b/> && x` is `x` and stays clean);
     - it is an array literal with an element, or a `map`/`flatMap` call whose callback returns one;
     - it is a function, or a call of a function expression or of a same-file function (declaration or `const` arrow) that returns one through its own `return` or expression body;
     - it is a same-file binding whose initializer is one of the above.
   - Each such child is one E1403 at the expression. The lowering emits nothing for it, as rfc:0058 does for data in `script`. It never binds a node as text.
   - Not reported: literal JSX children and slot calls, which are inserted as nodes. A lone function child of `If`, `For`, `Case` or `Boundary` is its render callback. Children of `Match` are its `Case`s.
   - **Fix.** In a file that imports `If` (under any local name), `{a && <b/>}` becomes `<If when={a}><b/></If>`. A `?:` whose branches are elements or empty (`null`, `undefined`, `""`) becomes `<If when={a} fallback={() => <i/>}><b/></If>`, or `<If when={!(a)}>` when only the else branch is an element. Without the import, the fix would add a second hunk. Ten such diagnostics in compact output would then exceed the 600-token budget in docs/OUTPUT.md, so those get no fix. Lists, `||`/`??`, text branches and functions get no fix: their rewrite is the author's.
   - **Why a diagnostic, not a node binding.** `If`, `For` and `Match` already cover every case. A node-swapping `text` would be a second way to branch (principle 1), and it would carry no keys, so the list form would lose node identity. It would also add runtime bytes.
2. **`If` lowers `fallback`.** `<If when fallback={f}>` lowers to `cond(anchor, when, then, f)`. k.component's control-flow line names `fallback`.
3. **E1002 (k.compiler; resolver, rfc:0053).**
   - `assigned` counts only the root name of each target: `el[k] = x` writes `el`, not `k`. `o.x = 1` writes `o`, as before. Destructuring targets, `++`/`--` and `for…in/of` heads count the names they bind. A `let`/`var` that is never written is followed like a `const`.
   - `Object.assign` and `Object.defineProperties` read each map argument through `initOf`, so a same-file alias of an object literal is checked like the literal. The diagnostic is at the key.
4. **E1603 (k.ctx).**
   - `import(u)` and `new Worker(u)`/`new SharedWorker(u)` are E1603 when `u` is `URL.createObjectURL(...)` (through aliases and `globalThis`) or has a constant `data:` or `blob:` prefix.
   - The resolver maps `Object.getPrototypeOf(f)` and `Reflect.getPrototypeOf(f)` to `Function.prototype` when `f` is a function or class value (an expression, a declaration, or an alias of one). So `.constructor` on the result is the `Function` family. The prototype of any other value resolves to nothing, so `Object.getPrototypeOf(o).constructor` stays clean.
5. **Runtime half: `text` refuses nodes (k.component; `text` op, backlog 0175).**
   - Static coverage cannot be complete: `{[<b/>][0]}`, `{o.el}`, `{h.r()}`, template literals, imported helpers, `{p.icon}` and `{s.get()}` hold elements the compiler cannot see. So the `text` op renders `""` for a node, or an array holding one at any depth, wherever the value comes from. Every other value keeps its `String` form, so `[1, 2]` still renders `1,2`.
   - The check is `"nodeType" in v`, which needs no `Node` global, so it works the same on the server DOM.
   - **No dev diagnostic.** runtime-dom has no dev channel for bindings: only `resume` returns warnings. So the guard is silent, and E1403 stays a compile-time code. A coded runtime error would need such a channel, which is a later RFC.
   - k.runtime is at 1,499 tokens, so the sentence goes in k.component's E1403 line.
6. **Names resolve by scope (backlog 0176).** `elementValued` follows identifiers through the rfc:0053 resolver: `initOf` for `const` and never-assigned values, and the new `functionOf(name, at)` for function declarations. A binding is matched by its declaration, so a shadowing parameter or another component's local of the same name is not followed. Before this, names were matched by text: a text helper beside another component's element helper of the same name dropped real text, and the swapped case rendered an element as text. An alias of a declaration (`const k = f; k()`) is now followed too.
7. **Not covered.**
   - Elements reached through another file, a parameter or a call into an import: a function from another module that returns JSX still binds as text.
   - An element-valued expression in an attribute of a base element (`title={a ? <b/> : 'x'}`).
   - `importScripts`, `Worklet.addModule`, and a `blob:` URL that flows through a call or another file.

## Alternatives
- **A new E10xx code for ternaries.** That would be a second code for the mistake E1403 names.
- **Lower element-valued expressions as node bindings.** See Proposal 1.
- **A runtime `text` that renders nothing for objects.** That hides the bug at runtime instead of reporting it at compile time, and it adds runtime-dom bytes.
- **Always add the `If` import in the fix.** This breaks the compact output budget (Proposal 1).

## Spec diff
- **k.component Control flow (runtime half and scope, backlog 0175, 0176).** The E1403 sentence adds "names resolved by scope" and "At runtime `text` renders nothing for a node or an array holding one."
- **k.component Control flow.** `<If when={}>` becomes `<If when={} fallback={() => …}>`. "`{a && <b/>}` is E1403." becomes: "Elements in a JSX child expression are E1403 and bind nothing: `{a && <b/>}`, `{a ? <b/> : c}` (also `||`, `??`), an array or `map()` of elements, a function, or a same-file call or binding returning them (rfc:0061). In a file importing `If`, the fix rewrites `&&` and `?:` to it."
- **k.component Conformance.** Adds "`{a ? <b/> : <i/>}`, `{a && <b/>}`, `{[<b/>]}` and `{xs.map((x) => <li/>)}` as children are each one E1403 and render nothing; `<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy."
- **k.ctx Rules.** E1603 "also aliased or as a function's `constructor`, and `import()` of a `data:` URL" becomes "also aliased or as a function's (or its prototype's) `constructor`, and `import()` or `new Worker`/`SharedWorker` of a `data:` or `blob:` URL (`URL.createObjectURL`)". The rfc reference becomes "(rfc:0053, 0058, 0061)".
- **k.ctx Conformance.** Adds "`import(URL.createObjectURL(b))`, `new Worker(URL.createObjectURL(b))`, `new Worker('data:,' + s)`, and `Object.getPrototypeOf(async function () {}).constructor(s)` are each one E1603; `new Worker('/w.js')` is not."
- **k.check Conformance.** The fix-bearing list adds "E1403 (`&&`, `?:` with `If` imported)".
- **k.compiler.** Unchanged: the E1002 sink list already covers 0170. The fixes are resolver completeness.

## Conformance diff
- **Added** `packages/compiler/conformance/E1403-element-children-0061.test.ts` (k.component). It covers the four forms, each one E1403, mounted under happy-dom with the condition truthy and falsy and with empty, one-item and three-item lists. None renders "[object" or the branch elements. `If` `fallback` renders `<i>` while the condition is falsy. A fast-check property (seed 1337) varies the condition name and tags of the ternary.
- **Added** `packages/check/conformance/string-code-blob-0061.test.ts` (k.ctx). The four forms are each one E1603, and `new Worker('/w.js')` is clean.
- **Changed** `packages/check/conformance/fix-diffs.test.ts`. E1403 moves from the no-fix list to the fix list, the header quotes the amended k.check clause, and two fixtures (`&&` and `?:` with `If` imported) must apply with `git apply` and clear E1403.
- **Unit tests.**
  - `packages/compiler/test/element-children-0165.test.ts` (happy-dom) covers 13 element-holding forms, each one E1403 and rendering only its siblings. Seven clean forms stay clean, including `<b/> && x`, text `map()` and slot calls. Lone function children of `If`/`For`/`Boundary` are clean. `If` `fallback` renders. Four fixes apply with `git apply`, compile clean and render. The fix reuses an aliased `If`, and there is no fix without the import or for lists, text branches and `||`.
  - `packages/server/test/element-children-0165.test.ts` runs the repro and four other forms under `installServerDom` with no DOM global. Each renders exactly `<div id="a.0"><span id="a.1">a</span></div>`. `If` `fallback` renders on the server.
  - `packages/check/test/rfc0061-resolver.test.ts` has six E1002 forms (backlog 0170) and nine E1603 forms (backlog 0171), each one diagnostic. The 15 failed before this RFC. Eleven clean counterparts cover a reassigned, updated, destructured or `for-of` key, a reassigned map, a safe map, `new Worker('/w.js')`, `new URL`, and the prototype of a plain object.
  - `packages/compiler/test/mutation-project-rules.test.ts` adds `{p.a || <b/>}` to its E1403 positions. `mutation-lowerFile-b1.test.ts` 'nest' no longer binds `{inner(1)}` (a const arrow returning a component) as text.

- **Backlog 0175, 0176.**
  - `packages/runtime-dom/test/text-node-value.test.ts` has a fast-check property (seed 1337, 200 runs) over sequences of strings, numbers, nodes and nested arrays mixing them. The text is `""` whenever a node is held, else `String(v)`, and never holds "[object" or markup. Both tests failed before.
  - `element-children-0165.test.ts` adds five scope tests that failed before (a text helper beside another component's element helper, the swapped case, a parameter shadowing a declaration, a `map` parameter shadowing a module element, an alias of a declaration). It also adds seven forms the compiler cannot see, which render no "[object" and no markup under happy-dom.
  - `packages/server/test/element-children-0165.test.ts` adds `{[<b/>][0]}`, `{p.icon}` and `{p.list}` on the server DOM.

## Migration
- A child expression holding elements is E1403. Use `<If when fallback>` for conditionals, `<For each key>` for lists, and inline JSX or a component for helpers. These forms rendered "[object …]" before, so no working app relied on them.
- `If` `fallback` now renders. It was dropped before.
- A text binding that receives a node, or an array holding one, renders nothing. Before, it rendered "[object …]" or escaped markup.
- `apps/` gets no new findings (golden-1 71 files, golden-2 47, inspector 31: 0 errors).

## Token impact
- k.component: 406 to 549 tokens. k.ctx: 910 to 990. k.check: 1,156 to 1,166. k.compiler: unchanged at 1,498.
- `keel explain` rows for E1403 and E1603 are amended. E1403 gains a why line, about 40 tokens. No output format changes.
- **Size budget.** `@keel/compiler` grows from 22,892 to 24,315 bytes gzip, within its 24 kB (24,576 B) budget, leaving 261 B. `@keel/check` grows from 28,741 to 28,976 (30 kB). `@keel/runtime-dom` is unchanged at 3,435 (its measured entry does not include the ops). The `@keel/runtime-dom/ops` bundle grows by 27 B, from 5,476 to 5,503, for the node guard in `text`.

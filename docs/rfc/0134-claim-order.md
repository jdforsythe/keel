# RFC 0134: claim order: content arrives as thunks, an eager element is reported by the check, the server and the console, and every packaged component resumes

Status: draft, for the orchestrator to accept (ADR-0156). The operator confirmed the direction: keep cursor-based claiming, fix the code, make the hazard loud.

## Problem
Each claim below was read in the code on 2026-11-18.

At resume each op claims the next server element when it runs (k.runtime Resume markup; `element(tag, fill)` in `packages/runtime-dom/src/ops/element.ts` claims with `claimNext`, then runs `fill` over that element's children). So an element must be made inside the build of what holds it. The compiler guarantees this for JSX: component children lower to a thunk and element-valued props to getters (`packages/compiler/src/internal/lowerFile.ts`). Code that makes an element first and passes it in breaks it: the element claims its parent's server element, the island mismatches (E1253) and re-renders on the client, and the browser shows nothing.

1. **Types admit it.** `FormProps.children` (`packages/router/src/types/FormProps.ts`) is `(() => Node | readonly Node[] | string) | Node | readonly Node[] | string`; `Disclosure`'s `children` (`packages/std-headless/src/Disclosure.ts`) is `Child | Children`, and `Child` includes `Node` (`packages/ui/src/types/Child.ts`).
2. **`DataTable` cannot resume.** `packages/std-tables/src/DataTable.ts` makes each row's cells (`rowOf`, pushed into `cells` before the row `Part`), the header cells (`heads`), the body before the table and before its sibling head, the table, the status before the pager's links, and the pager, all before the root `Part` that holds them. At resume the first claim is a body cell while the server's next element is the root `div`: E1253 on every served `DataTable`.
3. **The check misses it.** E1808 (`packages/check/src/rules/noEagerChild.ts`, RFC 0069) reports only a base element's `children`. A `Form` call, a std widget, an app component, an element-valued prop, a mapped list, a component call held in a variable, and a binding from another file are all out of its reach (RFC 0069 Known limits).
4. **Nothing is printed.** `resume` returns its warnings; the generated resume entry (`packages/compiler/src/entry/resumeEntry.ts`) drops them, in dev and production alike. The server renders the fault without a word.
5. **No packaged component has a resume test.** No file in `packages/std-*/{test,conformance}` resumes a widget or a table; resume coverage is `packages/ui` and `packages/runtime-dom` only.

Corrections to the brief: the warnings are dropped in every mode, not only production. RFC 0069 did not exempt `Form` by name; its Migration noted the golden apps' `children: [title, submit]` calls were router `Form`, outside a rule scoped to base elements. No hand-called `Form(` with eager children remains under `apps/` in this tree; such calls remain in tests (Migration). std-headless widgets build in document order through thunks; the one hole is `Disclosure.children`. `Match` takes eager `Case` values by design: a `CaseNode` describes a case and is never placed or claimed (`packages/runtime-dom/src/internal/caseNode.ts`), so the rule must not report it.

## Proposal
A new kernel section, `k.claim` (`spec/kernel/k.claim.md`), status proposed. Every section that could hold these clauses is at its limit (k.runtime 1,498, k.resume 1,490, k.ui 1,494, k.check 1,495, k.router 1,499, k.testing 1,497, std.tables 1,499, std.headless 1,492 tokens by file characters), so, as RFC 0133 did for k.resume, the contract gets its own section that the check, the runtime, the server, the router and the std packages all read.

### D1. Types: content is a thunk or render function
Survey of every component a package exports (`packages/ui`, `ui/aria`, `router`, `runtime-dom`, `std-headless`, `std-tables`, `std-health`; std-messages, std-live, std-channels, testing and server export none):

| component | prop | type now | decision |
| --- | --- | --- | --- |
| `Form` (router) | `children` | thunk, `Node`, `Node[]` or string | thunk only: `() => Node \| readonly Node[] \| string` |
| `Disclosure` (std-headless) | `children` | `Child \| Children` | thunk only: `Children` (`() => Child`) |
| `Box`, `Text`, `Heading`, `Button`, `Link` (ui) | `children` | `Child \| Children` | unchanged: k.ui Standard slots says base elements accept a plain string or Node, a conformance-covered text this RFC does not reword; E1808 and E1258 report the eager forms |
| `Part` (ui/aria) | `children` | `Children` | already a thunk; a thunk returning an element made outside it is E1258 |
| `Form` | `error` | `(e) => Node` | render function, unchanged |
| route and layout components | `children` | `() => Node` | thunk, unchanged |
| `If`, `Boundary`, `For`, `Case` | content | thunks and render functions | unchanged |
| `Match` | `children` | `CaseNode \| CaseNode[]` | unchanged: a description, never placed |
| `Dialog`, `Listbox`, `Combobox`, `Menu`, `Tabs`, `Disclosure.summary` | slots | render functions | unchanged |
| `DataTable` | `cells`, `header`, `actions`, `empty` | render functions | unchanged; its own build order is fixed (D5) |
| `Toaster`, `TableSearch`, `Input`, `TextArea`, `Select`, `Checkbox`, `Image`, `HealthView` | none | no element-valued prop | none |

Reason: the type is where an author finds out first, and one shape (a thunk) is one way (principle 1). A string stays allowed inside the thunk; a bare string is not, so `children` has one form.

### D2. Check: a new code, E1258, beside E1808
E1808's Rules entry says "base element `children`"; widening it to any component and any prop would change what an existing clause means. E1258 is the sibling: in app code, a value given to a component as `children` or any other prop that holds an element made before the call. A component is a base element, `Part`, an intrinsic, `Form`, a std widget, or a function the check resolves through the project's files (the rule's `project` input, k.check Registry) whose body returns JSX or a component call. Made before the call:
- a JSX element or fragment, or a component call, outside a thunk;
- an array holding one;
- `xs.map(f)` with `f` returning one, outside a thunk;
- each branch of `?:`, `&&`, `||`, `??`;
- a binding whose initializer is one of these, in the same file or a `const` imported from a project file, also when a thunk given as the prop returns it, alone or in an array, and the binding is declared outside that thunk;
- a JSX attribute holding such a binding (`<Card icon={el} />`): the compiler's getter returns a node already made.

Where E1808 reports a value, E1258 does not: one diagnostic per fault. The fix wraps an inline value in `() => `; a binding has none (a thunk returning it still returns a node made first), and the message says to move the call into the thunk.

Out of reach of the static rule: `let` reassignment, object members (`o.f`), destructuring, returns of functions other than a component call, IIFEs, `forEach`-and-push lists, modules outside the project (installed packages are not resolved), and a component that reads an element-valued getter prop before making its own element (the getter is lazy, so only the order inside the component decides). The server diagnostic (D3) catches each of these on a served page.

Code: E1258 in E125x, the resume block (k.runtime, k.resume, now k.claim). The fault is the claim contract, as E1808's was k.ui's. E1257 and E1258 are the lowest free codes in E125x; E1254 stays unused.

### D3. Server: E1257, a diagnostic at render
In the runtime's server mode (k.resume Regions) the runtime can tell, cheaply and exactly, when an element it made in a level's render is placed by an `element` fill, a slot or a structural op that started after the element was made (a counter stamped on each made element, compared with the op's start; the mechanism is the builder's). `createApp` logs a `diag` record with E1257 and the route id the first time a route renders one, in dev and production (a page is either faulty or not, so the first record says all; repeating it per request would flood a busy log). The document is served unchanged: the fault costs a re-render in the browser, not the page. Content of another level (`renderChain`'s child-level fragment) and parsed HTML are not made by that render and are not checked. This puts the fault in `createApp`'s log and in any test that serves a page, with no browser.

### D4. Client: warnings are printed, and E1253 names the cause
The generated resume entry writes each warning `resume` returns to `console.warn`, one line, in every mode: `resume` already returns one per mismatching island, so that is once per island. The cost is in the entry's text, not in `@keel/runtime-dom`'s bundle. An island whose client re-render places an element made before the op placing it started has an E1253 warning holding the code, its island id and `made before its parent`. The re-render runs on every mismatch anyway and is a plain mount, so the same stamp-and-compare as D3 tells the cause exactly; at the failing claim itself an eager child looks like any template mismatch. The phrase is the observable contract; the rest of the message is the builder's. Budget: `@keel/runtime-dom` is 4,509 B of 6,144 B; the stamp and compare are expected well under 150 B gzip, shared by D3.

This adds to k.runtime's "E1253 ... (dev diagnostic)": a dev diagnostic is still what `resume` returns; the console line is the entry's.

### D5. Every packaged component resumes
Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own, resumes with no warning, no E1257 and no element removed, and its handlers work. The clause sits in k.claim and names each package, because std.tables and std.headless are full; their conformance files carry `Spec: k.claim` and live in each package's `conformance/`. `DataTable` is rebuilt to make every part inside its container's thunk, in document order (head before body, the pager's links and status in their places).

### D6. `@keel/testing`: `removed()`
`resumeDocument` returns a `render` handle; `find` gives no DOM node, so a test cannot see whether resume removed server elements, and a removal need not raise a warning (an `effect` that hides a served `If` branch at resume). The handle gains `removed()`: the number of elements under the served island roots that were not in the document when `resumeDocument` resolved. Fixed at that moment, so later handlers that remove rows do not change it. The clause lives in k.claim, which owns the requirement; k.testing (1,497 tokens) keeps every bullet.

## Alternatives
- **Widen E1808.** Its Rules entry names base elements; a broader meaning under the same code would change an existing clause (rejected by the brief's rule).
- **E1809 in E18xx.** E18xx is k.ui, k.a11y and k.aria; the contract is resume's, and k.claim would need to join a second block.
- **Narrow base elements' `children` too.** Contradicts k.ui Standard slots ("accept a thunk or a plain string/Node"), a conformance-covered sentence; E1808 and E1258 report the eager forms instead.
- **Claim by id or key instead of by cursor.** Rejected by the operator: every element would need a key in the markup.
- **Report E1257 on every request.** Floods a production log for one fault; the first record per route is enough to act on.
- **Fail the level on E1257.** The page still works after a client re-render; failing it would turn a performance and flicker fault into an outage.
- **Pass the server's E1257 to the client in `#k-state`.** More bytes in every document for a fault the client's re-render can tell itself.
- **A throw in `resumeDocument` on any removal.** Breaks tests of pages that legitimately change state at load; a count lets each test decide.

## Spec diff
- New `spec/kernel/k.claim.md`, status proposed: intro, Order, Types, Check, Server, Client, Packaged components, Rules (E1257, E1258), seven Conformance bullets. 5,150 characters, 1,288 tokens; `pnpm spec k.claim` prints 1,288.
- `spec/00-map.md`: a row `k.claim | Claim order | proposed | eager elements`; E125x owner `k.runtime, k.resume, k.claim`; one-line cells trimmed (k.schema, k.store, k.check, k.deploy, k.compat, k.hosting, k.aria, k.privacy), no title or status changed. 1,199 to 1,193 tokens.
- No other section changes; no bullet reordered, renumbered or reworded. No section changes status, so the ledger does not move. k.claim goes to `conformance-covered` with the build, as k.resume did.

## Conformance diff
One `rfc:0134` commit by the `conformance-writer`, one file per bullet or case group, each headed `Spec: k.claim`.

**Types** (`packages/router/conformance/form-children-thunk.test.ts`, `packages/std-headless/conformance/disclosure-children-thunk.test.ts`; `expectTypeOf` or `// @ts-expect-error` lines, which the conformance profile allows only for type-level assertions):
- error: `Form({ method, action, children: node })`, `children: [node]`, `children: "go"`; `Disclosure({ id, summary, children: node })`, `children: "x"`.
- no error: `children: () => node`, `() => [a, b]`, `() => "go"`; `Disclosure` `children: () => "x"`.

**E1258** (`packages/check/conformance/E1258-eager-element.test.ts`; fixtures are project trees, so imports resolve). Each reports exactly one E1258 at the value:
- `Card({ icon: Icon() })` with `Card` and `Icon` app components (function bodies returning JSX).
- `Card({ children: [Input({ label })] })`, and in a `.tsx` file `Card({ children: <Icon /> })` written as a call.
- `Disclosure({ id, summary, children: xs.map((x) => Text({ children: x })) })` (also a type error; E1258 still reports it).
- `Card({ children: ok ? A() : 'x' })`, `Card({ children: ok && A() })`, `Card({ children: a ?? A() })`.
- `const el = <Icon />` then `<Card icon={el} />`.
- `const c = Card(props)` then `Form({ method, action, children: () => [c] })`.
- `const t = Text({ children: 'x' })` then `Part({ role: 'generic', children: () => t })` inside a component.
- A `const header = Heading({ ... })` exported from `ui/header.ts` and imported in `Page.tsx`, then `Card({ children: () => header })`.
- A component resolved through the project: `Shell` declared in `Shell.tsx` returning `<Box>...</Box>`, then `Card({ footer: Shell({}) })`.
- `DataTable({ ..., empty: Text(...) })` written in app code (a packaged component; also a type error).
- Fix: the inline cases' fix (`() =>`) applies with `git apply` and re-checking reports no E1258; the binding cases carry no fix.

Negative cases (no E1258; each its own fixture, and none reports E1808 except where stated):
- `Card({ children: () => Text({ children: 'x' }) })`, `Card({ children: () => [A(), B()] })`, `Card({ children: () => xs.map((x) => Text({ children: x })) })`.
- A render function: `DataTable({ cells: { price: (row) => Text({ children: row.price }) } })`, `Form({ error: (e) => Text({ children: e.code }) })`, `For({ each, children: (x) => Text(...) })`.
- A binding made inside the thunk: `Card({ children: () => { const t = Text(...); return [t, Button(...)] } })`.
- `Card({ children: props.children })`, a parameter `children` passed down, `Card({ icon: props.icon })`.
- A string, a number, a template literal, `signal`, `computed`, `String(n)`, `t('key')`, `formatNumber(n)`.
- A call of a function no project file resolves (`Card({ children: lib.make() })` from an installed package); a call of a project function whose body returns a string.
- `Match({ on, children: [Case({ value: 'a', children: () => A() })] })`.
- Elements made in order and returned or placed: `return [Heading(...), Box(...)]`; `const a = Text(); const b = Box({ children: () => 'x' }); return [a, b]`.
- An element passed to a non-component call: `arr.push(Box(...))`, `console.log(Text(...))`, `navigate(href)`.
- An event prop or other function prop: `Button({ onClick: () => open(Dialog(...)) })` is not a value holding an element.
- A JSX attribute whose value is JSX (`<Card icon={<Icon />} />`) and JSX children: the compiler's getter and thunk keep the order.
- `Box({ children: Input(...) })`: one E1808 and no E1258.
- The same reporting cases in a `*.test.ts` or `*.test.tsx` file.
- A local function named `Form` or `Disclosure` not imported from a Keel package, whose body returns a string.

Edited (rfc:0134): `packages/check/conformance/fixtures-by-code.ts` gains the E1258 fixture; `fix-applies.test.ts` and `fix-diffs.test.ts` gain an E1258 case.

**E1257** (`packages/server/conformance/claim-e1257.test.ts`, `createApp` with a log sink, each page served twice):
- `Form({ method, action, children: () => [btn] })` with `btn` made before the call: one `diag` E1257 with the route id over both requests; the document is the one served without the check (same status and body).
- A base element given an eager child, made in a `.ts` component (not caught statically through a member: `Box({ children: o.el })`): one E1257.
- A component that reads an element-valued getter prop before making its root: one E1257.
- Two faulty routes: one record each.
- Negative: the thunked twins of each; an island layout around a static layout around an island page (k.resume); `If`, `For` with `empty`, `Match` with `Case`, `Boundary` pages; a `Form` with JSX children; every packaged component of the D5 app: no E1257, in dev and production modes.

**Console** (`packages/compiler/conformance/resume-entry-console.test.ts`, happy-dom, the entry text run with a spied `console.warn`):
- A production entry over a document with one mismatching island writes exactly one `console.warn` line starting `E1253` and holding the island id; two mismatching islands, two lines; a clean document, none.
- An island whose component passes an eager element to a base element: the line holds `made before its parent`. An island whose template differs from the server's (an extra element, all thunks): it does not.

**Packaged components** (`packages/std-tables/conformance/resume-datatable.test.ts`, `packages/std-headless/conformance/resume-widgets.test.ts`, `packages/router/conformance/resume-form.test.ts`, `packages/ui/conformance/resume-elements.test.ts`, `packages/std-health/conformance/resume-health.test.ts`): each served by `createApp` from a test app whose page is an island holding the component with its slots given, resumed by `resumeDocument(html, { routes: () => import(path) })`; it resolves (no warning), `removed()` is 0, the log holds no E1257, then:
- `DataTable`, client source (`rows` from a store, `pageSize` 5, 12 rows, `selected` and `actions` given): activating `sort.price` re-sorts, `next` moves to page 2, `select.<key>` and `selectAll` call `onSelect`; server source (`page` from a loader at page 2): `sort.<col>` and `previous` are links the router follows, and the next page renders.
- `TableSearch`: input then 300 ms of sim clock navigates once.
- `Listbox` and `Combobox`: open, move, choose an option, `onChange` once with its key; `Menu`: open from the trigger, choose an item; `Tabs`: select the second tab, its panel shows; `Dialog`: open, then Escape, focus back on the trigger; `Disclosure`: toggle twice; `Toaster` with one item: dismiss calls `onDismiss`.
- `Form` with JSX children inside a router: submit runs the action.
- Each base element with an event prop: its handler runs.
- `HealthView` as a route component: resumes or is static (no `data-k-island`), no warning.

**removed()** (`packages/testing/conformance/resume-document-removed.test.ts`):
- A clean island: 0; after a `fire` that removes a row, still 0.
- An island whose `effect` sets a signal that hides an `If` branch the server showed: equal to the branch's element count, and no warning.

## Migration
- `Form` with a node, array or string `children` (a type error) moves into a thunk: `children: () => [label, input, submit]`, with the elements made inside it. Hand-built calls in this tree: `packages/std-sessions/test/fixtures/notes/modules/notes/NotesPage.tsx`, `packages/testing/test/route.test.ts`, `packages/router/test/mutants.dom.test.ts` (`children: "hello"`), `packages/router/test/ctxAndChildren.test.ts` (passes a `ChildInput`), and in conformance (edited in the `rfc:0134` conformance commit): `packages/forms/conformance/blank-optional-0091.test.ts`, `packages/forms/conformance/fixtures.ts`, `packages/router/conformance/production-error.test.ts`. JSX `<Form>` is unchanged.
- `Disclosure` with a node `children` moves into a thunk; every caller in this tree (golden-2 `CatalogPage.tsx` in JSX, the std-headless tests) already passes one.
- `@keel/router`'s `ChildInput` type narrows with `Form`.
- App code that E1258 reports moves the element into the thunk; served pages that log E1257 do the same.
- `DataTable`'s markup is unchanged; only the order its parts are made in changes.

## Build order
1. This RFC, ADR-0156 and the spec (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): `@keel/router` `FormProps` and `ChildInput`; `@keel/std-headless` `Disclosure`; `@keel/std-tables` `DataTable` in document order; `@keel/check` E1258 rule, fixture and `explain` entries for E1257 and E1258 (at most 120 tokens each); `@keel/runtime-dom` the made-before-placed check in server mode and in a client re-render, the E1253 phrase; `@keel/server` the E1257 record once per route; `@keel/compiler` the entry's `console.warn`; `@keel/testing` `removed()`; the Migration; changesets; k.claim to conformance-covered in the section and the map.

## Token impact
k.claim 1,288 tokens (new). Map 1,199 to 1,193. No other section changes.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: `Form` and `Disclosure` content is thunk-only; base elements keep k.ui's types.
- C2: a new code E1258 beside E1808, which keeps its meaning; one diagnostic per fault.
- C3: E1257 from the server's render, logged once per route, in every mode, document unchanged.
- C4: the entry prints every resume warning in every mode; E1253 names the cause from the client re-render.
- C5: the packaged-component requirement and `removed()` live in k.claim, a new section, because every owning section is full.
- C6: E1257 and E1258 in E125x.

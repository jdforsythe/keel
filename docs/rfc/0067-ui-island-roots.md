# RFC 0067: a bound base element marks its route level as an island

Status: accepted (ADR-0056)

## Problem
- **Backlog 0182.** A route component built only from `@keel/ui` base elements was never an island. The server marks a route level as an island when the element it returned holds a `data-k` element outside nested islands, and only compiled templates wrote `data-k`. `() => Box({ children: Input({ label: "Title", onInput }) })` served static HTML with no `data-k-island` and no resume entry, so its `onInput` never ran. The same held for JSX whose elements are all base elements (`<Box><Input onInput={...} /></Box>`): the compiler lowers those to component calls, not templates.
- **Found by rfc:0064**, which made base elements claim server nodes at resume. That claim only runs for a level the server marked.

## Proposal
1. **A bound base element writes `data-k=""` on itself.** A base element is bound when it registers an event prop, binds a k.forms `field`, or binds a signal or computed: `value`, `checked`, `disabled`, a style prop (a signal or computed at any depth of a responsive or `states` value), or a child. This mirrors the compiler, which writes `data-k` on each bound template element. The value is empty: resume claims base elements in document order (rfc:0064) and never looks them up by id.
2. **The server is unchanged.** A route level whose element holds a `data-k` element outside nested islands gets `data-k-island="<routeId>"`, its props go to `#k-state`, and the document loads the resume entry. Islands keep one marking rule, however the element was built.
3. **A getter alone does not mark.** The compiler passes every non-literal component prop as a getter, so a getter style prop may be static (`p={props.data.pad}`). Marking it would turn static pages into islands that ship JS. The check runs inside the class binding, so a getter's reads track there and not in the render around it.
4. **Thunk children.** A child passed as a thunk (`children: () => Input(...)`, which compiled JSX always emits) is made after its parent and claims in document order. An eager `Node` child is made before its parent, so it claims its parent's server element: E1253, and the island re-renders on the client (k.runtime).

## Alternatives
- **The server marks every route root.** Every page would ship the runtime, against rfc:0037 (no islands, no runtime JS).
- **The render unit reports registered handlers and bindings.** Compiled templates bind loader data with `text` and `attr` ops that read no state, so "any binding" would make every data page an island. Telling apart a binding that read state needs dependency tracking the reactive API does not expose. It would also leave two marking rules, `data-k` for templates and a unit report for everything else.
- **The compiler marks.** Hand-written calls have no JSX, and the compiler cannot see what a base element binds at runtime.
- **`data-k` on every base element** (rejected in rfc:0064). Every route using one would become an island.

## Spec diff
- **k.ui Base elements.** Adds "A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime; rfc:0067). A thunk child is made after its parent and claims in document order; an eager `Node` child is made first, so its island re-renders (E1253)." **Conformance** adds "A route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry, and resume adopts its server nodes without E1253 when children are thunks; a route of base elements with no event prop, `field` or signal has no `data-k`."
- **k.runtime Islands and resume.** "`data-k="<elementId>"` on every bound element (from the template)" becomes "`data-k` on every bound element (from the template, or k.ui)". The sentence before it still gives a template's value.
- **k.server, k.compiler.** Unchanged. k.server's Document paragraph names route levels as candidate island roots; the rule is in k.runtime.

## Conformance diff
- **Added** `packages/server/conformance/route-of-base-elements-island.test.ts` (k.ui), written from the clause: the island document (thunk and eager children), resume adopting the server input and reaching `onInput`, and a static route with no `data-k`.
- **Edited (rfc:0067).** None.
- **Unit tests** (`packages/server/test`).
  - `island-ui-root.test.ts`, plain node: the 0182 repro (fails before), each bound kind (signal value, computed `disabled`, signal child, signal style prop), and a static route.
  - `island-ui-root.property.test.ts`, plain node, property seed 1337: random chains (optional layout, page) of base elements and JSX elements, as JSX or direct calls; each bound level gets `data-k-island` once, a static level none, the entry iff any.
  - `island-ui-root.resume.test.ts`, happy-dom: property seed 1337 over random base-element trees resumed with no E1253 and every server element kept; an input event reaching `onInput`; an eager child is E1253 with a client re-render.
  - `ssr-form-values.test.ts`: reactive controls now carry `data-k=""` in their markup.

## Migration
- **App code.** None. A ui-only route with an event prop, `field` or signal now ships the runtime and resumes. Hand-written routes pass children as thunks to resume in place.
- **Markup.** Bound base elements gain `data-k=""`. Tests that match exact control markup change.

## Known limits
- **A getter style prop that reads a signal** (`p={on.get() ? "2" : "1"}`) does not mark. A route with no other bound element stays static, and the class does not change on the client.
- **A compiled text child of a component** (`<Text>{count.get()}</Text>`) is a fragment text node with no element to mark. The compiler marks the nearest template element above it if there is one.
- **A component that calls `effect` and returns base elements** is not marked: the compiler marks only template roots for `effect`.
- **Eager `Node` children** re-render at resume. A `check` rule could flag them in route components; filed as a follow-up.

## Token impact
- k.ui 1,328 to 1,487. k.runtime 1,500 to 1,499.
- Size (gzip): `@keel/ui` 3,031 to 3,104 of 4,096. `@keel/server`, `@keel/runtime-dom` and `@keel/compiler` unchanged (server comments only).

# RFC 0064: base elements and child components resume in place

Status: accepted (ADR-0053)

## Problem
- **Backlog 0174.** An island built from `@keel/ui` elements re-rendered at resume with E1253. Base elements were made with `document.createElement`, so nothing claimed the server nodes. A `Box` root never became the island root ("the component did not render the island root"). A compiled template inside it claimed the island root first ("`<section>` where the template has `<p>`").
- **The same gap in templates.** A child component in a template (`<form><Input /></form>`, or any compiled component) replaced its anchor with `replaceWith`. At resume the template's `<!---->` anchor faced the child's server element, so the shape check failed ("`<form>` has 3 child elements where the template has 2"). k.runtime said so: "a child component whose root lies outside any region is a mismatch".
- **The cost.** The island re-rendered on the client. Text typed into a server-rendered control before the runtime loaded was lost with the server nodes, and so was the focus. RFC 0062 named this as a known limit.

## Proposal
1. **`element(tag, fill)` (`@keel/runtime-dom/ops`).** Outside resume it creates `<tag>` and runs `fill(el)`. While resuming it claims the next server element instead: the island root, a slot's element, or the next element of the current region. `fill` then runs with that element's child elements as the region, so the elements it creates claim them in order. A different tag, a missing child, or a child left unclaimed is E1253. Base elements build every node through it, in document order. `Input` makes its wrapper, then its label, then the control.
2. **`slot(at, render)` and `<!--+-->`.** The compiler lowers a template child that is a component, a nested element or a slot call to `slot(anchor, () => child)`, not `anchor.replaceWith(child)`. A component or nested element gets the anchor `<!--+-->` in the template. The shape check reads `<!--+-->` as one server element of any tag. While resuming, `slot` hands the server element in that place to the child as its root, and a child that renders anything else is E1253. Outside resume, and when no element is in that place, it is `replaceWith` as before.
3. **Text and order.** Text is not compared at resume. A claimed base element drops its text and comment children, and `fill` creates them again. A textarea keeps its text, which is its markup default. Base elements insert children in the order given and never move a claimed node that is already in place.
4. **Focus.** A compiled fragment moves claimed nodes out and back, which blurs a focused control. Resume gives the focus back. The focus events of those moves and of the refocus reach no handler, and the pre-resume queue drops them.
5. **Edits before resume.** A ui control's reactive `value` or `checked` binding checks `edited` on its first run (as k.forms `bind` does, rfc:0062). An edited control keeps its property, and no default is written. Replayed `input` events then reach `onInput` with the user's text.

## Alternatives
- **Re-render the ui subtree and copy control state across.** Server nodes would lose identity. k.runtime requires that every server-rendered node keeps it.
- **Mark ui elements with `data-k` and claim them by id.** Every base element would carry a marker, and every route using one would become an island that ships JS.
- **Lower fragments through a runtime op so nothing moves.** That needs more compiler bytes (24 kB budget, 42 B headroom), and the focus repair is small.
- **Map fresh nodes onto server nodes after the render.** Every op would bind through a lookup, and adjacent text nodes merge in server HTML, so text bindings cannot be mapped.

## Spec diff
- **k.runtime Ops.** Adds "`slot`; `element(tag, fill)` (also k.ui)".
- **k.runtime Resume markup.** Adds "a template slot `<!--+-->` holds one element, which its component claims; `element` claims the next element, and its `fill` claims the children;" and "Focus is kept." "a child component whose root lies outside any region" becomes "a slot without its element". **Conformance** adds "An island rooted at a k.ui base element, or with a child component in a template, resumes without E1253, keeping every server element and the focus."
- **k.runtime, editorial (token budget, 1,500 of 1,500).** No semantics change. The `onError` sentence is shortened. Rules E1253 drops "that island re-renders on the client", which Resume markup states. Removed are the entry's "(dev server; `vite build` of the deployable)", "each route's imported `component`", "with the registered stores", "(a store or signal read)", the restatement "so an island is a component instance whose element subtree has a `data-k` element", and "placed" and "node" from "placed immediately before the op's anchor node".
- **k.ui Base elements.** Adds "Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written (rfc:0064)." **Conformance** adds "An `Input` bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default."

## Conformance diff
- **Added** `packages/ui/conformance/resume-ui-island.test.ts` for both clauses: a `Box`-rooted island, a `<form>` holding a ui `Input` and a compiled child component, and a property (seed 1337) over edits typed before resume.
- **Unit tests.**
  - ui `resumeUiIsland.test.ts`: the 0174 repro (fails before: E1253), a template with a ui `Input` slot, a broken server tree that is still E1253, and a property (seed 1337) over random nestings of ui elements and plain JSX as island roots: no E1253, every server element kept, every pre-resume edit kept.
  - runtime-dom `element-slot.test.ts`: `element` and `slot` outside resume, a child component in a slot, an `element` root, four mismatches (wrong tag, extra child, missing child, empty slot), a slot child that renders a fresh node, and focus kept with no replayed focus events.
  - compiler `mutation-lowerFile-a1/b1.test.ts`: exact output now has `__k.slot(...)` and `<!--+-->`.

## Migration
- **Compiled output.** Template children that are components or nested elements lower to `__k.slot`, with `<!--+-->` anchors. Snapshot tests of compiled modules change. Rendered HTML does not change.
- **App code.** None.

## Known limits
- **Islands of base elements only.** The server marks a route level as an island only when it holds a `data-k` element, which only compiled templates write. A route built only from base elements, such as a `Box` with an `Input` and its `onInput`, stays static HTML. Filed for k.server and k.ui.
- **Structural ops directly under a base element.** Their regions are not claimed yet, so such an island is still E1253, and the server does not emit regions yet.
- **A slot whose child renders text or several nodes** is E1253.

## Token impact
- k.runtime 1,499 to 1,500 (editorial cuts). k.ui 1,237 to 1,328.
- Size (gzip): `@keel/compiler` +27 B (24,532 of 24,576 with RFC 0059's routes literals). `@keel/ui` 2,717 to 3,031 (4 kB). `@keel/runtime-dom` entry unchanged at 3,435. The ops entry, which is not budgeted, grows 5,503 to 5,828. No budget changes.

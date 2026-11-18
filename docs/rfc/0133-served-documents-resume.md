# RFC 0133: a served document resumes: the server writes regions, a layout island's `children` holds the child level, and every island resumes

Status: draft, for the orchestrator to accept. From backlog 0482 (HIGH): documents served by `createApp` do not resume on the client.

## Problem
Two independent faults, each read in the code on 2026-11-18.

1. **No regions are written.** k.runtime Resume markup says the server wraps each structural op's content in `<!--[-->` … `<!--]-->` right before its anchor. Nothing writes them. The server renders a level through the client `mount` on a detached host (`packages/server/src/internal/renderUnit.ts`); outside a resume claim, `prepare` (`packages/runtime-dom/src/internal/prepare.ts`) puts an op's content straight before an empty anchor, and at resume `regionOf` throws `no server region` for the first `If`, `For`, `Match` or `Boundary` in an island. The consumer is built to the spec; the producer is not. The runtime's resume tests hand-write server HTML; the one server test that feeds `createApp` output into `resume` (`packages/server/test/island-ui-root.resume.test.ts`) covers single-level pages of base elements with no structural op, so the two halves were never checked against each other where they differ. The spec has no clause tying them together.
2. **A layout island's slot is undefined at resume.** `renderChain` renders a layout with a `children` thunk returning the child level's HTML as a fragment, and marks each level whose element has a bound node `data-k-island`; the props it stores in `#k-state` have no `children`. The compiler lowers `{props.children()}` to a `slot` at an anonymous anchor `<!---->`. At resume `resume` (`packages/runtime-dom/src/ops/resume.ts`) takes only outermost islands and calls the layout with props lacking `children`: the slot renders nothing, the server's child element is unclaimed, the template's shape does not match, and the layout falls back to a client re-render (E1253), throwing away the page island's server nodes with it. The spec (k.runtime Islands and resume, k.router's layout `children` slot, k.server's route levels) does not say what a layout island's `children` is at resume, nor that an island inside an island resumes.

Together: any served page with a layout island, or with a structural op inside an island, re-renders on the client. golden-1's board is such a page.

## Proposal
A new kernel section, `k.resume` (`spec/kernel/k.resume.md`), status proposed. k.runtime is at 1,499 tokens and keeps every bullet; the new clauses are the contract between the server (producer) and `resume` (consumer), so they sit in one place both builders read.

### 1. Regions, from a server mode of the runtime
The server renders each level with the runtime in a server mode in which every structural op writes its content in a region before its anchor, an empty region when it renders nothing. So does every template slot other than a component slot `<!--+-->`: a slot call such as `children()` or a JSX expression of elements. A `For` region holds its rows, or its `empty` content. The root Boundary of a level's render writes no region, since an island root is the element itself. At resume a slot claims its region's nodes in order, as an op does.

Slot calls get regions because the child-level content and any slot call's content may be a fragment, text or nothing; one element cannot delimit them. The region is the delimiter k.runtime already uses for ops, and `regionOf`, `shapeOf` and `alignTexts` already read it, so the consumer gains no new marker.

The spec names the behaviour, not the switch: how `renderUnit` tells the runtime it is producing a document is the builder's call (an internal option of the runtime's internal entry, not app surface).

### 2. A layout island's `children` at resume
At resume an island level's `children` is a thunk that renders no child level: it returns the nodes of its slot's region, which stay in place and which the layout does not claim. Nested islands inside them resume on their own (3). A later call (an `If` branch or a `Boundary` rendering anew) returns the same nodes and moves them to its place; a removed place detaches them and disposes nothing in them, so a page island hidden and shown keeps its state and handlers. When the server placed no content, a call returns nothing.

**Misuse.** A second call while the layout builds, or a later call while the content is in the document, throws E1255, on the server and in a resumed island; the level fails as a throw does (errorElement, else the 500 document; on the client the island's root Boundary). Two copies of a child level would put the same island roots, element ids and `#k-state` props in the document twice, and there is one set of server nodes to hand out. Zero calls need no rule: the server places nothing and the client claims nothing. A conditional call is specified, not refused: shown at the request, it toggles over the held nodes; hidden at the request, it stays empty on the client (a Limits sentence), since a static level ships no JS and a page island's component alone cannot rebuild its static ancestors' HTML.

E1255 is in E125x (k.runtime's block, now shared with k.resume): the fault is a resume contract. E1254 was deleted in rfc:0040 and is not reused. It is an explain-only code raised by the server render and the resumed island, asserted by conformance (ADR-0029 (c)); its `explain` entry is added with the build.

### 3. Every island resumes, in document order, independently
Every `[data-k-island]` root resumes in document order (an ancestor before its descendants), each with its own props from `#k-state` by route id, root Boundary and delegated listeners; an island's claim stops at a nested island root. A mismatch (E1253) re-renders that island in place of its server element, and only it. A re-rendered layout's `children` returns the held content, so its descendants keep their nodes and resume after it; a descendant that re-renders replaces its element in the held content. This keeps k.runtime's fallback rule (the failing island re-renders, dropping its own queued events) and makes it local.

### 4. Producer meets consumer
The first Conformance bullet: for every route of a test app, the body of the document `createApp` serves, resumed with the app's compiled components and stores, returns no warning, keeps every server node, and a fired handler runs and updates its bindings. Every other bullet is phrased over served documents too, so the blind writer cannot hand-write the HTML.

## Alternatives
- **Delimit the child level as exactly one element** (a `<!--+-->` slot for `children()`). Simpler claim, but a page may return a fragment, text, a string or nothing, and a layout around a non-island page would gain a wrapper constraint. Rejected: it adds a constraint on app code.
- **Ship `children` in `#k-state`** (the child HTML, or a marker the client re-renders from). Re-rendering the child level on the client needs every static level's component in the client bundle, which k.runtime's "static HTML ships no JS" forbids; HTML in `#k-state` doubles the document.
- **Resume the layout and its nested islands as one island.** One scope would own the page island's nodes, so a mismatch in either re-renders both, and the page's props would need to flow through the layout's. Rejected for coupling (principle 2).
- **Refuse a conditional `children` (a check rule).** A layout guarding its page behind a signed-in `If` is ordinary, and works when the condition holds at the request. A check rule for "condition false at the request" cannot see request state. The limit is stated; a rule can follow if the evals show the trap.
- **Write regions by post-processing the HTML.** The server would have to know each op's anchor in the serialized output; only the op knows its content's extent.
- **Treat a second `children` call as a move.** The server's two slots and the client's would hold the content at different times, so the claim order would not match the document. Rejected for E1255.

## Spec diff
- New `spec/kernel/k.resume.md`, status proposed: intro, Regions, Layout islands, Nested islands, Limits, Rules (E1255), nine Conformance bullets.
- `spec/00-map.md`: a row `k.resume | Served documents and resume | proposed`; E125x owner `k.runtime, k.resume`; eight one-line cells trimmed so the map stays within 1,200 tokens (no section title or status changed).
- k.runtime, k.router and k.server unchanged; no bullet reordered or reworded. Status moves to conformance-covered with the conformance commit, as for std.outbox-owner.

## Conformance diff
One `rfc:0133` commit by the `conformance-writer`, in `packages/server/conformance/` (the producer is the subject; every case is a served document fed to `resume` from `@keel/runtime-dom/ops`), one file per bullet:
- producer meets consumer over a test app whose routes cover the cases below, with no warning, identity kept, handlers live;
- an island layout around an island page (own props, page root in the slot region);
- an island layout around a static layout around an island page;
- an island page with `Boundary` around `Match` whose case holds a `For` whose rows hold an `If`, each then driven;
- an empty `For` with an `empty` branch, then a first row;
- a layout whose slot is inside an `If`, served shown (hide, show, same nodes, state kept) and served hidden (no warning; shows nothing);
- E1255: a layout calling `children` twice in its body fails its level; a resumed layout island whose added `For` row calls `children` while another row holds it throws E1255 to its root Boundary;
- document order: an `effect` per island records layout before page;
- isolation: a mismatching layout island re-renders and the page island keeps its nodes; a mismatching page island re-renders and the layout keeps its nodes.

## Migration
None for apps: no API changes. Served documents gain region comments (a few bytes per op).

## Build order
1. This RFC and the spec (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): `@keel/runtime-dom` server mode (ops and `slot` write regions; a held-content `children`; every island resumes in document order; E1255), `@keel/server` (`renderUnit` in that mode, `renderChain`'s `children` returns one held content and throws E1255 on misuse), `@keel/check` `explain` entry for E1255, the resume entry if it needs nested components, changesets; ADR; k.resume to conformance-covered.

## Token impact
k.resume 1,114 tokens by file characters. Map 1,198 to 1,196. No other section changes.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- R1: slot calls, `children()` included, are regions, not single elements.
- R2: a layout island's `children` at resume returns the held server nodes; later calls move them.
- R3: E1255 for a second call while building or while the content is placed; zero calls and conditional calls are specified, not refused.
- R4: every island resumes in document order, independently; a mismatch re-renders only that island.
- R5: a new section, k.resume, rather than trimming k.runtime.

# ADR-0156: content arrives as thunks, an eager element is reported by the check, the server and the console, resume moves no served node, and every packaged component resumes (RFC 0134)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** Resume claims served elements in document order through a cursor, so an element must be made inside the build of what holds it. JSX keeps the order; hand-built calls do not. `Form`'s `children` and `Disclosure`'s `children` accept a node made first; `DataTable` makes its cells, body, table, status and pager before their containers, so a served table never resumes; E1808 reports only base elements' `children`; the resume entry drops `resume`'s warnings in every mode; no packaged component has a resume test. The operator kept cursor claiming and asked for the code fixed and the fault made loud.

**Decision.**
- C1: `Form` and `Disclosure` take `children` only as a thunk. Base elements keep k.ui's Standard slots, a conformance-covered text; the check reports their eager forms.
- C2: E1258 (k.claim), beside E1808: a value given to any component as `children` or another prop holding an element made before the call, through arrays, mapped lists, conditionals, same-file bindings and `const`s imported from project files, and bindings a thunk returns. One diagnostic per fault: E1808 wins where it applies. Fix `() =>` inline; none for a binding.
- C3: E1257: in server mode an element placed by an op that started after it was made; `createApp` logs one `diag` per route, in every mode, and serves the document unchanged.
- C4: the resume entry writes each `resume` warning to `console.warn` in every mode; an island whose client re-render places an element made before its placing op has `made before its parent` in its E1253 warning.
- C5: every component of `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` resumes served by `createApp` and restored by `resumeDocument` in a fresh graph, with no warning, no E1257, `removed()` 0 and working handlers; `DataTable` makes its parts in document order.
- C7: resume moves no served node: under island roots no element or region comment is removed and no element added while `resume` runs, unless an island mismatches or writes state; multi-item content (component, `Form`, `Part`, fragment, op branch or row) keeps each served element in its region; `resumeDocument`'s `detached()` counts removals put back or not. Intended mechanism: a `frag` op that records ordered items while claiming, read by `renderUnit`, ui `appendChildren` and router `renderChildren` (about 150 B gzip in `@keel/runtime-dom/ops`, about 20 B each in ui and router; a budget entry for `@keel/runtime-dom/ops` is added).
- C7 as built: `frag(build)` hands `build` a sink. Outside a claim the sink is a fragment, as before. While claiming it is a recorder: an element item already claimed its server node and stays; a text item replaces the server's text at the cursor in place; an op's fresh anchor stands for the region it claimed (`prepare` records the region's markers and anchor). The empty fragment `frag` returns maps to those nodes (`parts`), which `renderUnit` takes as the unit's nodes and `@keel/ui` `appendChildren` and `@keel/router` `renderChildren` pass over. Three more places moved served nodes and are fixed with it: a component returning several elements in a component slot (the template's last component slot takes the extra elements, in `sameShape` and `alignTexts`, and the slot claims from its server element onward), a resuming `For` placing rows whose nested ops had not rendered yet (a resuming run places nothing), and an `If` whose island state hides the served branch (its region's nodes are taken out rather than failing the claim).
- C3, C4 as built: `made` in `@keel/runtime-dom/internal`: `clone` and `element` stamp the elements they make while it is on; an `element` fill, a slot and a unit compare what they place with their own start. The server turns it on per level render; `resumeIsland` per client re-render.
- C1 as built: the JSX typing (`LibraryManagedAttributes`) lets the children written between a component's tags type-check as the content of a thunk-only `children`, since the compiler wraps them in one; a call without JSX still needs the thunk, so `Form({ children: node })` stays a type error and JSX `<Form>` is unchanged.
- A store created while `resume` holds its snapshot starts from it with new signals instead of writing them, so a store made in a render unit (a `Toaster` row's chart) resumes without E1201.
- C6: a new section k.claim holds these clauses, since k.runtime, k.resume, k.ui, k.check, k.router, k.testing, std.tables and std.headless are full; E1257 and E1258 are in E125x.

**Alternatives.**
- Leave detach-and-reattach and fix only the loss under ops: a move still resets scroll, restarts animations, reloads iframes and aborts composition.
- Claim by key or id: every element would need a key in the markup (operator's call: keep the cursor).
- Widen E1808: changes the meaning of its Rules entry.
- Narrow base elements' `children`: contradicts k.ui Standard slots.
- Log E1257 per request, or fail the level on it: a flooded log, or an outage for a fault the client survives.
- Throw in `resumeDocument` on a removal: breaks pages that change state at load.

**Consequences.**
- Hand-built `Form` calls with nodes, arrays or strings stop compiling and move into thunks.
- Compiled output of multi-item content changes in every file that has it.
- Every browser console shows resume mismatches, production included.
- `@keel/runtime-dom` gains a stamp per made element and a compare per placement, shared by server mode and a client re-render.
- The static rule does not follow members, destructuring, `let` reassignment, other functions' returns, IIFEs or installed packages, and cannot see a component reading an element-valued getter prop first; E1257 covers each on a served page.

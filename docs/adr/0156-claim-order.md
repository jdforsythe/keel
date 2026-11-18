# ADR-0156: content arrives as thunks, an eager element is reported by the check, the server and the console, and every packaged component resumes (RFC 0134)

**Status:** proposed (accepted with the build).

**Context.** Resume claims served elements in document order through a cursor, so an element must be made inside the build of what holds it. JSX keeps the order; hand-built calls do not. `Form`'s `children` and `Disclosure`'s `children` accept a node made first; `DataTable` makes its cells, body, table, status and pager before their containers, so a served table never resumes; E1808 reports only base elements' `children`; the resume entry drops `resume`'s warnings in every mode; no packaged component has a resume test. The operator kept cursor claiming and asked for the code fixed and the fault made loud.

**Decision.**
- C1: `Form` and `Disclosure` take `children` only as a thunk. Base elements keep k.ui's Standard slots, a conformance-covered text; the check reports their eager forms.
- C2: E1258 (k.claim), beside E1808: a value given to any component as `children` or another prop holding an element made before the call, through arrays, mapped lists, conditionals, same-file bindings and `const`s imported from project files, and bindings a thunk returns. One diagnostic per fault: E1808 wins where it applies. Fix `() =>` inline; none for a binding.
- C3: E1257: in server mode an element placed by an op that started after it was made; `createApp` logs one `diag` per route, in every mode, and serves the document unchanged.
- C4: the resume entry writes each `resume` warning to `console.warn` in every mode; an island whose client re-render places an element made before its placing op has `made before its parent` in its E1253 warning.
- C5: every component of `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` resumes served by `createApp` and restored by `resumeDocument` in a fresh graph, with no warning, no E1257, `removed()` 0 and working handlers; `DataTable` makes its parts in document order.
- C6: a new section k.claim holds these clauses, since k.runtime, k.resume, k.ui, k.check, k.router, k.testing, std.tables and std.headless are full; E1257 and E1258 are in E125x.

**Alternatives.**
- Claim by key or id: every element would need a key in the markup (operator's call: keep the cursor).
- Widen E1808: changes the meaning of its Rules entry.
- Narrow base elements' `children`: contradicts k.ui Standard slots.
- Log E1257 per request, or fail the level on it: a flooded log, or an outage for a fault the client survives.
- Throw in `resumeDocument` on a removal: breaks pages that change state at load.

**Consequences.**
- Hand-built `Form` calls with nodes, arrays or strings stop compiling and move into thunks.
- Every browser console shows resume mismatches, production included.
- `@keel/runtime-dom` gains a stamp per made element and a compare per placement, shared by server mode and a client re-render.
- The static rule does not follow members, destructuring, `let` reassignment, other functions' returns, IIFEs or installed packages, and cannot see a component reading an element-valued getter prop first; E1257 covers each on a served page.

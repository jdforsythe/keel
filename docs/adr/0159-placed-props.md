# ADR-0159: a called prop is placed as content, and a JSX child that would render nothing is reported (RFC 0137)

**Status:** proposed (RFC 0137, for the orchestrator to accept).

**Context.** The compiler places a JSX child call as content only for `children()` and `slots.<name>()`, by name; `{props.icon()}` with an element thunk compiles to a text binding, and the runtime renders the node as `''` with no report. `{props.icon}` writes the function's source. The compiler has no types, and `tsc` accepts both.

**Decision.**
- C1: a call of a direct member of the component's first parameter, alone or as the left of `??`, is a slot call (syntax only): a node or nodes are placed as content, a string as text, once, in claim order, and it resumes in place.
- C2: E1406 (E140x, k.place): the check's type pass reports any other text-bound JSX child whose type holds a node or is a function; fix `()` for a parameterless function prop or name; none where E1403 reports.
- C3: `text` renders `''` for a function in every mode; `'dev'` writes one `console.warn` per binding and a dev `createApp` one `diag` per route; production is silent.
- C4: the contract lives in a new section, k.place.

**Alternatives.** Type-directed lowering (a TypeScript program per compile). A diagnosed error only (more spellings for one idea). A `text` op that places nodes (a region for every binding). Production reporting (bytes on every page for a static fault). Keeping `String(fn)`.

**Consequences.**
- A string-returning prop called alone renders once; reactive text binds a value or a wrapped expression.
- The lowering of `{props.x()}` changes in every compiled file that has it.
- Element-valued text bindings stop being silent in dev and in the check.

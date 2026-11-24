# k.claim: Claim order
status: conformance-covered

Where an element is made, so that resume (k.runtime, k.resume) claims its own server element.

**Order.** At resume each op claims the next server element when it runs, so an element is made inside the build of what holds it: an `element` fill, a slot, a structural op, or a thunk or render function one of them calls. An element made before and passed in (eager) claims its parent's server element: its island mismatches (E1253) and re-renders. Compiled JSX keeps the order: component children compile to a thunk, element-valued props to getters (k.compiler).

**Types.** A component a Keel package exports takes content only as a thunk or render function. `Form` (k.router) takes `children?: () => Node | readonly Node[] | string`; `Disclosure` (std.headless) takes `children: () => Child`. Base elements keep k.ui's Standard slots.

**Check.** In app code, a value given to a component as `children` or any other prop that holds an element made before the call is E1258 at the value, unless E1808 reports it. A component is a base element, `Part`, an intrinsic, `Form`, a std widget, or a function the check resolves through the project's files whose body returns JSX or a component call. Made before the call: a JSX element or fragment or a component call outside a thunk; an array holding one; `xs.map(f)` with `f` returning one, outside a thunk; each branch of `?:`, `&&`, `||` and `??`; a binding whose initializer is one of these (same file, or a `const` imported from a project file), also when a thunk given as the prop returns it, alone or in an array, and the binding is declared outside that thunk. A JSX attribute holding such a binding counts. Clean: a thunk or render function making its elements inside it; a parameter or `props.children`; a string, number, signal or computed; a call no file resolves to a component; `Case` in `Match`; test files. Not followed: `let` reassignment, members, destructuring, other functions' returns, IIFEs, packages outside the project, and a component reading an element-valued prop before making its own element.

**Server.** In the runtime's server mode an element made in a level's render and placed by an `element` fill, a slot or a structural op that started after it was made is E1257: `createApp` logs a `diag` record with the code and the route id (k.server Log) the first time a route renders one, in every mode, and serves the document unchanged. Another level's content and parsed HTML are not checked.

**Client.** The resume entry writes each warning `resume` returns to `console.warn`, one line, in every mode. An island whose client re-render places an element made before the op placing it started has an E1253 warning holding its island id and `made before its parent`.

**Packaged components.** Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work. A `resumeDocument` handle has `removed()`: the elements under the served island roots not in the document when it resolved.

**In place.** During `resume` a MutationObserver sees under island roots no element or region comment removed and no element added, unless an island mismatches (E1253) or writes state; text may be replaced and empty anchors added. So content of several items (a component's, a fragment's, an op's branch or row) keeps each served element in its region. A `resumeDocument` handle's `detached()` counts those removed, put back or not.

**Rules.** E1257 an element placed by an op that started after it was made, in a served render · E1258 an element made before the component call it is passed to (fix: `() =>`; none for a binding).

**E1258's message.** `<prop>: an element made before the call; make it inside a thunk` (`icon`: 61 units).

**Conformance.**
- `Form` or `Disclosure` given `children` as a node, an array of nodes or a string is a type error; a thunk is not.
- `Card({ icon: Icon() })`, `Card({ children: [Input(...)] })`, `Disclosure({ children: xs.map((x) => Text(x)) })`, `Card({ children: ok ? A() : 'x' })`, `<Card icon={el} />` with `const el = <Icon />`, and `Form({ children: () => [el] })` with `el` a component call before it or a `const` imported from another project file are each one E1258; the inline ones' fix applies and re-checks clean.
- None: thunks or render functions making their elements, `props.children`, strings, signals, `String(n)`, a callee no file resolves, `Match` with `Case`s, an element returned or placed in order, and a base element E1808 reports (one diagnostic).
- A served page passing an eager element to `Form`, a base element or a component reading its prop first logs one E1257 with its route id over two requests; its thunked twin, nested islands and every packaged component log none.
- An island that mismatches under the resume entry writes one `console.warn` starting `E1253` with its id in production mode; with an eager child it holds `made before its parent`, with a template mismatch it does not.
- `DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work.
- An island whose `effect` hides at resume an `If` branch the server showed has `removed()` equal to that branch's elements.
- With one, two and array children of a component, nested components, `Form` with one and several, `Part`, `If`, `For` rows, `Match` and `Boundary` with several, a fragment in a slot and text beside elements: no element removed or added, each in its region, handlers work, `detached()` 0; only a mismatching island removes.
- A focused `Input` keeps focus, typed value and caret across resume.

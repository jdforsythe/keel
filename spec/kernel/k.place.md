# k.place: Placed props
status: conformance-covered

How a component places content a prop gives it, so that no JSX child expression renders nothing in silence: each is placed as content, bound as text, or reported.

**Prop calls.** In a component (k.component Shape), a JSX child expression that is a call of a member of the component's first parameter, `{props.icon()}` or `{props.icon?.()}`, alone or as the left of `??`, is a slot call, as `{props.children()}` is: the compiler places what it returns as content through a slot, in claim order (k.claim), and does not bind it as text. A node, an array of nodes or a fragment is placed; a string is placed as text. It renders once in its place (k.component Slot props, Build); for text that updates, bind a value that is not a prop call alone (`{props.label}`, `{String(props.count())}`). A computed member (`props[k]()`), a member of a member (`props.a.b()`) and a call of any other function are not slot calls.

**Sanctioned.** An element-valued prop reaches the page as `{props.x()}` (`x: () => Node`), `{props.children()}`, inline JSX, a component tag, the thunk given to a base element's `children`, or a prop call inside `If`, `For`, `Match` or `Boundary` content. A conditional or list of elements is `If` or `For` (E1403).

**Check.** A JSX child expression the compiler binds as text (not JSX, not a slot call, not E1403) whose TypeScript type is or may hold a `Node` (a `Node`, a union with one, an array of them) or is a function, is E1406 at the expression, through the check's type pass (as E1453). `any` and `unknown` are not reported. Fix: when the expression is a prop member or a name whose type is a function with no required parameter, append `()`; none otherwise.

**Runtime.** A text binding whose value is a node, an array holding one, or a function renders `''`, in every mode (a function's source is never written). In `'dev'` mode the client writes one `console.warn` line per binding, starting `E1406` and holding the element id and `renders nothing`; a dev server's `createApp` logs one `diag` record with E1406 and the route id the first time a route renders one (k.server Log). Production writes nothing.

**Rules.** E1406 a JSX child expression bound as text whose type holds a node or is a function (fix: `()` for a function prop or name with no required parameter).

**Conformance.**
- `function Card(props: { icon: () => Node })` rendering `<Box>{props.icon()}</Box>` with `icon: () => <Text>i</Text>`: served by `createApp`, the document holds the `Text` element in the `Box`; resumed by `resumeDocument`, no warning, `removed()` and `detached()` 0, and a handler on the icon's element runs. The same with `props.icon?.()`, `props.icon?.() ?? 'none'` with `icon` absent (`none` as text), two elements beside text, and inside `If` and `For` content.
- `{props.label()}` with `label: () => 'Hi'` renders `Hi` once in its place; `{String(props.count())}` updates when the signal it reads changes.
- Each one E1406: `{props.icon}` with `icon: () => Node` (fix `{props.icon()}` applies with `git apply` and re-checks clean); `{ok ? props.icon() : null}`; `{makeIcon()}` with `makeIcon(): Node` imported from a project file; `{props.items}` with `items: Node[]`; `{props[k]()}` with a `Node` result; `{f}` with `f: (n: number) => string` (no fix).
- None: `{props.icon()}`, `{props.children()}`, `{props.label}` with a string, `{String(n)}`, `{t.title}`, `{x}` with `x: any`, `{formatMoney(m, l)}`, inline JSX, and `{ok && <b/>}` (one E1403 and no E1406).
- In `'dev'` mode a mounted text binding given a node, an array holding one and a function each writes one `console.warn` starting `E1406` with the element id, once over two updates, and renders `''`; in production, `''` and no line. A dev `createApp` serving such a route twice logs one `diag` E1406 with its route id; production none.

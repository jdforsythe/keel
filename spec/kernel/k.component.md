# k.component: Components
status: conformance-covered

**Shape.** One default export per file; filename equals name. `export const Props = s.object(...)`. Signature `(props: Props, slots: undefined, ctx?: Ctx) => JSX`: `ctx` (k.ctx) is passed by the runtime from the mount or island root and by the harness from `render`; it is the only way a component reaches an effect (resource fetchers close over it). A component file (a PascalCase `.tsx` with a default export, or a PascalCase `.ts` whose default export is a function whose first parameter's type names `Props`; rfc:0068) may also export `Props` and `uses`; any other file declaring `Props` is E1104 (`export const uses = [addItem]`, k.store); the compiler calls `uses(...)` in the component's scope. Props are getters: destructuring is E1401 (compiler rewrites simple cases and emits the fix). A top-level `const` of a component or of a keyed `For` row callback whose initializer reads only props or the row's item, literals and operators, used in a JSX expression outside any function, is E1405: the value reaches the DOM or a child's props once; the fix reads it in the binding. JSX children are the default slot, delivered as `props.children: () => Node | Node[] | string` (a thunk, rendered inside the child's scope); the second argument is always `undefined`.

**Slot props.** A named slot is a prop whose value is a function returning JSX, typed with the component's props and kept out of its `Props` schema: `option?: (o: Option<K>, s: { active(): boolean; selected(): boolean }) => JSX` (std.options). The receiving component calls it in its own scope, once per place it renders (inside a `For`, in that row's scope, disposed with the row); its arguments are values and accessors, never DOM nodes. `children` and the standard slots (k.ui) are slot props with fixed names. A callback prop (`onChange: (d: PlainDate) => void`) is typed and kept out of the schema the same way.

**Control flow.** `<If when={} fallback={() => …}>`, `<For each={} key="id">` (a row whose key stays keeps its nodes and its bindings update from the new item; an insert or removal moves no other row), `<Match on={union}>` with one `<Case tag="">` per variant (missing variant is E1402). A file without JSX calls them as functions with the same props (`If({ when, children: () => node })`); the compiler removes a `@keel/runtime-dom` import only when every binding it imports is used solely as a JSX tag. Elements in a JSX child expression are E1403 and bind nothing: `{a && <b/>}`, `{a ? <b/> : c}` (also `||`, `??`), an array or `map()` of elements, a function, or a same-file call or binding returning them, names resolved by scope (rfc:0061). At runtime `text` renders nothing for a node or an array holding one. In a file importing `If`, the fix rewrites `&&` and `?:` to it.

**Build.** A component body, and each child an `If`, `For`, `Match`, `Case` or `Boundary` renders, is built untracked however it is called (JSX, a call in a `.ts` file, a route, `mount`, `render`): a reactive read there (a signal, store or computed, a prop, a function prop it calls) is its value at build and re-renders nothing. Only these track and update: a binding (k.runtime), a `computed` or `effect` made there, and each op's own input: a branch renders anew when `when` flips, a row when its key arrives, a case when its tag changes, a Boundary's children on `reset()`. Called as a function, `For` takes `each` as a getter and renders a kept key's row anew for a new item object.

**IDs.** Every element gets a stable id: explicit `id="cart.submit"` or derived `<file>.<index>`, where `<file>` is the project-root-relative path without extension with `/` as `.` (`src.orders.OrderList.0`) and `<index>` counts the file's elements in source order; duplicates are E1404. A stdlib widget gives each element it renders the id `<id>.<part>` from its own `id` prop; its section names the parts.

**Conformance.**
- Render is pure for equal props and state.
- A11y tree snapshot stable across re-renders.
- Every element addressable by id in the harness.
- A component's JSX children arrive as `props.children` and render inside the child's scope.
- A base element given JSX text children renders that text.
- `{a ? <b/> : <i/>}`, `{a && <b/>}`, `{[<b/>]}` and `{xs.map((x) => <li/>)}` as children are each one E1403 and render nothing; `<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy.
- A plain `.ts` component file exporting `Props` and `uses` beside its default export reports neither E1752 nor E1104.
- A PascalCase `.ts` file whose default export is not a function taking `Props` and that exports a `Props` schema reports E1104.
- Replacing `each` with new objects of the same keys keeps each surviving row's element and `document.activeElement`, and updates the changed row's text.
- `const label = props.label` at a component's top level with `{label}` as a text child is one E1405; `{props.label}` is none.
- A plain `.ts` module calling `If` and `Boundary` imported from `@keel/runtime-dom`, or naming `If` only as a parameter or destructuring default, compiles with that import kept and renders the chosen branch; a `.tsx` module using them only as tags compiles with the import removed.
- A slot prop a component calls inside a `For` renders in that row's scope: removing the row disposes what the call rendered.
- The runtime, the router and the harness call a component with `undefined` as its second argument.
- A component reading a signal at its top level, rendered from JSX, from a `.ts` call and as a route page, keeps its nodes, focus and local signals when the signal changes; a binding reading it updates.
- A `Case` reading `value()` at its top level renders once per tag; its binding reading `value()` shows each new value.
- Called as a function with `each` a getter, `For` renders a kept key's row anew for a new item object and keeps every other row's nodes.

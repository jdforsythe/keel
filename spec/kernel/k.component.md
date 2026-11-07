# k.component: Components
status: conformance-covered

**Shape.** One default export per file; filename equals name. `export const Props = s.object(...)`. Signature `(props: Props, slots?: { name: Slot }, ctx?: Ctx) => JSX`: `ctx` (k.ctx) is passed by the runtime from the mount or island root and by the harness from `render`; it is the only way a component reaches an effect (resource fetchers close over it). A component file (a PascalCase `.tsx` with a default export, or a PascalCase `.ts` whose default export is a function whose first parameter's type names `Props`; rfc:0068) may also export `Props` and `uses`; any other file declaring `Props` is E1104 (`export const uses = [addItem]`, k.store); the compiler calls `uses(...)` in the component's scope. Props are getters: destructuring is E1401 (compiler rewrites simple cases and emits the fix). JSX children are the default slot, delivered as `props.children: () => Node | Node[] | string` (a thunk, rendered inside the child's scope); the `slots` argument is reserved for named slots (later RFC).

**Control flow.** `<If when={} fallback={() => …}>`, `<For each={} key="id">`, `<Match on={union}>` with one `<Case tag="">` per variant (missing variant is E1402). Elements in a JSX child expression are E1403 and bind nothing: `{a && <b/>}`, `{a ? <b/> : c}` (also `||`, `??`), an array or `map()` of elements, a function, or a same-file call or binding returning them, names resolved by scope (rfc:0061). At runtime `text` renders nothing for a node or an array holding one. In a file importing `If`, the fix rewrites `&&` and `?:` to it.

**IDs.** Every element gets a stable id: explicit `id="cart.submit"` or derived `<file>.<index>`, where `<file>` is the project-root-relative path without extension with `/` as `.` (`src.orders.OrderList.0`) and `<index>` counts the file's elements in source order; duplicates are E1404.

**Conformance.**
- Render is pure for equal props and state.
- A11y tree snapshot stable across re-renders.
- Every element addressable by id in the harness.
- A component's JSX children arrive as `props.children` and render inside the child's scope.
- A base element given JSX text children renders that text.
- `{a ? <b/> : <i/>}`, `{a && <b/>}`, `{[<b/>]}` and `{xs.map((x) => <li/>)}` as children are each one E1403 and render nothing; `<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy.
- A plain `.ts` component file exporting `Props` and `uses` beside its default export reports neither E1752 nor E1104.
- A PascalCase `.ts` file whose default export is not a function taking `Props` and that exports a `Props` schema reports E1104.

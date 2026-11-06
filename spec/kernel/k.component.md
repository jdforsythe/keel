# k.component: Components
status: proposed

**Shape.** One default export per file; filename equals name. `export const Props = s.object(...)`. Signature `(props: Props, slots?: { name: Slot }, ctx?: Ctx) => JSX`: `ctx` (k.ctx) is passed by the runtime from the mount or island root and by the harness from `render`; it is the only way a component reaches an effect (resource fetchers close over it). A file may also export `Props` and `uses` (`export const uses = [addItem]`, k.store); the compiler calls `uses(...)` in the component's scope. Props are getters: destructuring is E1401 (compiler rewrites simple cases and emits the fix).

**Control flow.** `<If when={}>`, `<For each={} key="id">`, `<Match on={union}>` with one `<Case tag="">` per variant (missing variant is E1402). `{a && <b/>}` is E1403.

**IDs.** Every element gets a stable id: explicit `id="cart.submit"` or derived `<file>.<index>`, where `<file>` is the project-root-relative path without extension with `/` as `.` (`src.orders.OrderList.0`) and `<index>` counts the file's elements in source order; duplicates are E1404.

**Conformance.** Render is pure for equal props and state; a11y tree snapshot stable across re-renders; every element addressable by id in the harness.

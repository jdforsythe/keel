# k.component: Components
status: proposed

**Shape.** One default export per file; filename equals name. `export const Props = s.object(...)`. Signature `(props: Props, slots?: { name: Slot }) => JSX`. Props are getters: destructuring is E1401 (compiler rewrites simple cases and emits the fix).

**Control flow.** `<If when={}>`, `<For each={} key="id">`, `<Match on={union}>` with one `<Case tag="">` per variant (missing variant is E1402). `{a && <b/>}` is E1403.

**IDs.** Every element gets a stable id: explicit `id="cart.submit"` or derived `<file>.<index>`; duplicates are E1404.

**Conformance.** Render is pure for equal props and state; a11y tree snapshot stable across re-renders; every element addressable by id in the harness.

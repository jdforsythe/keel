# ADR-0032: One way for schema validation, random ids, styling, button text, and pending state (RFC 0043)

**Status:** accepted

**Context.** The freeze review (§2 rows 4-8, backlog 0064) found five dual surfaces:
- `decode` was `parse`.
- `random.uuid()` sat beside `random.id(brand)`.
- `styles()` and `class` sat beside typed style props.
- A Button took its text from `label` or from children.
- A submission's pending state could be read three ways: `f.pending()`, `<Form loading>`, and `route().pending`.

**Decision.**
- **Schema.** `parse` is the only validating entry. It also inverts `encode`. `decode` is removed.
- **Ids.** `ctx.random.id(brand)` is the only minting call. `uuid()` is removed. A token is `id('Caller')`.
- **Styling.** Typed style props, with `states`, are the only styling. `styles()` and the `class` prop are removed. E1803 covers only the `style` attribute.
- **Button.** Its children are its text and its accessible name. `label` is removed. An icon button uses `<Image alt>`.
- **Pending.** The router's submit is the one writer. `f.pending()` is a submission's state. `route().pending` is the router's busy flag: a navigation, a revalidation, or an action. `<Form loading>` and `Form`'s private pending signal are removed.

**Alternatives.**
- **`decode` as a stricter JSON-only codec.** This would add new behavior.
- **`label` as `aria-label`.** An empty button would still type-check.
- **A `loading` slot derived from `f.pending()`.** That would still be two ways to render, and the slot cannot disable a button.
- **`route().pending` for navigation only.** `settle` would return mid-action.

**Consequences.**
- **Fewer names.** Apps and agents have five fewer names to choose between.
- **Removed forms are tested.** Conformance asserts each removed form is absent, at runtime and at type level.
- **Pending UI.** Rendering pending UI needs a `form` handle. A `<Form>` without one shows no per-form pending.
- **Leftovers for other owners.** The compiler's `styles()` collection and check's exported-`styles` E1803 branch are dead code until their owners remove them (RFC 0043 Migration).

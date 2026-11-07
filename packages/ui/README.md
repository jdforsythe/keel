# @keel/ui

**Spec:** k.ui · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `defineTokens` (throws `E1807`), `TokenSchema`. Base elements `Box Text Heading Button Link Image Input TextArea Select Checkbox`: `(props) => Node`, `children` prop (plain, or the `Children` thunk the compiler delivers, RFC 0008). `@keel/ui/css`: `compileStyles({ tokens, usages })` -> `{ classes, css }`, `contrast(fgHex, bgHex)`. Types: `Tokens`, `TokenName`, `StyleProps`, `Child`, `StandardSlots`, ... (`Href` comes from `@keel/router`).
- **Invariants:** style values are `TokenName` strings (existence is `check`'s E1801) or a signal/computed; responsive by breakpoint (`base` + names); state styles under `states={{ hover, focusVisible, active, disabled }}`. One class per (prop, token, breakpoint, state): `k-[bp-][state-]prop-token` (`_hash` suffix if not alphanumeric). `compileStyles` is pure: `:root` vars, dark/reduced-motion overrides, base rules, `min-width` blocks, state rules; `E1801` on unknown token. Dynamic values bind one `attr(class)`; never a `style` attribute. Controls render `<label for>` + control; id = `field.id`, else `id`, else `k-<kind>-<label-slug>` (`-2`, `-3`... if taken in the document or this render). `field` (k.forms) binds the control; its error renders under `field.errorId`. `disabled` on `Button` and controls. `Button` is named by its children (no `label`); style props are the only styling (no `class`, no `styles()`; RFC 0043). `Link to: Href`. Event props, closed (RFC 0009): `Button onClick`, `Checkbox onChange(checked)`, `Input`/`TextArea onInput(value)`, `Select onChange(value)`; none elsewhere. `Image decorative` -> `alt=""` `role="presentation"`. URLs pass `safeUrl`.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/runtime-dom`, `@keel/router`, `@keel/forms` (types).
- **Rungs:** conformance, properties.

## Extension points

None. Token names are not typed per app (principle 2); `check` validates them against `tokens.ts`.

## Unsafe

count: 0

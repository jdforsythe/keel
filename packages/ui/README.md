# @keel/ui

**Spec:** k.ui · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `defineTokens(tokens)` (throws `E1807`), `TokenSchema`, `styles({ name: StyleProps })` -> class strings. Base elements `Box Text Heading Button Link Image Input TextArea Select Checkbox`, each `(props) => Node`, children via `children`. `@keel/ui/css`: `compileStyles({ tokens, usages })` -> `{ classes, css }`, `contrast(fgHex, bgHex)`. Types: `Tokens`, `Register`, `StyleProps`, `Href`, `Child`, `StandardSlots`, ...
- **Invariants:** style values are token names (`Register` augmentation, else the k.ui example set) or a signal/computed; responsive by breakpoint (`base` + names), states `hover focusVisible active disabled`. One class per (prop, token, breakpoint, state): `k-[bp-][state-]prop-token`, hashed suffix after `_` when not alphanumeric. `compileStyles` is pure: `:root` vars, dark/reduced-motion overrides, base rules, `min-width` blocks in token order, then state rules; throws `E1801` on unknown token. Dynamic values bind one `attr(class)`; no `style` attribute, ever. Controls render `<label for>` + control; id from `id` or `k-<kind>-<label-slug>`. `Image decorative` -> `alt=""` `role="presentation"`. URLs go through `safeUrl`.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/runtime-dom`.
- **Rungs:** conformance, properties (compileStyles, contrast, ids, TokenSchema).

## Extension points

`declare module '@keel/ui' { interface Register { tokens: typeof tokens } }` types style props by the app's tokens.

## Unsafe

count: 0

# @example/library-looks

A Keel library that ships its look as tokens: five components, `Card`, `Badge`, `Switch`, `Toggle` and `Toolbar`, written in the `acme.` names of `src/acmeTokens.ts`.

- `src/acmeTokens.ts` is one `defineTokens` literal: colors with a light and a dark value, spaces (one a safe-area inset), sizes, radii, font sizes (one a `clamp()`), a border and seven looks, and a `contrast` theme with a darker accent and track for `prefers-contrast: more`. Its `./tokens` export lets an app import it.
- The root `tokens.ts` composes `acmeTokens` with `brandTokens` as an app does, so `keel check` and `keel test` here judge contrast, focus and names, the shipped `contrast` theme at 7:1.
- `Switch` has the role `switch`, is named by its `label`, and reports `aria-checked` from `on`.
- `Toggle` has the role `button`, is named by its `text`, and reports `aria-pressed` from `pressed`; its `acme.toggle` look takes `acme.accent` and `acme.onAccent` when pressed.
- `Toolbar` is one tab stop over its items, moved with the arrow keys, Home and End; a disabled item keeps its place, takes focus, reads as disabled and does nothing when chosen.

`examples/library-app` lists it in a module's `deps`, overrides two of its tokens, adds a `SchemeSelect` and a `ThemeSelect`, and holds a `slate` theme, a contrast theme that spreads the shipped one and a print theme.

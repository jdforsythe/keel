# @example/library-looks

A Keel library that ships its look as tokens: four components, `Card`, `Badge`, `Switch` and `Toggle`, written in the `acme.` names of `src/acmeTokens.ts`.

- `src/acmeTokens.ts` is one `defineTokens` literal: colors with a light and a dark value, spaces, sizes, radii, a font size, a border and five looks. Its `./tokens` export lets an app import it.
- The root `tokens.ts` composes `acmeTokens` with `brandTokens` as an app does, so `keel check` and `keel test` here judge contrast, focus and names.
- `Switch` has the role `switch`, is named by its `label`, and reports `aria-checked` from `on`.
- `Toggle` has the role `button`, is named by its `text`, and reports `aria-pressed` from `pressed`; its `acme.toggle` look takes `acme.accent` and `acme.onAccent` when pressed.

`examples/library-app` lists it in a module's `deps`, overrides two of its tokens and adds a `SchemeSelect`.

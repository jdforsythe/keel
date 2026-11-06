# Task 0017-0018: ui

**Spec:** k.ui · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/ui
Covers backlog 0017 (tokens, style props, atomic CSS, scoped styles) and 0018 (base elements with a11y-required props; standard slots) as one package build.

## Deliverables
- [x] `defineTokens`, `TokenSchema` (closed groups, `{ light, dark }` colors, E1807)
- [x] typed style props `p px py m mx my gap w h bg fg radius font fontSize weight shadow direction align justify wrap`; responsive by breakpoint; state styles under `states={{ hover, focusVisible, active, disabled }}` (rfc:0000)
- [x] `@keel/ui/css`: `compileStyles({ tokens, usages })` -> `{ classes, css }` (pure, deterministic, deduped); `contrast(fg, bg)` (WCAG 2)
- [x] `styles({...})` scoped styles -> class strings
- [x] base elements `Box Text Heading Button Link Image Input TextArea Select Checkbox` with a11y-required props in the types; `StandardSlots` type
- [x] property tests (seed 1337); README contract; changeset; spec status -> implemented

## Steps
1. [x] conformance written by conformance-writer (packages/ui/conformance).
2. [x] Implement; `pnpm --filter @keel/ui check`; `test`.
3. [x] Properties; README; changeset. Spec status kept `proposed` until review (coordinator).
4. [x] rfc:0000 follow-up: `states` prop, `disabled` boolean, `Href` from router (now imported), `Heading level` literal union.
5. [x] Router landed: stand-in `Href` replaced; base elements need no k.component ctx parameter (tsc clean). Own tests assert element `outerHTML` (runtime-dom `mount` now appends a `<!---->` anchor).

## Decisions
- D1: Style-prop types are keyed by the app's tokens through a `Register` interface (`declare module '@keel/ui' { interface Register { tokens: typeof tokens } }`). Unregistered, the k.ui example token set (`internal/DefaultTokens.ts`) applies, so E1801 holds at the type level without app generics. Scaffold should emit the augmentation next to `tokens.ts`.
- D2: A dynamic style value is typed `Computed<string>` (any signal/computed): the conformance passes `signal<string>`, so dynamic values are not token-checked by types; E1801 for them is left to `check`. Getter props (compiled dynamic expressions, k.component) are detected by property descriptor and tracked the same way.
- D3: Class names: `k-[bp-][state-]prop-token` (state segments `hover focus active disabled`) when every part is alphanumeric and the breakpoint is not a state segment; otherwise parts are sanitized to `[A-Za-z0-9_]` and `_<fnv1a base36 of the tuple>` is appended. Readable names never contain `_`, hashed ones always do, so names are injective. Custom properties: `--k-<group>-<token>` with the same rule.
- D4: CSS order: `:root` vars (all tokens except breakpoints), `@media (prefers-color-scheme: dark)` overrides for pair colors, `@media (prefers-reduced-motion: reduce)` setting every motion var to `0ms`; base rules; one `min-width` block per breakpoint in token order; then state rules (hover, focusVisible, active, disabled) and their own per-breakpoint blocks. State rules have higher specificity (class + pseudo), so placing them after keeps md-hover over base-hover. Within a section rules sort by (state, prop order, token order, name), so CSS is independent of usage order.
- D5: Rules use `var(--k-...)`, so dark mode needs no extra classes. Flex props emit `display:flex;<property>:<value>` atomically. Keyword vocabularies: direction `row column row-reverse column-reverse`; align `start center end stretch baseline`; justify `start center end between around evenly`; wrap `wrap nowrap reverse`.
- D6: `w`/`h` take `size` tokens, then `space` tokens (conformance uses `w: "3"` with no `size` group). Size wins on a name collision.
- D7: `compileStyles` throws `Error` with `code: 'E1801'` for an unknown token, keyword or breakpoint, and `E1807` for a token value containing `{ } ; < >` or `/*` (CSS breakout).
- D8: `TokenSchema` is a `Schema<Tokens>` whose `parse/decode/encode` enforce closed groups (unknown group -> issue rule `enum`) and string-or-pair colors; `node/gen/doc/optional/nullable` come from an open `s.object` with string colors. k.schema has no closed objects and no scalar-or-object union; RFC candidate.
- D9: `defineTokens<const T>` returns its input (literal names kept) after `TokenSchema.parse`; throws `code: 'E1807'` on failure.
- D10: Dynamic classes bind one `attr(el, 'class', fn)` op (empty -> attribute removed); static props set `class` once with no binding. Reactive children bind `text` on a fresh text node; reactive `value`/`checked` bind `prop`. Never a `style` attribute.
- D11: Controls render `<div><label for=id>label</label><control id=id></div>` (checkbox: control then label); style props go on the control. id = `id` prop, else `k-<kind>-<slug(label)>` (hash when the slug is empty). Equal labels give equal ids (E1404 territory; pass `id`).
- D12 (rev 2): `Link to`/`Image src` take `import type { Href } from '@keel/router'` (branded `string & { readonly __brand: 'Href' }`, same shape as the former stand-in, now deleted). ui does not re-export `Href` (one import path, P1). URLs pass through runtime-dom `safeUrl(name, value)`.
- D13 (rev): `Heading level` is `1 | 2 | 3 | 4 | 5 | 6` (conformance updated); no runtime range check.
- D14: `Button`: children with `label` -> `aria-label`; `label` alone -> visible text; `type` defaults to `button`. `Image decorative` -> `alt=""` + `role="presentation"`.
- D15 (rev, rfc:0000): state styles live under one `states` prop; `disabled?: boolean | Computed<boolean>` is the HTML attribute on `Button Input TextArea Select Checkbox` (static sets the attribute; reactive binds the `disabled` property via `prop`). `compileStyles` usages keep the flat `state` field.
- D16: `styles()` builds its record with an honest runtime-checked type guard (`internal/hasEvery.ts`) instead of `unsafe`; unsafe count stays 0. (An `unsafe/` helper broke `pnpm build`: TS6059 rootDir, the same factory issue ctx has.)
- D17: No event props on base elements yet (k.ui lists none; handlers are keyed by element id in k.runtime). `Input field` (k.forms bindings) is not implemented here: forms conformance calls `Input({ field, label })`.

## Verification
- [x] `pnpm --filter @keel/ui check` clean · structure-lint clean for ui · budgets ok
- [x] conformance green (all ui conformance files)
- [x] properties present: compileStyles determinism, dedupe, order independence, injectivity; contrast symmetry, range, #rgb expansion, known WCAG pairs; derived ids pure; TokenSchema gen/encode
- Mutation: `mutate` script is `echo skip`; not measured.

Test trailer (`pnpm --filter @keel/ui test`): `ok 71 tests, 0 failed, 3 skipped (1.4s)` (3 skipped = `it.todo` E1803/E1805/E1806)

## Next action
review

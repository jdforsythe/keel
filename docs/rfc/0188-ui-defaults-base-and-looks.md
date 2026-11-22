# RFC 0188: k.ui defaults: a base from the tokens, named looks, a stacking `gap`, a brand focus ring

Status: draft (ADR-0209 proposed). From walkthrough findings S-2, S-4, S-7 to S-11 (`tasks/p1/walkthrough-findings.md`): an app author styling `apps/household` to `docs/BRAND.md`. S-5 and S-6 are built in `@keel/ui` beside this RFC; D7 states them in the spec.

## Decisions
- D1 (S-2): `tokens.ts` gains a closed `base` group: one style set per element role, which the compiled stylesheet applies to every element of that role with no app code. `brandTokens` carries the brand's `base`, so every app on `brandTokens` (the scaffold's default) renders on brand from its first page. An app with its own tokens and no `base` gets no role rules, as now.
- D2 (S-9): `base.focus` names a color token; every focusable element then shows a 2px solid outline in it at 2px offset on `:focus-visible` in place of the platform's ring. The style vocabulary still has no `outline`, so no app style removes it. A `focus` color under 3:1 against `base.page`'s `bg` is E1807. `BRAND.md` gains the focus rule: 2px Charcoal (`text`), offset 2px, square.
- D3 (S-11): `tokens.ts` gains a `look` group: named style sets, declared once. Every base element and `Part` takes `look="<name>"`; the compiler expands it to the set's classes, and the element's own style props replace the set's per prop. `brandTokens` carries `control`, `primary` and `secondary`. An app overrides a look, or the base, through its tokens (`{ ...brandTokens, look: { ...brandTokens.look, primary: {...} } }`).
- D4 (S-7): `Input`, `TextArea`, `Select` and `Checkbox` take `styles` with parts `label`, `error` and `field` (the wrapper), collected as k.aria part styles (E1823); style props stay on the control.
- D5 (S-8): the no-script 422 summary names each field by the text of its rendered `<label for>`, links it (`<a href="#<field id>">`), and carries the `summary` role, so `base.summary` styles it.
- D6 (S-4): `gap` on an element whose rules set no `direction` stacks its children as a column. The stack is written at zero specificity (`:where(.k-gap-…)`), so any `direction` at any breakpoint wins.
- D7 (S-5, S-6, built): an element with `hidden` is not displayed whatever its style props; `w` and `h` size the border box.
- D8 (S-10): the compiled stylesheet always sets `overflow-wrap: anywhere` on `body`, so an unbroken string wraps inside its container.
- D9: no new codes. k.ui and k.a11y go from `conformance-covered` to `implemented` until the new clauses are covered. Nothing becomes `frozen`.

## Problem
An app on `brandTokens` loads the brand's custom properties and fonts, and no rule uses them: `body` keeps Times, controls their platform look, links the platform blue, focus the platform's rounded ring beside zero-radius borders (S-2, S-9). The household app sets `font`, `fg`, `bg` and twelve props per text control at every use, since a spread is not collected and only a wrapper component reuses a set (S-11). A control's `<label>` and field error take no style, so an error prints in the body colour (S-7). The no-script 422 summary is bare bullets naming the schema path (`amount`) where the page says `Amount` (S-8). `<Box gap="3">` writes `gap` and no `display`, so on a block `div` it spaces nothing, and the `keel` skill's example used it that way (S-4). A 90-character token widened a 390px page by 380px (S-10). k.ui names no stylesheet beyond the atomic rules; k.a11y says the platform's focus indicator stays.

ADR-0067 rejected "a brand base stylesheet from `brandTokens`" as a second styling path beside `keel.css`, wrong for apps with their own tokens. This RFC keeps one path: the base is a token group compiled into the same file, empty unless the tokens declare it.

## Proposal

### The stylesheet (`compileStyles`)
In order:
1. `:root` custom properties and their scheme and motion overrides, as now.
2. `@layer keel.base { … }`: the fixed rules, then each `base` role's rules. A look is atomic classes at its use (D3), not a layer rule.
   - Fixed, always: `[hidden]{display:none!important}`; `body{overflow-wrap:anywhere}`; `.k-summary ul{list-style:none;margin:0;padding:0}`.
   - `base.page` on `body`; `heading` on `.k-heading`; `link` on `.k-link`; `button` on `.k-button`; `control` on `.k-control` (Input, TextArea, Select); `label` on `.k-label`; `fieldError` on `.k-error`; `summary` on `.k-summary`. Each set's `states` compile as an atomic rule's states do, under the role selector (`.k-control:hover`).
   - `base.focus`: `:focus-visible{outline:2px solid var(--k-color-<focus>);outline-offset:2px}`.
3. The atomic rules, unlayered, as now. An unlayered rule beats every layered one, so any style prop at a use wins over the base.

Base elements carry their role class whatever the tokens: `Heading` `k-heading`, `Link` `k-link`, `Button` `k-button`, `Input`, `TextArea` and `Select` `k-control`, a control's `<label>` `k-label`, its error element `k-error`.

### brandTokens
```ts
base: {
  page: { font: 'serif', fontSize: 'md', fg: 'text', bg: 'surface' },
  heading: { font: 'serif', weight: 'semibold', fg: 'text' },
  link: { fg: 'text', states: { hover: { fg: 'textSecondary' } } },
  button: { font: 'mono', fontSize: 'sm', weight: 'medium', px: '4', py: '2', bg: 'text', fg: 'card', border: 'rule', radius: 'none' },
  control: { font: 'mono', fontSize: 'sm', w: 'full', px: '2', py: '2', bg: 'card', fg: 'text', border: 'control', radius: 'none', states: { hover: { border: 'rule' } } },
  label: { font: 'mono', fontSize: 'sm', fg: 'text' },
  fieldError: { font: 'mono', fontSize: 'sm', fg: 'error' },
  summary: { p: '3', bg: 'card', fg: 'error', border: 'error', font: 'mono', fontSize: 'sm' },
  focus: 'text',
},
look: {
  control: { /* as base.control */ },
  primary: { /* as base.button */ },
  secondary: { font: 'mono', fontSize: 'sm', px: '3', py: '2', bg: 'card', fg: 'text', border: 'rule', radius: 'none', states: { hover: { bg: 'surfaceLow' } } },
},
```
The household app's eleven text controls then take no style props, its primary buttons none, its secondary buttons `look="secondary"`.

## Alternatives
- **A brand stylesheet the server writes from `brandTokens`** (ADR-0067's rejected option). Rejected again: a second path, and fixed to one token set.
- **`gap` without `direction` is a check error** (S-4). Workable, but a responsive `direction` and `gap` keyed by different breakpoints make the static rule a per-breakpoint walk, and the author's intent in every observed case (the skill's list, each household page) was a column. The operator picks between D6 and this.
- **Named sets as exported objects** (`export const primary = look({...})` in a `*.look.ts`, `look={primary}`). Rejected: a second declaration place beside `tokens.ts`, and an app could not restyle a library component's look through its tokens.
- **Allow a spread of a shared object in style props.** Rejected: k.ui reads literals so the class list and the CSS are known at build.
- **Keep the platform focus ring.** Rejected for apps with a `base`: the brand's square geometry and the operator's standard that every Keel app matches the guide. An app without `base.focus` keeps the platform's ring.

## Spec diff
Not applied; applied when the operator accepts.
- **k.ui Tokens**: "Groups are closed: … `breakpoint`, `motion`, `base`, `look`. `base` holds optional style sets `page`, `heading`, `link`, `button`, `control`, `label`, `fieldError`, `summary` (style props with `states`, token names checked as at a use, E1801) and `focus`, a color token. `look` maps a name to such a set; a look names no look."
- **k.ui Style props**, appended: "`direction`, `align`, `justify` and `wrap` make the element flex; `gap` on an element whose rules set no `direction` stacks its children in a column, and any `direction` wins. `w` and `h` size the border box. `hidden` hides an element whatever its style props. `look="<name>"` on a base element or `Part`, or in a part style, applies that `look` set's classes; the element's own props replace the set's per prop and state; a missing look is E1801."
- **k.ui** new paragraph **Base**: "The compiled CSS file holds, after the custom properties, a `keel.base` cascade layer: `[hidden]` hidden, `body` with `overflow-wrap: anywhere`, the summary's list unmarked, then each `base` set on its role (`body`; `Heading`, `Link`, `Button`; `Input`, `TextArea`, `Select`; a control's label and error; the no-script summary), and with `base.focus` a 2px solid outline in that color at 2px offset on `:focus-visible`. Atomic rules are unlayered, so a style prop wins over the base. Base elements carry their role class (`k-heading`, `k-link`, `k-button`, `k-control`, `k-label`, `k-error`)."
- **k.ui Base elements**: "`Input`, `TextArea`, `Select` and `Checkbox` take `styles` with parts `field`, `label` and `error` (k.aria Part styles)."
- **k.a11y Order and focus**: "… so sequential focus order is document order and no app style removes the focus indicator: the platform's, or with `base.focus` (k.ui) a 2px outline. A `base.focus` color under 3:1 against `base.page`'s `bg` is E1807." **Contrast**: "the background is the nearest painted ancestor's `bg`, else `base.page`'s, else `#FFFFFF`; text without `fg` takes its role's `base` `fg`, else `base.page`'s, else `#000000`."
- **k.forms** no-JS paragraph: "The 422 page carries a summary before the page, `role="alert"` with class `k-summary`: one item per error, a link to the field's control named by its `<label>` text (else the path), then the message."
- **GLOSSARY**: **base**: the `tokens.ts` style sets the compiled stylesheet applies to each element role. **look**: a named style set in `tokens.ts`, applied with `look`.
- **BRAND.md** §4: "Focus: a 2px solid Charcoal outline, offset 2px, square, on keyboard focus."
- **Map**: k.ui and k.a11y read `implemented`.

## Conformance diff
By the `conformance-writer`, under `rfc:0188`, from the spec text alone:
- k.ui 16 (built, D7): a `Part` with `hidden` and `direction="column"` is not displayed: the CSS holds `[hidden]{display:none!important}` before the atomic rules.
- k.ui 17 (built, D7): an `Input` with `w="full" px="2" border="control"` in a 320px container is 320px wide in Chromium; the `w` rule declares `box-sizing:border-box`.
- k.ui 18: `<Box gap="2">` with two children lays them out in a column; with `direction={{ base: 'column', md: 'row' }}` a row at 1024px.
- k.ui 19: tokens with `base.page { fg: 'fg', bg: 'bg' }` and no style props on the page: `body`'s computed color and background are the tokens'; a `fg` at a use wins.
- k.ui 20: `<Button look="primary" px="1">` has the look's classes for every prop but `px`, and `k-px-1`; `look="nope"` is E1801.
- k.ui 21: `styles={{ label: { fg: 'accent' }, error: { fg: 'error' } }}` on an `Input` with a `field` puts those classes on the `<label>` and the error element.
- k.ui 22: a 200-character unbroken string in a 320px `Box` keeps the document 320px wide.
- k.a11y 13: with `base.focus: 'fg'`, a focused `Input` reached by Tab has a 2px solid outline in `fg`; a focus color at 2:1 against the page `bg` is E1807.
- k.forms 17: a no-script post that fails `amount` (label `Amount`) answers 422 with a `.k-summary` item `Amount: <message>` linking `#<field id>`.
Spec topics: `pnpm spec k.ui`, `pnpm spec k.a11y`, `pnpm spec k.forms`; for context `pnpm spec k.aria`.

## Build
- `@keel/ui`: `TokenSchema` groups `base` and `look`; `compileStyles` writes the `keel.base` layer; role classes on the base elements; `styles` parts on the controls; `brandTokens` `base` and `look`.
- `@keel/compiler`: collect `look` (literal, or in a part style) and expand it per prop; `gap` rules gain the `:where()` column default.
- `@keel/check`: E1801 for a missing look; E1807 for a low-contrast `focus`; E1804 reads the base `fg` and `bg`.
- `@keel/server`: the summary's label, link and class (`fieldSummary.ts`).
- `apps/household`: drop the per-use control and button props for the base and looks; `TokenPanel.tsx` renders the minted token as one string.
- Docs: the `keel-client` skill (base, looks, control parts), `BRAND.md` focus line.

## Known limits
- The base styles only Keel's own elements and `body`; markup from a `Host` is the host code's.
- A look is one level: a look cannot extend another.

## Migration
None: unreleased.

## Token impact
k.ui 6,009 to about 8,200 characters; k.a11y 6,000 to about 6,250; k.forms about +200. The k.ui spec budget is re-based if it moves.

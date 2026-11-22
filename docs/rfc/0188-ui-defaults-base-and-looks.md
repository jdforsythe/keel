# RFC 0188: k.ui defaults: a base from the tokens, named looks, a `gap` that names its axis, a brand focus ring

Status: accepted (ADR-0209; operator, 2026-11-22, all decisions, D6 as a check error). From walkthrough findings S-2, S-4, S-7 to S-11 (`tasks/p1/walkthrough-findings.md`): an app author styling `apps/household` to `docs/BRAND.md`. S-5 and S-6 are built in `@keel/ui` beside this RFC; D7 states them in the spec.

## Decisions
- D1 (S-2): `tokens.ts` gains a closed `base` group: one style set per element role, which the compiled stylesheet applies to every element of that role with no app code. `brandTokens` carries the brand's `base`, so every app on `brandTokens` (the scaffold's default) renders on brand from its first page. An app with its own tokens and no `base` gets no role rules, as now.
- D2 (S-9): `base.focus` names a color token; every focusable element then shows a 2px solid outline in it at 2px offset on `:focus-visible` in place of the platform's ring. The style vocabulary still has no `outline`, so no app style removes it. A `focus` color under 3:1 against `base.page`'s `bg` is E1807. `BRAND.md` gains the focus rule: 2px Charcoal (`text`), offset 2px, square; Ochre stays reserved for status. Charcoal is 16.60:1 on `surface`, 15.75:1 on `surfaceLow` and 17.47:1 on `card`, so the ring meets WCAG 2.2 2.4.7, 1.4.11 and 2.4.13 (AAA). It makes no 2.4.11 claim: that criterion is about content covering the focused element, not the ring.
- D3 (S-11): `tokens.ts` gains a `look` group: named style sets, declared once. Every base element and `Part` takes `look="<name>"`; the compiler expands it to the set's classes, and the element's own style props replace the set's per prop. `brandTokens` carries `control`, `primary` and `secondary`. An app overrides a look, or the base, through its tokens (`{ ...brandTokens, look: { ...brandTokens.look, primary: {...} } }`).
- D4 (S-7): `Input`, `TextArea`, `Select` and `Checkbox` take `styles` with parts `label`, `error` and `field` (the wrapper), collected as k.aria part styles (E1823); style props stay on the control.
- D5 (S-8): the no-script 422 summary names each field by the text of its rendered `<label for>`, links it (`<a href="#<field id>">`), and carries the `summary` role, so `base.summary` styles it.
- D6 (S-4): `gap` with no `direction` at or below its smallest breakpoint, on an element, a look or a `base` set, is E1809 in `keel check`; a computed `direction` counts as set. The fix adds `direction="column"`, the intent in every observed case. Nothing is written for a lone `gap` at run time.
- D7 (S-5, S-6, built): an element with `hidden` is not displayed whatever its style props; `w` and `h` size the border box.
- D8 (S-10): the compiled stylesheet always sets `overflow-wrap: anywhere` on `body`, so an unbroken string wraps inside its container.
- D9: one new code, E1809 (D6). k.ui and k.forms go from `conformance-covered` to `implemented`, and k.a11y stays `implemented`, until the new clauses are covered. Nothing becomes `frozen`.

## E1809
- Message: `gap without direction: name the axis its children are spaced along`.
- Fix: `gap="2" -> direction="column" gap="2"`; for a responsive `gap`, the `direction` key moves to `gap`'s smallest breakpoint.
- Explain: `gap` spaces the children of a flex element only; on a block element it spaces nothing. Name the axis with `direction`: `column` stacks, `row` lines up.

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
- **`gap` without `direction` stacks as a column** (S-4), written at zero specificity (`:where(.k-gap-…)`) so any `direction` wins. Not chosen: a default axis hides the author's choice; the check error names it at the use.
- **Named sets as exported objects** (`export const primary = look({...})` in a `*.look.ts`, `look={primary}`). Rejected: a second declaration place beside `tokens.ts`, and an app could not restyle a library component's look through its tokens.
- **Allow a spread of a shared object in style props.** Rejected: k.ui reads literals so the class list and the CSS are known at build.
- **Keep the platform focus ring.** Rejected for apps with a `base`: the brand's square geometry and the operator's standard that every Keel app matches the guide. An app without `base.focus` keeps the platform's ring.
- **An Ochre ring.** Rejected: Ochre is reserved for conformance rungs, status badges and active diagnostics.

## Spec diff
Applied in `spec/`:
- **k.ui** Tokens: groups `base` and `look`. Base elements: `styles` parts `field`, `label`, `error` on the controls; `look` read at build. Style props: flex props, `gap` needs a `direction` (E1809), `w` and `h` size the border box, `hidden`, `look`. New paragraph **Base**: the `keel.base` layer and the role classes. Rules: E1809. Conformance 17 to 23.
- **k.a11y** Order and focus: the `base.focus` ring, its E1807 threshold, the criteria it meets and `brandTokens`' figures. Contrast: render reads `base.page` and role `fg`. Conformance 15.
- **k.forms** no-JS paragraph: the `.k-summary` with label-named links. Conformance 17.
- **GLOSSARY**: **base**, **look**.
- **Map**: k.ui and k.forms read `implemented`.
- **BRAND.md** §4: the focus ring, and a section on `base` and `look`. **A11Y-TARGET.md**: the brand ring replaces the platform indicator.

## Conformance diff
By the `conformance-writer`, under `rfc:0188`, from the spec text alone:
- k.ui 17 (built, D7): a `Part` with `hidden` and `direction="column"` is not displayed.
- k.ui 18 (built, D7): an `Input` with `w="full"` in a 320px container is 320px wide; the `w` rule declares `box-sizing:border-box`.
- k.ui 19: `<Box gap="2">` with no `direction` is E1809 and its fix adds `direction="column"`; with a `direction` at `base`, or a look that sets one, it is clean; `gap` at `base` with `direction` only at `md` is E1809.
- k.ui 20: tokens with `base.page { fg, bg }` give `body` those colors; a `fg` at a use wins.
- k.ui 21: `<Button look="primary" px="1">` has the look's classes for every prop but `px`; `look="nope"` is E1801.
- k.ui 22: `styles` `label` and `error` on an `Input` with a `field` land on its `<label>` and error element.
- k.ui 23: a 200-character unbroken string in a 320px `Box` keeps the document 320px wide.
- k.a11y 15: with `base.focus: 'fg'`, a `Button` reached by Tab has a 2px solid outline in `fg` and one clicked has none; a focus color at 2:1 against the page `bg` is E1807; `brandTokens` passes.
- k.forms 17: a no-script post that fails `amount` (label `Amount`) answers 422 with a `.k-summary` item `Amount: <message>` linking `#<field id>`.
Spec topics: `pnpm spec k.ui`, `pnpm spec k.a11y`, `pnpm spec k.forms`; for context `pnpm spec k.aria`.

## Build
- `@keel/ui`: `TokenSchema` groups `base` and `look`; `compileStyles` writes the `keel.base` layer; role classes on the base elements; `styles` parts on the controls; `brandTokens` `base` and `look`.
- `@keel/compiler`: collect `look` (literal, or in a part style) and expand it per prop.
- `@keel/check`: E1801 for a missing look; E1807 for a low-contrast `focus`; E1804 reads the base `fg` and `bg`; E1809 with its explain entry, over elements, looks and `base` sets.
- `@keel/server`: the summary's label, link and class (`fieldSummary.ts`).
- `apps/household`: drop the per-use control and button props for the base and looks; `TokenPanel.tsx` renders the minted token as one string.
- Docs: the `keel-client` skill (base, looks, control parts, E1809).

## Known limits
- The base styles only Keel's own elements and `body`; markup from a `Host` is the host code's.
- A look is one level: a look cannot extend another.

## Migration
None: unreleased.

## Token impact
k.ui 6,479 to 9,430 characters, k.a11y 7,315 to 8,209, k.forms 5,591 to 5,990; each under the 12,400-character section budget.

# RFC 0243: a library ships its look; color schemes; the Part roles a component library needs

Status: implemented (ADR-0265), accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Adds k.looks and k.schemes; amends k.roles (Roles, Attributes, Keys, Conformance), k.ui (Tokens, Base elements), the map, the glossary. From the L1 end-user review (`tasks/p1/end-user-review.md`), D187 (c) and D188.

Personas: L1 the component library author, L2 the visual library author, A5 the designer; app kinds K1 to K9 alike, since every app renders a library's components the same way.

## Decisions
- D1 (D188): a library ships tokens from its `./tokens` entry, `src/<id>Tokens.ts`, exporting `<id>Tokens`, one `defineTokens` literal. The app spreads it into its own `tokens.ts`, group by group, as it spreads `brandTokens`; nothing applies without that import.
- D2: names are `<id>.<name>`, `<id>` the library's module id (E1166 keeps ids distinct). `brandTokens` names stay unprefixed: a name with no `.` belongs to the app, and `brandTokens` is the app's starting set, written into its `tokens.ts` by the scaffold.
- D3: a library's needs are derived: they are exactly the names its shipped object holds. A library file writes only names its object holds (E1811), so the derived list is exact and there is no list to write in the manifest.
- D4: the app's `keel check` reports a library whose needs its tokens miss as one E1810 at `tokens.ts`, with a fix that writes the import and the spreads; an override key naming no shipped token is E1813.
- D5: the shipped file is read as text, never run by check; E1812 holds it to one literal. `keel pack` verifies it through its `check` step; k.library-pack's existing entry and `files` rules cover the entry.
- D6: a library's own folder is judged against its defaults: its root `tokens.ts` must compose the shipped object (E1810) and may not override it (E1813).
- D7: schemes are `light` and `dark`. `tokens.ts` gains `schemes`. With no `schemes`, an app has both only when one of its own colors is a pair, so a library's pairs never turn an app half dark. Both schemes give the preference media query, an explicit choice through `data-k-scheme` on `<html>`, and `color-scheme`.
- D8: `SchemeSelect` (`@keel/ui`) is the one control for the choice; it writes the `keel-scheme` cookie. A `node` document renders the choice on first paint; a `client` or `static` document loads a 300-byte classic script before its stylesheet. An app that renders no `SchemeSelect` carries no scheme bytes.
- D9: this RFC adds the Part roles `switch`, `toolbar`, `menubar`, `menuitemradio`, `meter`, `progressbar`, `region`, `pressed` and `describedBy` on `button`, and `hasPopup` and `expanded` on `menuitem`. Tooltip, treegrid, feed, window splitter, carousel and a breadcrumb's current link go to one follow-on RFC (Deferred).
- D10 (review): a token value is admitted only in its group's positive form (k.values). Colors are `#rgb` or `#rrggbb`, the forms contrast can judge. `url(...)`, a `var(...)` of anything but a held color token, `!important`, backslashes and stray quotes are refused. The same `TokenSchema` judges the app's tokens (E1807) and a library's shipped object (E1812). The invariant: Chromium keeps every emitted rule.
- D11 (review): an `exports` entry holding `keel` holds it first and at the top level, judged at the app (E1815) for every entry, before `tokens.ts` is evaluated. So the file check reads as source is the file the bundler resolves. `keel pack`'s E1164 cases stay; the app no longer depends on them.
- D12 (review): a library's own folder judges every scheme its shipped colors are written for. In an app, contrast found in a library's files or looks is reported in `tokens.ts`, where the app can override, once per pair and scheme.
- D13 (review): one `states` list, with selectors, in k.aria. `pressed` and `current` are new; `disabled` also matches `[aria-disabled="true"]`; `checked` covers `switch` and `menuitemradio`.
- D14 (review): every `client` and `static` deployable in an app with both schemes gets the scheme script (152 bytes as built), since a text match cannot see every `SchemeSelect`. E1814 judges by the type pass, in app and library files. With no script, `SchemeSelect` stays `hidden` and the system preference applies.
- D15 (review): the shipped literal takes no `as const` or `satisfies` (E1812 `a type assertion`); `defineTokens` already keeps the literal types. E1810's fix moves no comment.
- D16 (second review): k.values is a grammar where a tokenizer reads exactly the tokens the form names. Only named ASCII appears outside quotes. Quoted strings hold no backslash, control character (U+0000 to U+001F, U+007F to U+009F) or lone surrogate. Literal numbers carry no sign, except a shadow's offsets and spread.
- D17 (second review): the grammar is widened so design systems fit:
  - Math functions: `calc`, `min`, `max`, `clamp`, nesting at most four deep and at most 32 names, with type rules on `*` and `/`.
  - `env(safe-area-inset-*)`, and every unit current browsers ship.
  - Quoted families with commas; `currentColor` in `border` and `shadow`.
  - What takes no effect is refused: negative literals where the property drops them, `none` and `%` widths, CSS-wide keywords, unquoted families that are not identifiers. A `space` token holding `auto` is E1801 on padding and `gap`.
  - Contrast takes a `fontSize` at its smallest (a `clamp()` at its first argument), else as normal text.
  - The Chromium cases are generated from the grammar and assert the computed value, not only that the rule is present.
- D18 (second review): k.entries holds a library's `exports` to one positive shape: an object of objects, `keel` first, a string naming a file under `src/` or `unsafe/`. Arrays, strings, `null`, a nested or non-string `keel`, and a `*` key that matches an imported subpath are each E1815. It is judged from text before anything is evaluated or bundled.
- D19 (second review): a library's shipped tokens file is never evaluated. `tokens.ts`'s evaluation takes `<name>/tokens` as a module made from the literal's data. The cost: a shipped file cannot compute values, which E1812 already forbids, plus one oxc parse per library at check.
- D20 (second review): library contrast moves to k.a11y-static Library contrast; a look is found by the `look` group's keys alone; one finding per pair and scheme.
- D21 (second review): E1810's fix inserts after the last import statement's line, or after a comment that begins on that line and ends later.
- D22 (second review): in a roving group a disabled `button` or `switch` with `tabIndex` writes `aria-disabled` and stays focusable; arrows follow the group's computed `direction`.
- D23 (second review): no part of the value forms ships in a client bundle; a test greps the client JavaScript.
- Codes: E1810 to E1815 (E1815 widened). ADR-0265.

## Problem
- A library cannot ship a look. The keel-library skill says "a library names no token": it draws in `currentColor` and takes a `styles` prop the app fills. In the L1 run a library wrote `radius="full"`. Its own check, test and pack passed, and so did the app's check. The app's `keel build` then failed with an E1801 that named no file. RFC 0241 moves E1801 into `keel check` for app code and reads a library's files against the app's tokens. That still leaves the library with no way to say which names it needs, or to give them default values.
- `defineTokens` (`packages/ui/src/defineTokens.ts`) validates against `TokenSchema` and returns the object. `brandTokens` is one such literal. An app composes it by spreading (`apps/household/tokens.ts`). `checkTokens` (`packages/cli/src/internal/checkTokens.ts`) evaluates the project's `tokens.ts` and hands the tokens to E1804, E1809 and E1801. A library's root `tokens.ts` is a check fixture that is never published (k.library-pack).
- Token names are bare (`accent`, `2`), so two libraries naming `accent` would collide in the app and an override would not show whose token it changes. `TokenName` already admits `acme.accent`. `varName` hashes a name with a `.` (`--k-color-acme_accent_<hash>`), so a `border` value cannot name it.
- Dark mode is half there. A color may be `{ light, dark }`, and `compileStyles` emits the dark values under `@media (prefers-color-scheme: dark)` (`packages/ui/src/css/compileStyles.ts` `rootBlocks`), with contrast judged in both schemes. Four pieces are missing: an explicit choice, `color-scheme` (native controls stay light), a first paint without a flash, and a way to declare which schemes an app has. Today any pair turns the dark scheme on. A library shipping pairs would therefore turn on half a dark page in an app whose own colors are light only. The strict CSP rules out the usual inline pre-paint script (k.security: no inline script; `script-src 'self'` on `client` and `static`).
- k.aria and k.roles have no `switch`, no toggle button, no toolbar, menu bar, radio menu item, meter, progress bar or named region. A component library meets those patterns first.

## Proposal

### Library tokens (k.looks)
The entry and the file:

```json
{
  "name": "@acme/ui",
  "version": "0.1.0",
  "type": "module",
  "keel": "library",
  "exports": {
    ".": { "keel": "./src/index.ts", "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" },
    "./tokens": { "keel": "./src/acmeTokens.ts", "types": "./dist/src/acmeTokens.d.ts", "default": "./dist/src/acmeTokens.js" }
  },
  "files": ["module.ts", "src", "dist", ".keel/ledger.json", "README.md"]
}
```

```ts
// src/acmeTokens.ts (module id `acme`)
import { defineTokens } from "@keel/ui";

export const acmeTokens = defineTokens({
  color: {
    "acme.surface": { light: "#FFFFFF", dark: "#1C1B20" },
    "acme.text": { light: "#1A191E", dark: "#F3F3F3" },
    "acme.accent": { light: "#0B5CAD", dark: "#8AB8F0" },
    "acme.onAccent": { light: "#FFFFFF", dark: "#0B1A2B" },
    "acme.track": { light: "#6B6B74", dark: "#A1A1AA" },
    "acme.knob": { light: "#FFFFFF", dark: "#1C1B20" },
  },
  space: { "acme.1": "4px", "acme.2": "8px", "acme.3": "16px" },
  size: { "acme.trackW": "36px", "acme.knob": "16px" },
  radius: { "acme.card": "4px", "acme.round": "999px" },
  fontSize: { "acme.badge": "12px" },
  border: { "acme.card": "1px solid var(--k-color-acme-track)" },
  look: {
    "acme.card": { direction: "column", gap: "acme.2", p: "acme.3", bg: "acme.surface", fg: "acme.text", radius: "acme.card", border: "acme.card" },
    "acme.badge": { px: "acme.2", py: "acme.1", radius: "acme.round", bg: "acme.accent", fg: "acme.onAccent", fontSize: "acme.badge" },
    "acme.switch": { direction: "row", align: "center", w: "acme.trackW", p: "acme.1", radius: "acme.round", bg: "acme.track", states: { checked: { bg: "acme.accent", justify: "end" } } },
    "acme.knob": { w: "acme.knob", h: "acme.knob", radius: "acme.round", bg: "acme.knob" },
  },
});
```

The badge measures 6.67:1 in light and 8.5:1 in dark. The card's text measures above 15:1 in both.

Three components, each writing only `acme.` names:

```tsx
// src/Card.tsx
import { type Infer, s } from "@keel/schema";
import { Box, type Child, Heading } from "@keel/ui";

export const Props = s.object({ id: s.string(), title: s.string({ min: 1 }) });

export default function Card(props: Infer<typeof Props> & { readonly children: () => Child }) {
  return (
    <Box id={`${props.id}.card`} as="section" look="acme.card">
      <Heading id={`${props.id}.title`} level={2} fg="acme.text">{props.title}</Heading>
      <Box id={`${props.id}.body`} children={props.children} />
    </Box>
  );
}
```

```tsx
// src/Badge.tsx
import { type Infer, s } from "@keel/schema";
import { Text } from "@keel/ui";

export const Props = s.object({ id: s.string(), text: s.string({ min: 1 }) });

export default function Badge(props: Infer<typeof Props>) {
  return <Text id={`${props.id}.text`} as="span" look="acme.badge">{props.text}</Text>;
}
```

```tsx
// src/Switch.tsx
import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";
import { Part } from "@keel/ui/aria";

export const Props = s.object({ id: s.string(), label: s.string({ min: 1 }) });

export default function Switch(
  props: Infer<typeof Props> & { readonly on: () => boolean; readonly onToggle: () => void },
) {
  return (
    <Part
      id={`${props.id}.switch`}
      role="switch"
      label={props.label}
      checked={props.on()}
      onClick={props.onToggle}
      look="acme.switch"
      children={() => <Box id={`${props.id}.knob`} look="acme.knob" />}
    />
  );
}
```

The card's `Heading` names `fg="acme.text"`, because `base.heading` sets the app's `text`, and in an app with both schemes the brand's charcoal would sit on the card's dark surface. E1804 shows that pairing in the dark scheme.

The library's own fixture, the root `tokens.ts`, composes the shipped object as an app would, with no override (E1813):

```ts
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { acmeTokens } from "./src/acmeTokens.ts";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...acmeTokens.color },
  space: { ...brandTokens.space, ...acmeTokens.space },
  size: { ...brandTokens.size, ...acmeTokens.size },
  radius: { ...brandTokens.radius, ...acmeTokens.radius },
  fontSize: { ...brandTokens.fontSize, ...acmeTokens.fontSize },
  border: { ...brandTokens.border, ...acmeTokens.border },
  look: { ...brandTokens.look, ...acmeTokens.look },
});
```

`keel check` and `keel test` in the library's folder then judge contrast, focus and names against its defaults. A look that fails is reported at its key in `src/acmeTokens.ts`.

### The app composes it
`modules/shop/module.ts` lists `'@acme/ui'`. Its `tokens.ts` is the scaffold's, `export const tokens = brandTokens;`. `keel check` reports:

```
E1810 tokens.ts:3:14 @acme/ui needs color "acme.surface" and 18 more; import acmeTokens from @acme/ui/tokens
```

Its fix writes the file below without the two overrides. The designer then adds two overrides: the brand's ochre as the accent, and square cards.

```ts
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { acmeTokens } from "@acme/ui/tokens";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...acmeTokens.color, "acme.accent": "#b8420d" },
  space: { ...brandTokens.space, ...acmeTokens.space },
  size: { ...brandTokens.size, ...acmeTokens.size },
  radius: { ...brandTokens.radius, ...acmeTokens.radius, "acme.card": "0" },
  fontSize: { ...brandTokens.fontSize, ...acmeTokens.fontSize },
  border: { ...brandTokens.border, ...acmeTokens.border },
  look: { ...brandTokens.look, ...acmeTokens.look },
});
```

The app's own colors are plain strings, so its schemes are `['light']` and acme's dark values are unused. The badge is white on `#b8420d` at 5.5:1. The errors an app sees:

```
E1810 tokens.ts:5:14 @acme/ui needs size "acme.trackW" and 1 more; spread acmeTokens.size
E1813 tokens.ts:7:61 color "acme.acent": @acme/ui ships no such token
E1813 tokens.ts:7:61 color "zed.x": no library the app lists has id zed
E1804 node_modules/@acme/ui/src/Badge.tsx:7:10 fg "acme.onAccent" on bg "acme.accent" is 3.18:1 in light, needs 4.5:1
```

The first comes from a dropped `size` line, the second and third from mistyped override keys, and the fourth from an override that fails contrast (`"acme.accent": "#D88A5A"`). While E1810 stands, the library's own files report no E1801: one line at `tokens.ts` carries the fix.

### Color schemes (k.schemes)
An app that wants dark mode writes pairs for its own colors, or `schemes: ['light', 'dark']`, and renders the control where its settings live:

```tsx
<SchemeSelect id="settings.scheme" label={m.scheme} labels={{ system: m.system, light: m.light, dark: m.dark }} />
```

The CSS has the light values on `:root`. The dark values sit under the media query on `:root:not([data-k-scheme="light"])` and again on `:root[data-k-scheme="dark"]`, with `color-scheme` in each. A `node` deployable reads `keel-scheme` and writes the attribute into the document, so the first paint is right. A `static` or `client` deployable has no server to read the cookie, and the CSP forbids inline script. It therefore loads one external classic script of at most 300 bytes in the head, before the stylesheet; `script-src 'self'` allows it. Contrast and the focus ring are judged in each declared scheme.

### Part roles (k.roles)
ARIA's authoring practices, pattern by pattern, against k.aria and k.roles:

| Pattern | Roles it needs | In Keel |
| --- | --- | --- |
| Accordion | `button` with `expanded`, `controls`; `region` | `region` added |
| Alert, Alert dialog, Dialog | `alert`, `alertdialog`, `dialog` | yes |
| Breadcrumb | `navigation`, a list, `aria-current` on a link | `Link` has no `current`: deferred |
| Button (toggle) | `button` with `aria-pressed` | `pressed` added |
| Carousel | `region` or `group` with `aria-roledescription`, tabs | deferred |
| Checkbox (and mixed) | `checkbox` | yes |
| Combobox, Listbox | `combobox`, `listbox`, `option` | yes |
| Disclosure | `button` with `expanded` | yes |
| Feed | `feed`, `article` | deferred |
| Grid, Table | `grid`, `table` and their parts | yes |
| Landmarks | `Box as` `nav`, `main`, `section`; `region` | `region` added |
| Link | `Link` | yes |
| Menu and menu bar | `menu`, `menubar`, `menuitem` (popup), `menuitemcheckbox`, `menuitemradio` | `menubar`, `menuitemradio`, `menuitem` `hasPopup` and `expanded` added |
| Meter | `meter` | added |
| Radio group | `radiogroup`, `radio` | yes |
| Slider (and two thumbs) | `slider` | yes |
| Spinbutton | `Input type="number"` | yes, as a control |
| Switch | `switch` | added |
| Tabs | `tablist`, `tab`, `tabpanel` | yes |
| Toolbar | `toolbar` | added |
| Tooltip | `tooltip`, `describedBy` on its trigger | `describedBy` on `button` added; `tooltip` deferred |
| Tree view | `tree`, `treeitem` | yes |
| Treegrid | `treegrid` with rows that expand | deferred |
| Window splitter | a focusable `separator` with a value | deferred |
| (not a pattern) progress | `progressbar` | added |

`switch` is a native `button` with `role="switch"` and `aria-checked`. Space and Enter come from the platform, and its children can be styled with tokens, which an `input type=checkbox` cannot. `meter` and `progressbar` are the native elements. Keyboard behaviour for `toolbar` and `menubar` stays the component's own through `onKey`, `focus` and `tabIndex`, as for every k.roles role. The Keys paragraph states the contract, and the component's tests prove it with `fire`.

## Alternatives
- **A `needs` list in the manifest.** A hand-written copy of the shipped object's keys can drift from it. Deriving the list is exact once E1811 holds the files to the object.
- **Unprefixed needs, names the app must define (`accent`, `2`).** That is today's fault: a library guessing the app's names. Prefixing costs the library its own spacing scale, and the app maps it in one line.
- **A nested group per library (`color: { acme: { accent } }`).** It changes `TokenSchema`'s value shape, the custom property names and every reader of a group; `acme.accent` is already a `TokenName`.
- **A `composeTokens(...)` helper.** D188 keeps spreading, the one way `brandTokens` is composed today. E1810's fix writes the spreads.
- **Running the shipped file at check.** That runs library code during `keel check`. Reading one literal as text runs none, and E1812 keeps it a literal.
- **A library may ship `base`.** That would restyle every button in the app from a package: action at a distance (principle 2).
- **Dark mode by pairs alone.** A library's pairs would turn the dark scheme on in a light app. `schemes`, implied only from the app's own colors, keeps today's behaviour for every pair an app writes.
- **The choice in `localStorage`, read by the entry.** The server cannot read it, and the module entry runs after first paint, so every page load flashes. A cookie serves both the server and the static head script.
- **An inline pre-paint script with a CSP hash.** It widens `script-src` on every deployable; one `'self'` file needs no change to the policy.
- **`ctx.scheme` for app code.** It is a second way beside the control and needs a capability. `SchemeSelect` covers the choice with words from the message set; a later RFC can add a programmatic switch if an app needs one.
- **`switch` as `input type=checkbox role=switch`.** Style props cannot draw a track and knob on a native checkbox; a button holds styled children.
- **All the missing roles in this RFC.** Tooltip needs pointer events on `Part` and WCAG 1.4.13's hover rules; treegrid, feed and splitter each need state and focus rules of their own. Together they would double this RFC.

## Spec diff
Applied in this commit.
- k.looks (new, `proposed`): Names, Shipped tokens, Needs, In an app, Fix, Own folder, Rules (E1810 to E1813), Conformance #1 to #11.
- k.schemes (new, `proposed`): Schemes, CSS, Choice, First paint, Checks, Rules (E1814), Conformance #1 to #10.
- From the second review: k.values is rewritten (Characters, Numbers and lengths, Colors, the table, What check judges, Stylesheet; Conformance #1 to #9). k.entries is new (`proposed`): Shape, Rules (E1815), Conformance #1 to #3, moved from k.looks Entries and widened. k.looks: Shipped tokens' no-evaluation sentence; Entries and Library contrast become pointers; Fix's comment sentence; Conformance #12 (E1815) and #13 (library contrast) move to k.entries #1 and k.a11y-static #11, so the `as const` case is now #12, the comment case #13 (re-worded), and #14 is new. k.a11y-static (to `implemented`): Library contrast, Conformance #11. k.roles: Keys' arrows by direction and disabled roving items; Conformance #15. Map: a k.entries row; `Invariants`, `Publishing`, `Escape review` and `Exploration` are shorter titles for the same sections.
- From the review: k.values (new, `proposed`) holds Forms, Stylesheet and Conformance #1 to #5. k.looks: Shipped tokens refuses `as` and `satisfies`; Entries (E1815) and Library contrast are new; Fix keeps comments; Rules gains E1815 and E1812's `a type assertion`; Conformance #12 to #15. k.schemes: own-folder schemes come from the shipped pairs; First paint ships the script with both schemes; `SchemeSelect` is `hidden` until script; E1814 is judged by symbol; #9 is re-worded (the script with both schemes, none with one); Conformance #11 to #13. k.aria (to `implemented`): Part styles holds the one `states` table; Conformance #11 to #13. Map: a k.values row, and four shorter titles (`Privacy reads`, `Test harness`, `Storage`, `Request leaves`) that point at the same sections, so the `keel docs` map stays within 1,690.
- Settled for the conformance-writer: E1810 to E1814 judge the evaluated tokens and read `tokens.ts`'s text only for positions and the fix; no tokens, no judgement. E1813 sits at the opening quote. A shipped `base` or `schemes` key gets its own E1812 message. The fix's layout is the formatter's (`biome format`). Clipping at 20 units keeps 17 units and `...`. k.looks #11 names the border's own property. The server reads `schemes.json` from its artifacts folder, beside `routes.json` and `std.json`. k.schemes #9 covers `client` deployables too. k.check's list of fixtures that carry a fix gains E1810; the code block's comment padding is trimmed so k.check stays within 3,100.
- Settled by the builder: a project with `tokens.ts` and no tokens still has E1811 and E1812 judged, since they read the library's own files and no tokens (k.looks In an app). A `client` deployable builds to `dist/<name>/` with or without `servedBy`, its one document `index.html` (k.schemes First paint).
- Settled by the builder after the review: `SchemeSelect`'s `hidden` sits on the wrapper it returns, holding its label and select (k.schemes Choice). A nested `keel` reads `<name> exports "<key>" nests keel under another condition` (k.looks Entries). A library pair whose `fg` and `bg` keys the app both writes is reported at the `fg` key (k.looks Library contrast). A type case in conformance is asserted by `tsc --noEmit`, the package's `check` script, not by `vitest run` (k.aria).
- Settled by the builder after the second review: a function name (`calc`, `min`, `max`, `clamp`, `env`, `var`) is not one of a value's 32 names, the names inside it are (k.values). A `*` key is E1815 only for an imported subpath no entry of its own names; an explicit entry, which Node prefers, is judged instead (k.entries).
- k.roles (to `implemented`): Roles gains seven rows and the `button` and `menuitem` props; Attributes gains their rows; Keys is new; Conformance gains #9 to #14. No existing clause changes.
- k.ui (to `implemented`): Tokens names `schemes` and library names and points color pairs to k.schemes; Base elements lists `SchemeSelect`. No conformance clause changes. The k.ui example's pairs are the app's own colors, so its "both schemes" clause holds.
- k.library (stays `proposed`): its printed fixture's library names no token, since a library cannot assume the app's space scale. #1's Badge renders ``<Box id={`${props.id}.box`} />``. #2 carries the library style into the app's CSS: the library ships `chartsTokens` (`space: { 'charts.2': '8px' }`) from `./tokens`, the app's `tokens.ts` is what E1810's fix writes over `brandTokens`, and the Badge's `Box` takes `p="charts.2"`. In #5, `<Box p="2" />` becomes `<Box />` and `Box({ p: '2' })` becomes `Box({})`. Kind no longer restates the manifest's fields, and the k.module rules no longer restate E1151; both are k.module's. The section stays within 3,100. No other section's printed fixture has a library write a token name.
- For a library installed from its tarball: k.looks Shipped tokens says `keel check`, `keel build`, `keel dev` and `keel test` evaluate `tokens.ts` the one way, the library linked or installed; k.looks Conformance #15 (the fixed project's `render` test passes under `keel test`, and `keel dev`'s stylesheet holds the shipped color) and k.library's last clause (`keel dev`'s entry imports a library's `./routes` from its `keel` target) are new. No existing clause changes.
- Map: rows k.looks and k.schemes; k.ui and k.roles read `implemented`. `tooling/docs-owners.json`: k.looks under `@keel/check`, k.schemes under `@keel/ui`.
- Glossary: **library tokens**, **color scheme**.
- This builds on RFC 0241 (`lane-r-household`): E1801 for token names in `keel check`, a library file read against the app's tokens. k.looks replaces E1801 with E1811 in a library file and with E1810 for a shipped name. It merges after 0241.

## Conformance diff
By the `conformance-writer`, from the spec text.
- From the second review:
  - `token-values.test.ts` covers k.values #1 to #6, re-quoted; #2 changed (`-2rem` is refused now) and #5 and #6 are new.
  - `token-values.browser.test.ts` covers #7 and #8, with cases generated from the grammar.
  - `packages/cli/conformance/client-bundle-values.test.ts` covers #9.
  - `packages/check/conformance/library-entries-e1815.test.ts` moves to k.entries #1 to #3; the evaluation cases use an `evil.js` that writes a marker file.
  - k.looks is renumbered: `as const` is #12, the comment case #13 (re-quoted for the block comment), and #14 (an import in the shipped file is not run) is new.
  - `packages/check/conformance/library-contrast.test.ts` covers k.a11y-static #11.
  - `packages/ui/conformance/roles-more.test.ts` gains k.roles #15.
- From the review: `packages/ui/conformance/token-values.test.ts` covers k.values #1 to #3 and #5, #5 as a strict structural read of the emitted CSS (the harness holds no CSS parser and no Chromium case); `packages/check/conformance/token-values-e1812.test.ts` covers #4. `packages/check/conformance/library-entries-e1815.test.ts` covers k.looks #12 and #13 to #15, and `packages/cli/conformance/library-entries-e1815-cli.test.ts` the `evil.js` half of #12 (a marker file under a temp folder, absent after `keel check`). `packages/ui/conformance/part-states.test.ts` covers k.aria #11 to #13. `packages/check/conformance/schemes-own-folder.test.ts` covers k.schemes #11 and #12. `packages/ui/conformance/scheme-select.test.ts` gains #13, and `scheme-static-script.test.ts` is re-quoted for #9. `fixtures-by-code.ts` gains E1815.
- `packages/check/conformance/library-looks-e1810.test.ts`: k.looks #1 to #6 (E1810 message, fix and its applied text, override CSS, E1813, the spread message, no `tokens.ts`), over the k.library fixture's file maps.
- `packages/check/conformance/library-looks-own-folder.test.ts`: k.looks #7 to #10 (E1811, E1812, E1804 at the shipped key, E1813 in the fixture and `keel pack`'s E1164); the pack half may sit in `packages/cli/conformance/`.
- `packages/ui/conformance/library-token-vars.test.ts`: k.looks #11.
- `packages/ui/conformance/schemes-css.test.ts`: k.schemes #1 to #4. `packages/check/conformance/schemes-contrast.test.ts`: #5 and #10. `packages/ui/conformance/scheme-select.test.ts`: #6 and #7. `packages/server/conformance/scheme-cookie.test.ts`: #8 (wherever `createApp`'s document conformance lives). `packages/cli/conformance/scheme-static-script.test.ts`: #9.
- `packages/ui/conformance/roles-more.test.ts`: k.roles #9 to #14.
- `fixtures-by-code.ts` and `fix-diffs.test.ts`: fixtures for E1810 (with its fix), E1811, E1812, E1813, E1814.
- Pinned to the changed k.library text: `packages/check/conformance/library-rules.test.ts:73`; in `packages/cli/conformance/`, `library-no-entry`, `library-deps`, `library-imports`, `library-tools-only`, `library-compile`, `library-dev` and `library-artifacts`, through `library-support.ts:50`; and `packages/check/conformance/fixtures-by-code.ts:434`. Each is re-quoted by the conformance-writer.
- Owed as end-to-end cases for RFC 0244's runner (a real browser over the built app), since happy-dom cannot show them:
  - Each accepted k.values case, set on an element through its group's property, reads back from `style` non-empty and computes to a value other than the initial one unless written as it (k.values #6; run in Chromium by `tooling/smoke/cssKept.mjs`).
  - The compiled CSS file from `brandTokens` and from tokens holding one value of each form in k.values, every group used by a style prop, parses in Chromium as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, and each rule holds every declaration it was emitted with (k.values #5).
  - A `node` page with both schemes and `keel-scheme=dark` paints dark from the first frame, and a `static` page with the same cookie paints dark before its body parses: no light frame, for both.
  - With no choice made, a page with both schemes follows the browser's `prefers-color-scheme` (emulated light and dark), and `color-scheme` darkens the native controls.
  - `data-k-scheme="light"` under an emulated dark preference keeps the light values.
  - On https, the cookie that `SchemeSelect` writes carries `Secure`.
  - Real Space and Enter on a focused `switch` and on a `button` with `pressed` each call `onClick` once.
  - With a real keyboard, each new role's keys as k.roles Keys gives them (`toolbar` and `menubar` arrows, Home and End, submenu open and close, `menuitemradio` checking), under `dir="rtl"` as well, where ArrowLeft and ArrowRight swap, and in a toolbar nested in a toolbar.
  - A `static` host serving `csp.txt` as its `Content-Security-Policy` header runs the scheme script and no other script.
  - Under `dir="rtl"`, ArrowLeft moves to the next `toolbar` item; a disabled item with `aria-disabled` is reached by the arrows and announced as dimmed by a screen reader.
  - Each generated k.values case is also run in Firefox and Safari, where the runner has them.
  - The wrong-scheme flash, measured on a live `node` server and on a real static host: no frame in the scheme the cookie does not name.

## Migration
None. No in-tree app, example or library writes a color pair or a dotted name, and no library writes a token literal in `src/` (`libraries/charts` uses `styles`). The scaffolds are unchanged.

## Token impact
- Spec: k.looks about 2,250 and k.schemes about 1,415 of 3,100; k.roles 1,218 to about 2,100; k.ui 2,855 to about 2,880, or about 2,960 with RFC 0241. The map grows by two rows and stays within `spec.map` 1,660. The `keel docs` map stays within `docs.map` 1,690: the new rows' titles are one word, and six kernel rows' titles are shorter (`Compatibility`, `Checker`, `Compiler`, `Durable storage`, `Deploy files`, `Server deps`), each pointing at the same section.
- `keel explain`: five entries, each under 300 tokens.
- `@keel/ui`: `SchemeSelect` and the scheme CSS; measure against its budget in the build. The static scheme script is at most 300 bytes, and only in deployables that render `SchemeSelect`.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the clauses above. 3. Build, by package:
- `@keel/ui`: `TokenSchema` gains `schemes`; `varName` gives `--k-<group>-<id>-<name>` for dotted alphanumeric parts; `compileStyles`'s `rootBlocks` emits k.schemes CSS from the app's schemes; `SchemeSelect` (an element on `Select`'s machinery; `labels`; the cookie and attribute writes in runtime-dom's commit); `PartProps` gains the seven roles and the `button` and `menuitem` props.
- `@keel/check`: `libraryTokens` (read `src/<id>Tokens.ts` as a literal; E1812), E1810 with its fix, E1811 in library files (beside RFC 0241's token-name reads, which it replaces there), E1813, E1814; `tokenSetAt` places a shipped look's finding in the shipped file and splits look names on the first `.` alone; `lowContrast` and `focusProblem` judge the declared schemes. `PIPELINE_CODES.ts`, `EXPLANATIONS.ts`.
- `@keel/cli`: `checkTokens` gives check the library's shipped literal beside the evaluated `tokens.ts`; `tokens.ts` evaluation resolves the `keel` condition; for `client` and `static` deployables that render `SchemeSelect`, the build writes `/assets/keel-scheme-<hash>.js` and the head tag (`hostBuild`, the `index.html` writer).
- `@keel/server` (wherever `createApp` writes `<html>`): read `keel-scheme` and write `data-k-scheme` for an app with both schemes.
- `@keel/compiler` `projectTokens`: carry `schemes` and the build's "renders `SchemeSelect`" flag to the server and the head.
- Docs: the keel-library skill's Colour paragraph (a library ships `<id>Tokens`; a card, a badge and a switch as above), the keel-client skill's Base and looks paragraph (`schemes`, `SchemeSelect`), `docs/BRAND.md` section 6 (`brandTokens` names are the app's own), `@keel/ui` and `@keel/check` READMEs, a changeset.
- A proof: a minimal library under `examples/` or `libraries/` shipping `<id>Tokens`, installed into one example app with two overrides (personas L1, A5).

## Fit with RFC 0249 and RFC 0251
- RFC 0249 (`lane-r-themes`) widens `<color>` to its six opaque forms and adds alpha in `shadow` and `overlay`. k.values here keeps `<color>` at hex and states "A `<color>` holds no alpha"; 0249 replaces that sentence and keeps the Characters, Numbers and Stylesheet paragraphs, which bind its color functions too (no escapes, no sign on a channel, generated Chromium cases).
- RFC 0251 (`lane-r-boundary`) makes `resolve(specifier, from, surface)` the one resolver. k.entries is the precondition it keeps true: with each entry an object with `keel` first and a file under `src/` or `unsafe/`, the `client` and `server` condition sets both answer the `keel` target, and E1815 is one of the shapes its E1174 refuses, with the clearer message. 0251's follow-on (a), `tokens.ts` read as data, is the general form of D19.

## Build plan from the second review
- `@keel/ui`: `valueForms.ts` becomes a tokenizer and a grammar per group: the math nesting and name bounds, `env()`, the unit list, the font rules and the signs. Its patterns are built inside functions with no top-level `RegExp` calls, and it is imported only by `TokenSchema` and `compileStyles`. A build check asserts the client chunk holds none of its strings. The `states` table moves to `@keel/ui/css`.
- `@keel/check`: E1815 over the whole `exports` shape, including `*` keys matched against the specifiers the project imports, judged before `checkTokens`. Library contrast is located by the `look` keys and deduplicated per pair and scheme. The fix's insertion point follows comments. A `p`, `px`, `py` or `gap` naming an `auto` space token is E1801. Font sizes for contrast are taken at their smallest.
- `@keel/cli`, `@keel/compiler` `projectTokens`: an esbuild plugin answers `<name>/tokens` (and `./src/<id>Tokens.ts` in the own folder) with a module generated from the literal oxc reads. E1812 and E1815 are judged first, and nothing is evaluated while either stands.
- `@keel/ui/aria` `Part`: a `button` or `switch` with `tabIndex` writes `aria-disabled` and drops `onClick` while disabled.

## Build plan from the review
- `@keel/ui`: a form parser per group in `TokenSchema` (`internal/valueForms.ts`), replacing `compileStyles`' deny-list `value` check, which then only asserts. `PartState` and `states.ts` gain `pressed` and `current`, and `disabled` gains `[aria-disabled="true"]`. `SchemeSelect` renders `hidden`, and runtime-dom clears it at mount and resume. One group order: `GROUP_ORDER` in `@keel/check` is replaced by `tokenGroups` from `@keel/ui`.
- `@keel/check`: E1815 over every listed library's `exports`, run before `checkTokens` evaluates `tokens.ts` (`@keel/cli` skips evaluation while one stands); library-file and library-look E1804 moved into `tokens.ts` with the new message, deduplicated; own-folder schemes from the shipped pairs; E1814 by symbol through the type pass, in library files too; E1812 `a type assertion`; E1810's fix inserts after the last import's line end.
- `@keel/cli`: the scheme script for every `client` and `static` deployable with both schemes; no `SchemeSelect` scan.

## Deferred
- One follow-on RFC, "Part roles II", before P1 ends: `tooltip` (needs `onPointerEnter`/`onPointerLeave` on `Part` and WCAG 1.4.13: dismissable, hoverable, persistent), `treegrid` (rows with `expanded` and `level` inside a grid), `feed` and `article` (`setSize`, `posInSet`, `busy`), a focusable `separator` for the window splitter (`valueNow`, `min`, `max`), carousel's `aria-roledescription`, and `current` on `Link` for a breadcrumb. Each needs focus or event rules this RFC does not settle.
- A scheme beyond light and dark (high contrast, `prefers-contrast: more`): the platform has no named third scheme to follow. `tasks/FUTURE.md`.
- An image per scheme (`<picture>` with a media source): `tasks/FUTURE.md`.

## For the operator
1. **A library writes only its own `acme.` names** (no unprefixed needs from the app). Recommended: keep; it is what makes needs exact. The cost is that a library ships its own spacing scale.
2. **`brandTokens` names stay unprefixed**, as the app's own. Recommended: keep; prefixing them would change every app's names and gain nothing, since no library may use an unprefixed name.
3. **Schemes implied from the app's own colors only.** Recommended: keep; a library cannot change an app's schemes.
4. **The choice is a cookie; static documents load a 300-byte script.** This is the one place the design touches the vision: a front end with no server gets dark mode with no flash and no inline script, and an app that offers no choice carries nothing. Recommended: keep.
5. **The brand has no dark palette** (`docs/BRAND.md`: light scheme only). The framework now supports one; whether the Keel brand gets one is the brand guide's call. Recommended: a brand task that adds a dark `brandTokens` scheme, so every new app can offer both.
6. **Roles split** (D9). Recommended: the follow-on RFC above, before P1 ends.
7. **The library scaffold writes no `src/<id>Tokens.ts`** (k.library-pack is at its limit). Recommended: add it in the next RFC that touches k.library-pack, so `keel scaffold library` starts with a look.

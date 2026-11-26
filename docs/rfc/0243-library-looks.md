# RFC 0243: a library ships its look; color schemes; the Part roles a component library needs

Status: accepted (ADR-0265), accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Adds k.looks and k.schemes; amends k.roles (Roles, Attributes, Keys, Conformance), k.ui (Tokens, Base elements), the map, the glossary. From the L1 end-user review (`tasks/p1/end-user-review.md`), D187 (c) and D188.

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
- Codes: E1810 to E1814. ADR-0265.

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
- k.roles (to `implemented`): Roles gains seven rows and the `button` and `menuitem` props; Attributes gains their rows; Keys is new; Conformance gains #9 to #14. No existing clause changes.
- k.ui (to `implemented`): Tokens names `schemes` and library names and points color pairs to k.schemes; Base elements lists `SchemeSelect`. No conformance clause changes. The k.ui example's pairs are the app's own colors, so its "both schemes" clause holds.
- Map: rows k.looks and k.schemes; k.ui and k.roles read `implemented`. `tooling/docs-owners.json`: k.looks under `@keel/check`, k.schemes under `@keel/ui`.
- Glossary: **library tokens**, **color scheme**.
- This builds on RFC 0241 (`lane-r-household`): E1801 for token names in `keel check`, a library file read against the app's tokens. k.looks replaces E1801 with E1811 in a library file and with E1810 for a shipped name. It merges after 0241.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/library-looks-e1810.test.ts`: k.looks #1 to #6 (E1810 message, fix and its applied text, override CSS, E1813, the spread message, no `tokens.ts`), over the k.library fixture's file maps.
- `packages/check/conformance/library-looks-own-folder.test.ts`: k.looks #7 to #10 (E1811, E1812, E1804 at the shipped key, E1813 in the fixture and `keel pack`'s E1164); the pack half may sit in `packages/cli/conformance/`.
- `packages/ui/conformance/library-token-vars.test.ts`: k.looks #11.
- `packages/ui/conformance/schemes-css.test.ts`: k.schemes #1 to #4. `packages/check/conformance/schemes-contrast.test.ts`: #5 and #10. `packages/ui/conformance/scheme-select.test.ts`: #6 and #7. `packages/server/conformance/scheme-cookie.test.ts`: #8 (wherever `createApp`'s document conformance lives). `packages/cli/conformance/scheme-static-script.test.ts`: #9.
- `packages/ui/conformance/roles-more.test.ts`: k.roles #9 to #14.
- `fixtures-by-code.ts` and `fix-diffs.test.ts`: fixtures for E1810 (with its fix), E1811, E1812, E1813, E1814.

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

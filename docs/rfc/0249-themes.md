# RFC 0249: themes, print, every opaque color form, and design tokens in

Status: implemented (ADR-0284), accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Builds on RFC 0243 (`lane-r-look`, in build). Amends k.schemes, k.values, k.a11y-static, k.aria, k.ui, k.looks, k.cli, the map and the glossary. From the plan's D200 (checkpoints 170 and 174).

Personas: A5 the designer first; A2 the product engineer; A1 with a static site; L1 and L2, whose shipped tokens meet an app's themes; A6, who answers for a11y per theme. App kinds K1 (a content site that prints), K2 (a storefront with a seasonal brand theme), K6 (a dashboard with a dark sidebar and overlays).

## Decisions
- D1 (D200): a theme is a named, partial set of token values with a condition, `when`: `choice` (a visitor picks it), `contrast` (`prefers-contrast: more`) or `print`. `tokens.ts` gains `themes`. A theme holds only names its top-level groups hold, so a theme re-values custom properties and never adds a class.
- D2: `schemes` stays, with its glossary term. Light and dark are an axis that crosses every theme, with a platform preference, `color-scheme` and the `{ light, dark }` pair; a theme's colors may be pairs too. So the model is two axes (scheme, chosen theme) and two condition layers (contrast, print), one mechanism: a layer of custom property blocks per theme over the RFC 0243 blocks.
- D3: the groups a theme may hold are `color`, `overlay`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border`. `breakpoint` stays out (a media query reads no custom property), `motion` stays out until RFC 0252, and `base` and `look` stay out (they choose classes).
- D4: combinations are bounded: at most 8 `choice` themes, one `contrast`, one `print`; at most 54 combinations, each judged. With the `contrast` theme on, text needs 7:1 (WCAG 1.4.6).
- D5: the CSS orders the layers with `@layer keel.tokens,keel.theme,keel.contrast,keel.print`, so a later layer wins whatever its selector. Dark blocks move under `@media screen`, so print always takes the light values. An app with no `themes` gets RFC 0243's CSS with `screen` added and nothing else.
- D6: switching is RFC 0243's mechanism widened: `data-k-theme` beside `data-k-scheme`, the `keel-theme` cookie beside `keel-scheme`, the same head script, and `ThemeSelect` beside `SchemeSelect`. App code reads and sets both through one capability, `appearance(ctx)`, which both controls call.
- D7: a subtree may fix its scheme (`Box scheme="dark"`), never its theme. The subtree blocks are emitted only once an element writes `scheme`.
- D8: print: a `print` theme; a `print` key for responsive style props; `media="screen"` and `media="print"`; `breakBefore`, `breakAfter`, `breakInside`. Keel declares `print-color-adjust:exact` with a `print` theme, so what prints is what was judged. No link-URL prop.
- D9: k.values' `<color>` widens to six opaque forms with exact luminance; Keel ships only colors inside the gamut of the screen that shows them, computes each and judges exactly what it ships: a color outside sRGB ships as a mapped sRGB form and, under `(color-gamut: p3)`, a display-p3 form mapped into P3, and check judges both (k.gamut). Alpha is an `overlay` token that names its backdrops; `shadow` takes alpha directly.
- D10: a library ships `themes.contrast` and `themes.print` only; E1810 makes the app spread them into its own theme of that `when`. A `choice` theme the library never heard of takes the library's top-level values, and the app re-values `<id>.` names in it.
- D11: `keel tokens import` reads DTCG files, one file per mode, and owns `tokens.design.ts` whole; `tokens.ts` spreads it and keeps the hand edits. `keel tokens set` is the one writer of a single value in `tokens.ts`; RFC 0253's design mode patches through it.
- D12: no new spec section: the `keel docs` map is at 1,689 of 1,690 tokens and `spec.map` at 1,644 of 1,660, and a section adds a line to each. The text sits in the sections that own each part.
- D13 (the director, D218): `defineTokens` and `TokenSchema`, with the value forms, the color syntax and the color maths they need, live in their own entry, `@keel/ui/tokens`, which `tokens.ts` imports; an app's `tokens.ts` runs at check and build time, and component code never validates tokens. `keel check` enforces it: a value import of `@keel/ui/tokens` or `@keel/ui/css` in code a client entry reaches is E1818 (k.check-time). `contrastTable` joins `@keel/ui/css`, the check and testing entry. The main `@keel/ui` entry holds what components import and re-exports none of them. Rejected: keep `defineTokens` in the main entry and re-base its budget, because every component import would then carry the grammar's weight in the entry's measure, and the entry would no longer say what a client needs.
- D14: what an app does not write costs it no bytes. The break props, `media` and `Box scheme` are guarded by `@keel/ui`'s `USES_BREAKS`, `USES_MEDIA` and `USES_SCHEME`, which a build with the Keel plugin serves as `false` when none of the app's style usages writes them, so the bundler drops their code; run from source (tests, `keel dev`) they are `true`. `mount` keeps its `artifacts` on its root; `SchemeSelect` and `ThemeSelect` record their document per ctx, and a client entry with `choice` themes records them, so an app with neither control and no theme carries no record.
- D15: the `tokens` tool took `mcp.tools-list` to 2,242 tokens of 2,150, the shared flags (`format`, `quiet`, `limit`, `verbose`) repeated in all 17 schemas. Each tool's `inputSchema` leaves them out and `initialize`'s `instructions` state them once (about 70 tokens); every tool still accepts them, and each command stays one tool. Rejected: fewer tools taking a command name, which hides each command's own schema from an agent reading the list; `$defs` and `$ref`, which do not reach across tools.
- D16: `brandTokens` is plain data typed `satisfies Tokens`, not a `defineTokens` call, so a client component may read a brand value from `@keel/ui/brand` without carrying `@keel/ui/tokens` (the grammar and color maths). Validation is not lost: every k.check run judges the `tokens.ts` that exports it with `TokenSchema` (E1807, k.a11y-static Tokens), and `packages/ui/test/brand.test.ts` parses it. A second entry with a validated copy beside plain values was rejected: two names for one object, and the validated one would add nothing an app's own check does not.
- Codes: E1816 (`ThemeSelect`), E1817 (overlay backdrop), E1818 (a check-time entry in client code), E1071 and W1072 (`keel tokens`); E1814 widens to `scheme`; E1807 names the key and the rule. ADR-0284.

## Problem
- `tokens.ts` compiles to custom properties on `:root`, and each style prop to one atomic class that reads one (`p="2"` puts `k-p-2` on the element; the stylesheet holds `.k-p-2{padding:var(--k-space-2)}`; `packages/ui/src/css/compileStyles.ts`, `rootBlocks` and `resolve`). A second set of values for the same properties under another selector is a theme, and switching it changes no class and re-renders nothing. Nothing in Keel uses that.
- RFC 0243 (in build on `lane-r-look`) gives `schemes` with exactly `light` and `dark`, a color as `{ light, dark }`, the system preference until `<html data-k-scheme>` overrides it, `SchemeSelect`, the `keel-scheme` cookie, a head script for `static` and `client` deployables, and contrast judged per scheme (`schemesOf`, `focusProblem`, `packages/check/src/internal/schemesIn.ts`, `lowContrast`, and the render check's `contrastViolations` loop over the two schemes). There is no theme beyond those two, no high-contrast theme, and no way for app code to read or set the pick.
- Nothing prints well. No style prop has a print condition, nothing hides navigation on paper, and no prop sets a page break. A dark-scheme visitor who prints gets the dark values on white paper.
- k.values admits colors as `#rgb` and `#rrggbb` only (`valueForms.ts`, `contrast.ts`). A designer's `oklch()` or `rgb()` is E1807, and a color with alpha cannot be written at all, so a modal scrim or a shadow tint has no token.
- A designer's tokens live in Figma variables or Tokens Studio. Both export the W3C Design Tokens Community Group format. Keel has no way in: every value is retyped into `tokens.ts`, and the next design change is retyped again.

## Proposal

### The `tokens.ts` shape
An app on the Keel brand with a dark scheme, a high-contrast theme, a second brand and a print theme. It type-checks against `defineTokens<const T extends Tokens>` once `Tokens` gains `themes` and `overlay`:

```ts
// tokens.ts
import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";

export const tokens = defineTokens({
  ...brandTokens,
  color: {
    ...brandTokens.color,
    surface: { light: "#F9F9F9", dark: "#141317" },
    surfaceLow: { light: "#F3F3F3", dark: "#24232A" },
    card: { light: "#FFFFFF", dark: "#1C1B20" },
    text: { light: "#1a191e", dark: "#F3F3F3" },
    textSecondary: { light: "#6B6B74", dark: "#A1A1AA" },
    accent: { light: "#b8420d", dark: "oklch(72% 0.14 45)" },
    verified: { light: "#15803D", dark: "#4ADE80" },
    error: { light: "#B91C1C", dark: "#F87171" },
    divider: { light: "#E4E4E7", dark: "#3F3F46" },
    onScrim: "#FFFFFF",
  },
  overlay: {
    scrim: { value: "rgb(26 25 30 / 0.6)", over: ["surface", "card"] },
  },
  schemes: ["light", "dark"],
  themes: {
    slate: {
      color: {
        surface: { light: "#F4F7FB", dark: "#10151C" },
        accent: { light: "#0B5CAD", dark: "#8AB8F0" },
      },
      radius: { none: "4px" },
    },
    hc: {
      when: "contrast",
      color: {
        textSecondary: { light: "#3F3F46", dark: "#D4D4D8" },
        error: { light: "#9B1C1C", dark: "#FCA5A5" },
        divider: { light: "#1a191e", dark: "#F3F3F3" },
      },
      overlay: { scrim: "rgb(26 25 30 / 0.8)" },
    },
    paper: {
      when: "print",
      color: {
        surface: "#FFFFFF",
        surfaceLow: "#FFFFFF",
        card: "#FFFFFF",
        text: "#000000",
        textSecondary: "#333333",
        error: "#8B1414",
      },
      font: { serif: "Georgia, serif" },
    },
  },
});
```

A designer reads it top to bottom: the default values, then each theme with only what it changes and the condition that turns it on. `slate` is the visitor's pick and has no `when`. `radius.none` at `4px` under `slate` reads oddly as a name; it is the brand's name for its one radius, and the theme gives it another value.

Every pair the brand's `base` and `look` sets judge passes in each of the 12 combinations (`light`, `light+hc`, `light+slate`, `light+slate+hc`, the same four in `dark`, and `print`, `print+hc`, `print+slate`, `print+slate+hc`). The tightest: `textSecondary` on `surface` is 4.91:1 in `light+slate`, and `error` on `surface` is 7.59:1 in `light+slate+hc`, where 7:1 is the need. Without `hc`'s `error`, a notice written `<Text fg="error" bg="surface">` fails where only the contrast theme asks for more:

```
E1804 modules/account/Notice.tsx:9:7 fg "error" on bg "surface" is 6.15:1 in light+hc, needs 7:1
```

### Combinations and the CSS
A combination is one scheme, at most one `choice` theme, the `contrast` theme on or off, and, when printing, the `print` theme in the light scheme. Later layers win: top level, scheme, `choice`, `contrast`, `print`. `combinations(tokens)` from `@keel/ui/css` lists them as `{ name, tokens }`, flat token sets with no `themes` and no pairs; E1804, the render check and the focus check iterate it.

The compiled CSS for `slate`'s `surface`, cut to one property per block (custom property names as k.ui and k.looks Names give them):

```css
@layer keel.tokens,keel.theme,keel.contrast,keel.print;
@layer keel.tokens{
:root{color-scheme:light dark;--k-color-surface:#F9F9F9}
@media screen and (prefers-color-scheme: dark){
:root:not([data-k-scheme="light"]){--k-color-surface:#141317}
}
@media screen{
:root[data-k-scheme="dark"]{color-scheme:dark;--k-color-surface:#141317}
}
:root[data-k-scheme="light"]{color-scheme:light}
}
@layer keel.theme{
:root[data-k-theme="slate"]{--k-color-surface:#F4F7FB}
@media screen and (prefers-color-scheme: dark){
:root[data-k-theme="slate"]:not([data-k-scheme="light"]){--k-color-surface:#10151C}
}
@media screen{
:root[data-k-theme="slate"][data-k-scheme="dark"]{color-scheme:dark;--k-color-surface:#10151C}
}
}
@layer keel.contrast{
@media (prefers-contrast: more){
:root{--k-color-textSecondary:#3F3F46}
}
}
@layer keel.print{
@media print{
:root{color-scheme:light;print-color-adjust:exact;-webkit-print-color-adjust:exact;--k-color-surface:#FFFFFF}
}
}
```

Inside a layer the selectors are RFC 0243's, prefixed by the theme's attribute, so a theme's dark value beats its light one by specificity, as the top level's does. Across layers the layer order decides. Every dark block sits under `screen`, so printing shows the light values whatever the visitor picked. An app with no `themes` has no `@layer keel.tokens` and no `data-k-theme`.

Size: each theme costs its declarations once, twice more for its pairs (the two dark blocks), and twice more for its colors once an element writes `scheme`. A declaration is about 30 bytes. `hc` above is 3 pairs and an overlay: 3 + 1 + 6 = 10 declarations, about 300 bytes before gzip.

### Switching
The visitor's pick is RFC 0243's mechanism with a second attribute:

```tsx
// modules/settings/AppearancePanel.tsx
import { type Infer, s } from "@keel/schema";
import { Box, SchemeSelect, ThemeSelect } from "@keel/ui";

export const Props = s.object({ id: s.string() });

export default function AppearancePanel(props: Infer<typeof Props>) {
  return (
    <Box id={`${props.id}.appearance`} as="section" direction="column" gap="3">
      <SchemeSelect
        id={`${props.id}.scheme`}
        label="Scheme"
        labels={{ system: "System", light: "Light", dark: "Dark" }}
      />
      <ThemeSelect id={`${props.id}.theme`} label="Theme" labels={{ default: "Keel", slate: "Slate" }} />
    </Box>
  );
}
```

`ThemeSelect` lists `default` and each `choice` theme `appearance(ctx)` knows, the app's own from its tokens, so `hc` and `paper` never appear in it: they follow the system's contrast setting and the printer. Each option's text, which a screen reader announces as its name, is its `labels` string, else the theme name; the select's own name is `label`. Its `labels` keys are judged against the tokens (E1816), since the type of `@keel/ui`'s `ThemeSelect` cannot know an app's theme names. An app with message sets and locales passes loader text, as any visible string: `labels={{ default: props.data.text.themeKeel, slate: props.data.text.themeSlate }}`.

App code reads and sets the pick through one capability:

```ts
// modules/editor/toggleScheme.ts
import type { Ctx } from "@keel/ctx";
import { appearance } from "@keel/ui";

export function toggleScheme(ctx: Ctx): boolean {
  const a = appearance(ctx);
  return a.set({ scheme: a.scheme() === "dark" ? "light" : "dark" });
}
```

`scheme()` and `theme()` are reactive reads, so a chart in a `Host` element that draws with token values reruns when the pick changes. `set` writes the attribute and the cookie exactly as a pick in the control does, and returns `false` for a theme name no option holds. On a server the reads give the request's cookies, so `SchemeSelect` and `ThemeSelect` render their value into the first paint. Under a sim ctx the capability reads and writes the document of the harness render given that ctx and knows the themes of that render's tokens, so a test asserts a switch with no server:

```ts
const ctx = createCtx({ mode: "sim", seed: 1 });
render(AppearancePanel, { props: { id: "settings" }, ctx, artifacts: { tokens } });
expect(appearance(ctx).set({ theme: "slate" })).toBe(true);
expect(appearance(ctx).theme()).toBe("slate");
```

Under `keel test` a render given no `artifacts` takes the project's `tokens.ts` (k.a11y Artifacts), so `artifacts` is needed only outside it.

First paint: `schemes.json` gains `themes` (the `choice` names); a `node` document writes `data-k-theme` from `keel-theme`; the 300-byte head script ships in a `static` or `client` deployable with both schemes or a `choice` theme, and sets both attributes, `data-k-theme` only to a value shaped as a theme name. An A1 static site with one scheme and only a `print` theme carries no script and no cookie.

A dark sidebar in a light app (K6):

```tsx
<Box id="nav.side" as="nav" label="Reports" scheme="dark" bg="surface" fg="text" p="3">
  <ReportLinks id="nav.links" />
</Box>
```

`scheme="dark"` writes `data-k-scheme="dark"` on the `nav`, and the subtree blocks re-declare the dark values there. Contrast inside it is judged in the dark combinations and the printing ones; on paper the subtree is light, since the subtree blocks are screen-only. A subtree theme is refused: a different brand in one region is a `look`.

### Print
A K1 article page that prints differently:

```tsx
// modules/docs/Article.tsx
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({
  id: s.string(),
  title: s.string({ min: 1 }),
  body: s.string({ min: 1 }),
  notes: s.string({ min: 1 }),
  address: s.string({ min: 1 }),
});

export default function Article(props: Infer<typeof Props>) {
  return (
    <Box
      id={`${props.id}.page`}
      as="main"
      direction="column"
      gap={{ base: "4", print: "2" }}
      p={{ base: "5", md: "6", print: "0" }}
    >
      <Box id={`${props.id}.toc`} as="nav" label="On this page" media="screen">
        <Text id={`${props.id}.tocText`}>{props.title}</Text>
      </Box>
      <Heading id={`${props.id}.title`} level={1} breakAfter="avoid">
        {props.title}
      </Heading>
      <Text id={`${props.id}.body`} as="p">
        {props.body}
      </Text>
      <Box id={`${props.id}.notes`} as="section" breakBefore="page" breakInside="avoid">
        <Text id={`${props.id}.notesText`} as="p">
          {props.notes}
        </Text>
      </Box>
      <Text id={`${props.id}.printed`} as="p" media="print" fg="textSecondary" fontSize="sm">
        {props.address}
      </Text>
    </Box>
  );
}
```

On screen the page has its contents box and its padding; on paper the box is gone, the padding is 0, the notes start a page, the heading keeps to its paragraph, and the page's address prints at the end. The `paper` theme above sets the colors and a print font. `print` sits after every breakpoint block, so `print: "0"` wins at any paper width.

What `keel check` judges for print, with a `print` theme: contrast in each printing combination, with `media="screen"` subtrees left out and `media="print"` elements judged only there. Since Keel declares `print-color-adjust:exact`, the backgrounds the tokens give are the ones printed, and the judgement is exact. A `print` value of a responsive `fg` or `bg` (`fg={{ base: "textSecondary", print: "text" }}`) is judged in each printing combination as the `print` theme's values are; its screen values stay unread, as for any responsive value. It cannot judge the page box, margins, what a page break cuts, ink density or a printer's gray rendering. Without a `print` theme nothing is judged printing, so an app that never thought about paper gets no new errors.

Link URLs in print are not a prop: Keel's hrefs are route paths, so printing them prints `/docs/guide`, not an address. A page that wants the address prints it with `media="print"`, as above.

### Colors
k.values' `<color>` is hex (3 or 6 digits), `rgb(r g b)`, `hsl(h s% l%)`, `oklab(l a b)`, `oklch(l c h)` and `color(display-p3 r g b)`, space-separated only, each channel in a stated range. Every one has an exact luminance: sRGB forms through WCAG's linearisation, `hsl()` through CSS Color 4's `hslToRgb`, the others through CSS Color 4's matrices to linear sRGB. A color outside sRGB ships in two forms Keel computes, each inside the gamut of the screen that shows it: an sRGB form, `rgb()` after CSS Color 4's gamut mapping, as the base declaration, and a display-p3 form, the color as written when it is `color(display-p3 ...)` or else mapped into P3 the same way, in a block under `@media screen and (color-gamut: p3)` that follows the base block at once. No other form reaches the built CSS. Check judges each pair in each form, the lower ratio standing; printing ships and is judged in sRGB only. `color(display-p3 0 0.52 0.5)` on black ships `rgb(0 133 127)` (4.66:1) and itself (4.56:1); `oklch(70% 0.48 290)` on black ships `rgb(160 131 255)` (7.19:1) and `color(display-p3 0.6085 0.5055 1)` (7.12:1); `color(display-p3 0 0 1)` on black is 2.44:1 in sRGB and 2.59:1 in P3, so E1804 reports `2.44:1 in light (sRGB)`.

Refused: named colors (a 148-entry table in `@keel/ui` for a form no design tool exports), comma syntax (a second spelling of each form), `none`, `calc()` and relative colors (`rgb(from ...)`), whose value depends on another.

Alpha: a color with alpha is an `<alpha>` (`#rrggbbaa`, or a function form with ` / a`). It is admitted in two places. In `shadow`, which no contrast rule judges. And as an `overlay` token, which names the opaque colors it may sit on:

```ts
overlay: { scrim: { value: "rgb(26 25 30 / 0.6)", over: ["surface", "card"] } },
```

`bg="scrim"` and `fg="scrim"` take it like a color. Contrast is judged on the composite, `a × c + (1 − a) × b` per sRGB channel as browsers blend, over each `over` color, or over the parent's `bg` when the chain finds it, which must be in `over` (E1817). White text on `scrim` is 4.73:1 over `surface` and 4.58:1 over `card`; under `hc` the overlay goes to 0.8 and both pass 7:1 (9.36:1 and 9.22:1).

### Contrast and a11y per theme
- E1804 (static and at render) and the `base.focus` check judge every combination, the first failing one reported, its name in the message (`in dark+slate+hc`). Library pairs are reported in `tokens.ts` once per pair and combination (k.looks Library contrast).
- The `contrast` theme is held to WCAG 1.4.6: 7:1 for text, 4.5:1 for large text. A theme for `prefers-contrast: more` that only meets AA does not raise the contrast the person asked for. The focus ring needs 3:1 in every screen combination.
- `forced-colors: active`: the user agent replaces every color, and Keel emits nothing for it. Keel never emits `forced-color-adjust`, so no style prop can opt a control out of the person's palette. The focus ring is an outline, which forced colors keep. A control that shows its state by background alone (a switch track drawn with `bg`) disappears there; `keel check` cannot see that, and the keel-library skill says to give such a control a `border`.
- Check time: `combinations(tokens)` is computed once per run, at most 54 flat sets. Each judged element computes one ratio per combination, cached by its pair of values, so an app with no `themes` does the same work as today and the 54-combination worst case adds at most 54 cached lookups per element. `check.injected10` and the golden apps, which have no themes, do not move.
- A6's evidence: the ledger's 1.4.3 items count per route, as today, and the render check behind an `example` item judges every combination, so a passing item covers every theme. Which combinations a claim covers is not yet in `keel evidence` (For the operator, 8).

### A library under an app's themes (L1, L2)
`acme` (RFC 0243's example) ships contrast values for its own names:

```ts
// node_modules/@acme/ui/src/acmeTokens.ts (module id `acme`)
import { defineTokens } from "@keel/ui/tokens";

export const acmeTokens = defineTokens({
  color: {
    "acme.accent": { light: "#0B5CAD", dark: "#8AB8F0" },
    "acme.onAccent": { light: "#FFFFFF", dark: "#0B1A2B" },
  },
  fontSize: { "acme.badge": "12px" },
  look: {
    "acme.badge": { bg: "acme.accent", fg: "acme.onAccent", fontSize: "acme.badge" },
  },
  themes: {
    contrast: { color: { "acme.accent": { light: "#08427D", dark: "#B5D3F7" } } },
  },
});
```

The app above lists `@acme/ui`. `keel check` reports, with a fix:

```
E1810 tokens.ts:3:14 @acme/ui needs color "acme.accent" and 3 more; import acmeTokens from @acme/ui/tokens
E1810 tokens.ts:3:14 @acme/ui needs themes.hc color "acme.accent"; spread acmeTokens.themes.contrast.color
```

After the fixes, the designer gives `slate`, a theme `acme` never heard of, a lighter accent:

```ts
  themes: {
    slate: {
      color: {
        surface: { light: "#F4F7FB", dark: "#10151C" },
        accent: { light: "#0B5CAD", dark: "#8AB8F0" },
        "acme.accent": "#3D8BD9",
      },
      radius: { none: "4px" },
    },
    hc: {
      when: "contrast",
      color: {
        ...acmeTokens.themes.contrast.color,
        textSecondary: { light: "#3F3F46", dark: "#D4D4D8" },
        error: { light: "#9B1C1C", dark: "#FCA5A5" },
        divider: { light: "#1a191e", dark: "#F3F3F3" },
      },
      overlay: { scrim: "rgb(26 25 30 / 0.8)" },
    },
    // paper as before
  },
```

```
E1804 tokens.ts:36:9 acme.onAccent on acme.accent is 3.56:1 in light+slate, needs 4.5:1; override in tokens.ts
```

`"acme.accent": { light: "#2F6FB5", dark: "#6FA8E8" }` passes (5.17:1 and 7.05:1). In `light+slate+hc`, the contrast layer's `#08427D` wins over `slate`'s, at 10.07:1. Without a `contrast` theme in the app, `acme`'s shipped contrast values are unused and nothing asks for them. In `acme`'s own folder, `keel check` judges the shipped `contrast` as a theme of that `when`, so `acme` proves 7:1 for its badge before it ships.

### From a design tool (A5)
The format, as the repo's research does not hold it (assumptions stated): a DTCG file is a JSON tree of groups; a token is an object with `$value`, a `$type` on it or on a group above it, and optional `$description` and `$extensions`. An alias is `"{group.token}"`. Since the format's 2025.10 draft, a color `$value` may be an object `{ colorSpace, components, alpha?, hex? }` and a dimension `{ value, unit }`; older exports write strings, and the importer reads both. The format has no modes in its core; Figma's variables export and Tokens Studio's DTCG export write one file per collection and mode. The importer reads that layout. A resolver document (the format's separate resolver module) and Tokens Studio's `$themes.json` are not read; they can be added beside it without changing what the importer writes.

Three files:

```json
// design/palette.tokens.json
{
  "palette": {
    "$type": "color",
    "ink": { "$value": { "colorSpace": "srgb", "components": [0.102, 0.098, 0.118], "hex": "#1a191e" } },
    "chalk": { "$value": "#F3F3F3" },
    "paper": { "$value": "#F9F9F9" },
    "night": { "$value": "#141317" },
    "ochre": { "$value": "#b8420d" },
    "ember": { "$value": { "colorSpace": "oklch", "components": [0.72, 0.14, 45] } }
  },
  "spacing": {
    "$type": "dimension",
    "1": { "$value": { "value": 4, "unit": "px" } },
    "2": { "$value": { "value": 8, "unit": "px" } }
  },
  "type": {
    "heading": {
      "$type": "typography",
      "$value": {
        "fontFamily": ["Source Serif 4", "Georgia", "serif"],
        "fontSize": { "value": 28, "unit": "px" },
        "fontWeight": "semi-bold",
        "lineHeight": 1.2
      }
    }
  },
  "hero": {
    "$type": "gradient",
    "$value": [{ "color": "{palette.ochre}", "position": 0 }, { "color": "{palette.ink}", "position": 1 }]
  }
}
```

```json
// design/theme.light.tokens.json
{ "color": { "$type": "color", "text": { "$value": "{palette.ink}" }, "surface": { "$value": "{palette.paper}" }, "accent": { "$value": "{palette.ochre}" } } }
```

```json
// design/theme.dark.tokens.json
{ "color": { "$type": "color", "text": { "$value": "{palette.chalk}" }, "surface": { "$value": "{palette.night}" }, "accent": { "$value": "{palette.ember}" } } }
```

`keel tokens import design/palette.tokens.json design/theme.light.tokens.json design/theme.dark.tokens.json` prints:

```
W1072 design/palette.tokens.json:29:5 hero: gradient has no Keel group; skipped
W1072 design/palette.tokens.json:23:9 type.heading lineHeight: dropped
ok tokens import 14 tokens, 1 looks, 0 themes
```

and writes:

```ts
// Written by keel tokens import; edit tokens.ts.
import { defineTokens } from "@keel/ui/tokens";

export const designTokens = defineTokens({
  color: {
    paletteInk: "#1a191e",
    paletteChalk: "#F3F3F3",
    palettePaper: "#F9F9F9",
    paletteNight: "#141317",
    paletteOchre: "#b8420d",
    paletteEmber: "oklch(0.72 0.14 45)",
    text: { light: "#1a191e", dark: "#F3F3F3" },
    surface: { light: "#F9F9F9", dark: "#141317" },
    accent: { light: "#b8420d", dark: "oklch(0.72 0.14 45)" },
  },
  space: { 1: "4px", 2: "8px" },
  font: { heading: '"Source Serif 4", Georgia, serif' },
  fontSize: { heading: "28px" },
  weight: { heading: "600" },
  look: { heading: { font: "heading", fontSize: "heading", weight: "heading" } },
});
```

The `light` and `dark` modes became pairs; `type.heading` became the look `heading` and three tokens; `semi-bold` became `600` by the format's weight table. The app's `tokens.ts`, which exported `brandTokens`, now spreads both:

```ts
import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import { designTokens } from "./tokens.design.ts";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...designTokens.color },
  space: { ...brandTokens.space, ...designTokens.space },
  font: { ...brandTokens.font, ...designTokens.font },
  fontSize: { ...brandTokens.fontSize, ...designTokens.fontSize },
  weight: { ...brandTokens.weight, ...designTokens.weight },
  look: { ...brandTokens.look, ...designTokens.look },
});
```

Hand edits go after the spreads, where the next import never writes: the importer replaces `tokens.design.ts` whole and touches `tokens.ts` only to add a missing import and spreads. A collection with modes other than `light` and `dark` (`brand.base`, `brand.slate`) gives the first mode's values at the top level and a theme per further mode, `when` inferred from the mode name (`print`; `contrast` or `highContrast`) and changed in `tokens.ts` with `themes: { ...designTokens.themes, slate: { ...designTokens.themes.slate, when: "contrast" } }` when the name says otherwise. Combined modes are resolved: a `slate` theme over a `light`/`dark` collection gets pairs where its aliases resolve differently per scheme.

What has no Keel group is reported, never guessed: gradients, `number` tokens (opacity, line height), cubic béziers and transitions, a color with alpha outside a shadow (the report says to declare an overlay, since only `tokens.ts` knows its backdrops), and a dimension under a group the importer cannot place (a `dimension` under `layout` is skipped, and the designer renames the group in the design file to `spacing` or `sizing`).

`keel tokens export` is after v1. It would attach at `combinations(tokens)` and the theme blocks: one DTCG file per scheme and per theme, the inverse of the import's mode mapping.

#### The guide's outline (not the guide)
1. In Figma, keep one variable collection whose modes are `Light` and `Dark`, and one for brands (`Base`, `Slate`), with a `High contrast` mode and a `Print` mode where the design has them. Name groups by what Keel calls them: `color`, `spacing`, `sizing`, `radius`, `fontSize`.
2. Export each mode as DTCG JSON (Figma's variables export, or Tokens Studio with the W3C format) into `design/`, named `<collection>.<mode>.tokens.json`.
3. Run `keel tokens import design/*.tokens.json`, base modes first. Read each W1072: a gradient or an opacity has no group; a translucent color wants an overlay in `tokens.ts` with its backdrops.
4. Run `keel check`. Each E1804 names the pair and the combination (`in dark+slate`). Fix the value in Figma and import again, or override it in `tokens.ts` (`keel tokens set color/textSecondary/dark '#A1A1AA'`).
5. Turn component styles into looks. A Figma text style imports as a look. A component's fills, strokes, radius and padding become a `look` in `tokens.ts` naming the imported tokens (`look: { card: { bg: "surface", fg: "text", radius: "none", p: "3" } }`), and the developer writes `look="card"`. The look stays the same in every theme; the tokens it names change.
6. Check the conditions: a high-contrast mode needs `when: "contrast"` and 7:1; a print mode needs `when: "print"`.
7. Look at it: `keel dev`, the `SchemeSelect` and `ThemeSelect` in the app's settings, the system's contrast setting, and the browser's print preview.
8. After the next design change, export and import again: `tokens.design.ts` is rewritten and `tokens.ts` keeps every hand edit.

### Motion (RFC 0252)
Motion tokens are custom properties (`--k-motion-<name>`), and the top-level layer already re-declares them under `prefers-reduced-motion: reduce`. The seam is the theme's group list: RFC 0252 can admit `motion` into a theme, and its values join the layer blocks above unchanged. Motion changes no color, so it adds no combination.

### Design mode (RFC 0253)
What a live token editor in `keel dev` needs, and where it is:
- A value addressable one by one. A token path (`color/text/dark`, `themes/slate/radius/none`, the form `keel tokens set` takes) names one value, and that value is one custom property in one block of one layer. A live override is one declaration of that property in a dev-only stylesheet: on `:root` for the whole app, or on an element's `[data-k]` id for one page or component, since custom properties inherit. No class changes, so nothing re-renders and no build runs. A new theme is a new `data-k-theme` block.
- The judgement on a token set without a build. `combinations(tokens)` takes evaluated tokens. E1804's judge of `base` and `look` sets needs tokens alone; its judge of elements needs the parsed files, which `keel check` already reads per run and evaluates `tokens.ts` each time (k.a11y-static Tokens), so a dev server hands it an edited token set.
- A patch that keeps hand edits. `keel tokens set` is the one writer of a value in `tokens.ts`: it finds the key after the group's last spread, replaces or adds it, and keeps every other property and comment. Design mode's export is a list of `set` operations. The importer uses the same spread writer for `tokens.ts` and owns `tokens.design.ts` whole. One rule for both: a tool owns a whole generated file or edits `tokens.ts` one key at a time.

## Alternatives
- Values per token keyed by theme (`text: { light, dark, hc, print }`), as Figma shows variables. A combination such as `hc` in dark has no key, a library cannot ship keys for themes it never heard of, and a theme cannot be read as one block. The importer maps Figma's per-variable modes into theme blocks.
- `light` and `dark` as two themes of the new model, `schemes` removed. The scheme axis crosses every theme and has its own platform preference and `color-scheme`; as themes, every brand theme would need a dark twin (`slate-dark`). It would also rename a glossary term.
- Flattened names (`slateDark`, `hcLight`). Twice the authoring for every theme with pairs, and the CSS loses the axis that lets a theme write only what it changes.
- A specificity ladder in place of cascade layers. It works with selectors like `:root:root:root`, which no designer reads; layers state the order.
- A `contrast` theme the visitor can also pick. With one `data-k-theme`, picking it would drop the brand theme. An app that wants a pickable high-contrast theme names a `choice` theme with the same values.
- A theme on a subtree. Every theme would need descendant blocks for every other selector, and contrast would follow the tree. A dark region is the case apps need; a different brand in a region is a `look`.
- `forced-colors` as a theme condition. The user agent replaces the colors; any value Keel set there would be overridden or, with `forced-color-adjust`, would fight the person's palette.
- Judging print without a `print` theme, against white paper. Every app with white text on a charcoal button would fail at print, in an app that never offered printing.
- Leaving `print-color-adjust` to the browser. Then a printed background depends on a dialog checkbox, and no number check gives is right.
- Named colors, comma syntax and alpha refused outright. Named colors and commas are second spellings. Refusing alpha would make every imported scrim and shadow tint lossy; an overlay keeps the judgement exact.
- A `printHref` prop on `Link`. Keel's hrefs are route paths; the printed text would be a path.
- The importer writing straight into `tokens.ts`. A re-import cannot tell a deleted design token from a hand edit; owning one generated file can.
- Reading the DTCG resolver module or Tokens Studio's `$themes.json`. Figma exports files per mode; the resolver module is newer than any tool that writes it. Either can be added without changing the output.
- `keel tokens export` now: after v1 by the operator's call.

## Spec diff
Applied in this commit, status `proposed` for new text.
- k.schemes (title "Color schemes and themes"): CSS rewritten as layers (top level, `choice`, `contrast`, `print`), dark blocks under `screen`, subtree blocks; Choice gains `ThemeSelect` and `appearance(ctx)`; First paint gains `themes` in `schemes.json`, `data-k-theme`, the `keel-theme` cookie and the script's condition; Checks judge combinations, E1814 covers `scheme`, E1816 judges `ThemeSelect`; Rules gain E1816. Conformance: #1 and #9 re-worded (the behaviour changed: `screen`; the script with a `choice` theme); #2 to #8 and #10 to #13 unchanged; #14 to #19 new.
- k.values: Forms (six opaque `<color>` forms, `<alpha>`), the table (an `overlay` row; `shadow` takes `<alpha>`), the refusal path for overlays and themes; Overlays, Contrast, Themes, Library themes new. Conformance #1 to #5 unchanged; #6 to #10 new (#10's display-p3 examples as settled below).
- k.a11y-static: Token names (`bg` and `fg` take `overlay`; `print` is no breakpoint key), Judged (first failing combination), Combinations and Overlays new (E1817, `combinations(tokens)`), Message (`<combination>`, `7`, the overlay's backdrop). Conformance #1 to #10 unchanged; #11 to #15 new.
- k.aria: Scheme and Print paragraphs after the states table, as the shared style vocabulary of base elements and `Part`. Conformance #14 and #15 new.
- k.ui: groups gain `overlay` and `themes`; style props gain `breakBefore`, `breakAfter`, `breakInside`; responsive keys point to k.aria Print; Tokens names `@keel/ui/tokens` and says `brandTokens` is plain data. Conformance: one bullet new, the last (no code of `@keel/ui/tokens` in a client bundle).
- k.looks: Shipped tokens allows `themes` as k.values Library themes gives; Library contrast reports per combination. No clause changes (#12's `in dark` is a combination name).
- k.design-tokens (new, area `tools`): Import, Set, E1071 and W1072, and conformance #1 to #5 (first written as k.cli #21 to #25; #4 now gives the dark file `surface` `#141317`, so the focus ring clears 3:1 in both schemes). k.cli keeps one pointer sentence, so `keel docs k.cli` stays within 1,500 tokens.
- k.cli: Conformance #2 names the shared flags and says each tool takes them (settled below).
- Map: k.cli reads `implemented`. No row added; no title changed.
- Glossary: **theme**, **combination**, **overlay**.

- k.testing: no clause changes; one sentence of its a11y paragraph is shortened, as `lane-r-look` shortens it, so the section is back under 3,100 tokens.

### Settled from the conformance-writer's reports
Three clauses the first text left unsound or unwritten:
- k.values #10 (the forms `TokenSchema` accepts) named `color(display-p3 0.67 0.29 0.1)`, whose linear sRGB by k.values Contrast's conversion is (0.4825, 0.0542, -0.0024): outside sRGB by more than 0.000001, so a case that takes the five forms as inside cannot hold. It now names `color(display-p3 0.67 0.3 0.2)`, linear sRGB (0.4814, 0.0592, 0.0226), inside with a margin above 0.02 on every channel, "each inside sRGB", and `color(display-p3 0 0 1)`, linear sRGB (0.0000, 0.0000, 1.0983), "outside it", the color #12 already judges for the gamut rule. The other four forms are inside: blue 0.0040, 0.0040, 0.0090, 0.0061. New text: "`TokenSchema` accepts as a color each of `rgb(184 66 13)`, `hsl(19deg 87% 39%)`, `oklab(0.54 0.12 0.1)`, `oklch(54% 0.16 40)` and `color(display-p3 0.67 0.3 0.2)`, each inside sRGB, and `color(display-p3 0 0 1)`, outside it, and refuses with rule `format` each of ..." (rest unchanged). Re-quote `packages/ui/conformance/color-forms.test.ts` and `packages/check/conformance/color-forms-e1804.test.ts`.
- k.cli #2 named no flags and did not say a tool still takes them. New text: "Each MCP tool's input schema is its operation's input's JSON Schema without `format`, `quiet`, `limit` and `verbose`, which `initialize` states once; each tool takes them, a refused value E1052." To keep `keel docs k.cli` within 1,500 tokens, four prose sentences and the two extension-point examples are shortened, with no clause changed. Re-quote `packages/cli/conformance/mcp-input-schema-equals-json-schema.test.ts` and `surfaces.test.ts`.
- k.ui's "never in a client bundle" was prose, so no ledger rung. New last bullet: "`keel build`'s client JavaScript for a `static` and a `client` project whose `tokens.ts` calls `defineTokens` and whose page imports `Box` and `brandTokens` holds none of `TokenSchema`, `defineTokens` and `2104542553`." (`2104542553` is the digits of `0.2104542553`, an entry of Oklab's LMS-to-Lab matrix in `linearToOklab`, which only the color maths holds; written without `0.` because a minifier prints `.2104542553`, and the old case's `0.4122214708` is no constant of the source at all, so its absence proved nothing.) The Tokens paragraph now reads "`defineTokens` and `TokenSchema` come from `@keel/ui/tokens`, which runs at check and build time only; `brandTokens` (`@keel/ui/brand`) is plain data a component may read" (D16), within 3,100 tokens. Re-quote `packages/cli/conformance/token-grammar-client-bundle.test.ts`, whose page gains the `brandTokens` import.

### Settled from the conformance-writer's questions
Seven points the first text left open, each now one sentence in the section named, with the reason:
1. k.schemes Choice: "`ThemeSelect` is the same control for a theme: options `default` then each `choice` theme `appearance(ctx)` knows, in `themes` order, each option's text (its announced name) the string `labels` holds under its name, else the name (with locales, loader text, std.messages)". Why: one list of theme names for the control and for `set`, from the tokens, so a library's settings panel (L1) shows the app's themes; the words are plain strings, so an app with locales (A5) passes message text, and a screen reader hears the words, never a token name.
2. k.schemes Choice: "It knows the `choice` themes of its deployable's tokens or, under a sim ctx, of the harness render given that ctx (k.testing, k.a11y Artifacts), whose document it uses; with no such render it knows none and has no document." Why: A7 already gives a render its tokens (or `keel test` does), so testing `set` needs no server and no new option.
3. k.aria Scheme: "`compileStyles` (`@keel/ui/css`) takes each such element as a usage `{ props: { scheme: '<value>' } }`, whose `classes` entry is `[]`; any one turns on k.schemes CSS's subtree blocks, per scheme and in every layer but `print`". Why: the usage shape every other style prop uses, and the attribute selector of k.schemes CSS, so no class is added for a scheme.
4. k.looks Library contrast: "the app's key being the one in the latest layer on in that combination (k.a11y-static Combinations) that writes it, in the order `print`, `contrast`, `choice`, top level; once per pair and combination, so with no `themes` once per pair and scheme". Why: the finding sits where the value that fails is written, which is where a designer (A5) or a library's user (L1) changes it, and with no themes it is `lane-r-look`'s rule exactly.
5. k.cli Tokens: "It prints each W1072 in the file given that holds the token, at the 1-based line and column of the opening quote of the token's `"$value"` key, or for a dropped field of that field's key inside it". Why: an editor jumps to the exact value in the design file (A5); a dropped `lineHeight` points at `lineHeight`.
6. k.values Overlays: "An `over` naming anything but a color token the same tokens hold (an overlay among them) fails `TokenSchema` at `overlay.<name>.over`, so `keel check` reports E1807 at `tokens.ts` line 1, column 1 (k.a11y-static Tokens) and judges no element; a backdrop an element's chain finds that `over` does not hold is E1817, from `keel check` only, at the opening quote of the overlay's literal (k.a11y-static Overlays), and the render check composites over the painted backdrop and reports no E1817." Why: a list that names nothing real is a token error like any other; a backdrop is a fact of the markup, found statically, and at render the painted pixels are judged as they are.
7. k.a11y-static Combinations: "for tokens `TokenSchema` refuses (9 `choice` themes, a second `contrast` or `print`, k.values Themes) it throws E1807 as `defineTokens` does, so it never lists more than 54." Why: `combinations` is public to libraries and tests (L1, A7) and takes a typed `Tokens`, which a caller can build without `defineTokens`; throwing as `compileStyles` does keeps the bound true for every caller.

### Settled from the breaking review
Each guarantee is kept and enforced. The changed text, by section and clause:
- k.themes Check-time entries (new, now k.check-time) and #6: E1818, message `<entry> is check and build time only; use token names or @keel/ui/brand`, at the specifier of a value import of `@keel/ui/tokens` or `@keel/ui/css` in an app's or library's code file; free in a server-only file, a test file and a tool config, and in `tokens.ts`, the files it imports and a library's `src/<id>Tokens.ts` while no route `component` or `client` module file reaches them. No fix: no client value stands in for the grammar, so the message names what to use. k.ui Tokens and Rules point to it; k.values Stylesheet names the two entries.
- k.ui #29: the vacuous name probes and the matrix constant give way to a control: the string literals of 6 or more units, at least 20, that `vite build` (which runs no check) puts in the client JavaScript of the same project with a page rendering `Object.keys(defineTokens({})).length` and not with a page importing `Box` alone; the tested build holds none of them. To fit, three explanatory parentheses of k.ui Base, one of Scroll regions and the `border` example are cut.
- k.values Contrast and #13: restated at its root in the second breaking review below (k.gamut). The "Refused, and why" sentence is cut to its list.
- k.themes Token errors (new), #4 and #5; k.a11y-static Tokens and #5; k.values Overlays: E1807 sits at the key that writes the failing path (a spread's `...` for a value from a spread or another file), its message `<path>: <what>` from a closed list, `see` the section holding the rule; `<path>` is shortened from its front so `: <what>` is never cut, in json too; E1810's theme message, E1816 and E1817 shorten their names, longest first, so no fixed word is cut. A `tokens.ts` that throws otherwise, or exports no `tokens`, stays at line 1, column 1.
- k.themes Fixes (new), #8 and #9; k.schemes Rules and k.a11y-static Overlays point to it: E1816's fixes add a missing label, delete a stray one, or delete a `ThemeSelect` with no theme to pick and its import; E1817's adds the backdrop to the overlay's `over`. An overlay on an overlay has no fix, since `over` names only colors.
- k.themes Combinations and #7; k.a11y-static Values: a responsive `fg` or `bg`'s `print` key is judged in each printing combination as the `print` theme's values are.
- k.cli Commands and #21: `keel dev` listens on 127.0.0.1, or on the Vite config's `server.host`; no `--host` flag exists. k.deploy Build and #14: `node server.mjs` listens on every address on `PORT`.

### Settled from the second breaking review
Two screens showed a color form Keel had not judged: Lightning CSS, Vite 8's default CSS minifier for the client, rewrote `color(display-p3 0 0.52 0.5)` to its own `#00827c` with the original under `@supports` (4.56:1 judged, 4.48:1 shipped; eleven such pairs), and a P3 screen clipped `oklch(70% 0.48 290)` to 4.34:1 on black. Enumerating what browsers may do with an out-of-gamut value keeps losing, so the rule is restated at its root: Keel ships only colors inside the gamut of the screen that shows them, computes each, and judges exactly what it ships. Changed text, by section and clause:
- k.gamut (new, area `ui`, owner `@keel/ui`): Forms (one form inside sRGB; outside it an sRGB form mapped by CSS Color 4's gamut mapping and rounded to 8 bits, and a P3 form, as written for `color(display-p3 ...)`, else mapped into P3 and rounded to 4 decimals), CSS (the sRGB form declared; each block writing a color outside sRGB, but in the `print` layer, followed at once by one under its conditions with `screen` and `(color-gamut: p3)`; no other color value in the built CSS, no `@supports`), Judging (each pair per form, printing in sRGB only, the lower ratio standing, sRGB's on a tie; an `<alpha>` composited within each form). Its conformance #1 replaces k.values #13, its #2 replaces the overlay bullet k.values #14, and #3 and #4 are new.
- Print: the `print` layer is `:root` under `print`, and every P3 block sits under `screen`, so a printer gets sRGB forms only; printing combinations are judged in sRGB forms only.
- k.values Contrast keeps the luminance sentence, gains "inside sRGB, or display-p3" and points to k.gamut; the three-form text and the composite sentence are removed. #12 is replaced (the message holds `2.44:1 in light (sRGB)`); #13 and #14 move to k.gamut as above.
- k.a11y-static Message: ` (sRGB)` or ` (P3)` follows `<combination>` in each E1804 message when a color it judges is outside sRGB. No bullet changes: none of its cases holds such a color.
- k.check-time (new, area `client`, owner `@keel/check`): k.themes Check-time entries moves here whole and is regrouped so "no client entry reaches it" governs every exemption; the test and config kinds are k.check App code's; `import type` and an import or export whose every name is written `type` (`export { type Tokens } from`) are free; an exempt-kind file a client entry reaches is reported at the client entry's import of the chain's first file, message `<file> imports <entry>, check and build time only`. `@keel/ui/tokens` lists the `Tokens` type. #1 replaces k.themes #6 (its last clause: two E1818 at `A.tsx`'s import of `tokens.ts`, naming `tokens.ts` and `tokens.design.ts`); #2 is new (a test-folder file and a config reached through a chain, `export { type Tokens }`).
- k.themes Token errors: a quoted name in E1807's `<what>` fits as E1816's names do; Fixes: E1816 judges a `labels` literal with a spread by its literal keys only; E1817's fix takes an `over` written `as const`. Its #6 leaves (to k.check-time #1); #9, #10 and #11 are new (#7 to #9 become #6 to #8, wording unchanged).
- The `ui` area gains the k.gamut row; the k.values and k.themes `holds` drop the topics that moved; the `client` area gains k.check-time.

### k.values on `lane-r-look`'s grammar
When this lane is rebased on `lane-r-look`, its k.values keeps that lane's opening paragraph and its Characters, Numbers and lengths, What check judges and Stylesheet paragraphs whole, and its conformance #1 to #9. This RFC's k.values then changes exactly these sentences, and its Forms paragraph and its `So url(...)` sentence are dropped:
- Colors: "`<color>` is `#` and 3 or 6 hex digits;" is replaced by this lane's six-form list, with `<ab>` written as "an `<n>`, or `-` and an `<n>`, from -0.5 to 0.5" (that grammar's `<n>` has no sign) and `<h>` an `<n>`, bare or followed by `deg`. "A `<color>` holds no alpha." is replaced by this lane's `<alpha>` sentence with its last clause ("So no named color, ...") kept. The `<ref>` and `<paint>` sentences stay.
- The table: this lane's `overlay` row is added after `color`; in `shadow`, "then an optional ` <paint>`" becomes "then an optional ` <paint>` or ` <alpha>`".
- The refusal sentence: "(with `light` or `dark` after it for a pair)" becomes "(with `value` or `over` after it for an overlay, then `light` or `dark` for a pair; under `themes.<theme>.` in a theme)".
- Added after Stylesheet, as this lane writes them: the Overlays, Contrast, Themes and Library themes paragraphs; and this lane's conformance #6 to #10 after that lane's #9, as #10 to #14; this lane's #1 to #5 give way to that lane's #1 to #9, which hold them.

On the rebase both sections ran over the 3,100-token limit (k.values 3,629 with `lane-r-look`'s grammar; k.a11y-static 3,418 with k.looks' Library contrast moved in), so the two-level map's room is used as D12 recommends: a section **k.themes** (Themes and combinations, area `ui`) holds the Themes and Library themes paragraphs and their conformance (this lane's k.values #9 and #10), and the first half of k.a11y-static Combinations with its `combinations(tokens)` case; k.a11y-static Combinations keeps what E1804, the render check and `base.focus` judge per combination. k.looks Library contrast's change lands in k.a11y-static Library contrast, where the main line moved it.

### The built CSS verified, not the config
k.gamut's guarantee is stated on the built CSS, so it is enforced there. Refusing config values (a `cssMinify` other than `esbuild` or `false`, `css.transformer: 'lightningcss'`, as E1007 `css config`) could never be complete: a project PostCSS plugin that rewrites colors passed it, as would a Vite option not yet written, and E1007's "server code in browser build" named the wrong fault. Changed text:
- k.gamut CSS: the plugin gives esbuild's minifier to a browser build that sets no `cssMinify` and no `minify: false`, and keeps any it sets. The check is positive and whole, on the output as written once everything is (a `client` build's folder after every plugin's last hook, a `node` or `static` deployable's whole `dist/<name>/` from its `buildApp`): every `.css`, `.js`, `.mjs`, `.cjs`, `.html` and `.svg` file, against the CSS the browser build loaded. Presence: each compiled color declaration is found in a `.css` file at its selector, layers, media and no other at-rule, holding its value; nothing to find only when the compiled CSS, the token evaluation's output, declares no color. Nothing extra: any other `--k-*` declaration in a `.css` file, and any color declaration in another file, is E1819 (Keel's CSS ships as CSS files; Keel's own documents link their stylesheets, so nothing of Keel's is inline). Wrappers: the rule reader records every at-rule around a declaration (`@supports`, `@container`, `@scope`, `@starting-style`, an unknown one) and flattens none. A build whose `cssTarget` names a browser older than `color()` gets each P3 block inside `@supports (color: color(display-p3 0 0 0))`, which the check then expects: a browser without `color()` that matches `(color-gamut: p3)` would otherwise read an invalid value at computed-value time (inherited or initial), not the sRGB form. The record carries `see` k.gamut; `keel build` prints it alone, without Vite's printout of the throw. `keel dev` runs no output check: Vite's dev pipeline injects stylesheets from JavaScript, which the rule refuses, so a check there would be a second rule.
- k.bundle Rules: E1007 loses `css config`; E1819 is listed, pointing to k.gamut.
- k.themes: E1807's `not a <group> value` reads `not an overlay value` for the overlay group (no conformance quote holds the old text).
- Cost: under 1 ms per build on `apps/household` and `apps/golden-2` (one 7 KB and three 19 KB stylesheets); their `keel build` medians of three runs, before and after, are 7.88 s and 7.86 s, 7.52 s and 7.36 s.

### RFC 0243's clauses that change, for its builder and conformance-writer
- k.schemes CSS: the dark blocks are `@media screen and (prefers-color-scheme: dark){...}` and `@media screen{:root[data-k-scheme="dark"]{...}}`. Conformance #1 now names both media queries; `packages/ui/conformance/schemes-css.test.ts` is re-quoted.
- k.schemes First paint: the script ships with both schemes or a `choice` theme, and sets `data-k-theme` too. Conformance #9 ends "with one scheme and no theme to choose, no `keel-scheme` script"; `packages/cli/conformance/scheme-static-script.test.ts` is re-quoted. `schemes.json` may hold `themes`; #8 is unchanged.
- k.schemes Choice: `SchemeSelect`'s picks go through `appearance(ctx)`; its rendered behaviour and #6, #7, #13 are unchanged.
- k.schemes Checks: "in each of the app's schemes" is now "in each of the app's combinations"; with no `themes` they are the schemes, so #5, #11 hold as written.
- E1814 gains a second message for `scheme`; #10 and #12 are unchanged.
- k.looks Library contrast: `<scheme>` is now `<combination>`; #12's expected message is unchanged.
- The builder of 0243 should land `schemesOf` callers behind one function, since `combinations(tokens)` replaces the loops over `["light", "dark"]` in `focusProblem`, `lowContrast`, `schemesIn` and `contrastViolations`.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/ui/conformance/themes-css.test.ts`: k.schemes #14 and #15 (layers, `choice`, `contrast`, `print`, `screen`), and k.aria #15's render and CSS half.
- `packages/ui/conformance/theme-select.test.ts`: k.schemes #16 and #18. `packages/check/conformance/theme-select-e1816.test.ts`: #17. `packages/server/conformance/theme-cookie.test.ts`: #19's `createApp` half; `packages/cli/conformance/scheme-static-script.test.ts` gains its build half.
- `packages/ui/conformance/color-forms.test.ts`: k.values #6 to #8 (the luminance clause through `contrast` and E1804 in `packages/check`). `packages/ui/conformance/themes-schema.test.ts`: k.values #9. `packages/check/conformance/library-themes.test.ts`: k.values #10.
- `packages/check/conformance/combinations.test.ts`: k.a11y-static #11 to #15 (`combinations(tokens)` from `@keel/ui/css` for #11; E1804 and E1817 for the rest).
- `packages/ui/conformance/print-props.test.ts`: k.aria #14 (its E1807 half in `packages/check`); `packages/check/conformance/scheme-subtree-e1814.test.ts`: k.aria #15's E1814 half.
- `packages/cli/conformance/tokens-import.test.ts`: k.cli #21 to #24. `packages/cli/conformance/tokens-set.test.ts`: #25.
- `fixtures-by-code.ts`: E1816, E1817, E1071, W1072, and E1814's `scheme` message.
- Re-quoted or changed for the seven settled points (Spec diff): `theme-select.test.ts` renders through `@keel/testing` `render` with `artifacts: { tokens }` and a `ctx` (no bare `mount` on a separate ctx), takes the options from the tokens, not the `labels` keys, asserts the fallback text `forest` for a theme `labels` lacks and the no-render `false`, and drops its AMBIGUOUS line; `theme-select-e1816.test.ts` is unchanged; `themes-css.test.ts` and `scheme-subtree-e1814.test.ts` quote k.aria #15's `compileStyles` case, whose usage shape they already assume; `library-themes.test.ts` quotes the new Library contrast sentence, its `slate` case unchanged; `tokens-import.test.ts` puts a dropped field's W1072 at the field's key (`"lineHeight"`), not the token's `"$value"`; `color-forms.test.ts` asserts `overlay.scrim.over` as the path of k.values #7's `over: ['nope']`; `combinations.test.ts` asserts that `combinations` throws E1807 for nine `choice` themes and drops its AMBIGUOUS line.
- k.themes #4 (E1807 at the key, its message and `see`, for a reserved theme name, a pair in a print theme and comma color syntax): `packages/cli/conformance/token-errors-e1807-cli.test.ts`.
- k.themes #5 (E1807 at a spread's `...`, a throw at line 1, column 1, a long path never cutting `: <what>` in compact or json): `token-errors-e1807-cli.test.ts`, its E1817 half in `packages/check/conformance/theme-message-fit.test.ts`.
- k.check-time #1 (E1818 where a client entry reaches the import, none where it is free, `keel build` exits 1): `packages/cli/conformance/check-time-entries-e1818.test.ts`, its library half in `packages/check/conformance/check-time-entries-library.test.ts`, its `keel build` half in `packages/cli/conformance/check-time-entries-build.test.ts`.
- k.themes #6 (a responsive `fg`'s `print` key judged in print, none without a `print` theme): `packages/check/conformance/print-key-e1804.test.ts`.
- k.themes #7 (E1816's fixes): `packages/check/conformance/theme-fixes.test.ts`.
- k.themes #8 (E1817's fix, none at 8 names): `theme-fixes.test.ts`.
- k.gamut #1 (replaces k.values #13) and #3: `packages/ui/conformance/color-gamut-forms.test.ts` (`contrast`, the compiled CSS) and `packages/check/conformance/color-gamut-e1804.test.ts` (E1804, `(P3)`, `media="print"`); `color-clipped-e1804.test.ts` and `color-clipped.test.ts` are re-based onto them.
- k.gamut #2 (replaces k.values #14): `packages/check/conformance/overlay-gamut-forms.test.ts`.
- k.gamut #4 (the built CSS's color values are the judged set): `packages/cli/conformance/built-css-colors.test.ts`, on a real `keel build`.
- k.gamut #5 and #6 (E1819): `packages/cli/conformance/built-css-verified.test.ts`, on a real `keel build` of #4's `static` project: its `vite.config.ts` once with `build: { cssMinify: 'lightningcss' }`, once with `css: { postcss: { plugins: [toHex] } }` (a `Declaration` visitor replacing `rgb\((\d+) (\d+) (\d+)\)` by `#` and each channel as 2 lowercase hex digits), once with `build: { cssMinify: false }` and once as scaffolded; then with a `styles` entry `./app.css` holding `.x{--k-color-b:#000000}`, and holding `.x{color:#123ABC}` and `@supports (display:grid){.g{display:grid}}`. Each failing build: exit 1, one E1819 line, no `dist/<name>/`. The E1819 row and fixture in `fixtures-by-code.ts`.
- k.gamut #7 to #11 (the output check whole): `packages/cli/conformance/built-output-verified.test.ts`, on the same `static` project as `built-css-verified.test.ts`, each plugin a plain object in `vite.config.ts` after `keel()`. #7: `generateBundle: { order: 'post', handler(_o, bundle) { if (this.environment.name !== 'client') return; ... } }` deleting each asset whose `fileName` ends `.css` and prepending `(()=>{const s=document.createElement('style');s.textContent=<JSON text>;document.head.appendChild(s)})();` to the chunk with `isEntry`; then one setting each `.css` asset's `source` to its text with every `--k-` replaced by `--q-`. #8: `this.emitFile({ type: 'asset', fileName: 'assets/extra.css', source: ':root{--k-color-a:#ff0000}' })` in such a hook; `@scope (.never){` + text + `}` on each `.css` asset; the first `:root{...}` holding `--k-color-b` replaced by `@container (min-width:1px){:root{...}}`. #9: the records' `see` and stderr of #7 and #8's builds. #10: #6's `styles` package with `.x{--k-space-zz:4px}`, then with the three rules and a `postcssPlugin` object whose `Declaration` visitor clones each `user-select` declaration as `-webkit-user-select` before it. #11: `build: { target: ['chrome100'] }`, the `@media` rules found under an `@supports` whose prelude, spaces removed, is `(color:color(display-p3 0 0 0))`. Each failing build: exit 1, one E1819 line, no `dist/site/`.
- Re-quoted: `built-css-verified.test.ts`'s k.bundle Rules header (`E1819 built output holding Keel's CSS other than as compiled, or outside \`.css\` files (k.gamut CSS).`); its UNTESTABLE note on `Fix:` gives way to `keel explain E1819`, which now names the cause; its `FORMS` list gains `under @<name>` for any at-rule and `in <file>; Keel's CSS ships in .css files` (its `under @supports` case still matches).
- k.values #12 re-worded (`2.44:1 in light (sRGB)`): re-quote its case.
- k.check-time #1 (replaces k.themes #6) and #2: re-base `check-time-entries-e1818.test.ts`, `check-time-entries-library.test.ts` and `check-time-entries-build.test.ts` onto k.check-time; #2 in `check-time-entries-e1818.test.ts`. The comment in `check-time-entries-build.test.ts` that `@keel/ui/tokens` exports no `Tokens` no longer holds: the control may import `Tokens`.
- k.themes #9 (E1807 name fit), #10 (E1816 with a spread), #11 (E1817's fix under `as const`): `token-errors-e1807-cli.test.ts` and `theme-fixes.test.ts`; #6 to #8 (formerly #7 to #9) keep their files and are renumbered.
- k.ui #29 re-worded (the control build): re-quote `packages/cli/conformance/token-grammar-client-bundle.test.ts`.
- k.a11y-static #5 re-worded (`color: { fg: 5 }` at the `fg` key): re-quote its case; `packages/cli/conformance/overlay-over-e1807-cli.test.ts` moves its E1807 to the `over` key, message `overlay.scrim.over: names no color token "nope"` (k.values Overlays).
- k.cli #21 (`keel dev`'s address): `packages/cli/conformance/dev-listen-address.test.ts`.
- k.deploy #14 (`server.mjs`'s address): `packages/cli/conformance/server-listen-address.test.ts`.
- Owed as eight end-to-end cases for RFC 0244's runner:
  1. The CSS compiled from the `tokens.ts` above parses in Chromium with `cssRules.length` equal to the rules emitted (k.values #5 with themes, overlays and every color form).
  2. With `data-k-theme="slate"` and an emulated dark preference, `getComputedStyle(document.body).backgroundColor` is `#10151C`.
  3. With `prefers-contrast: more` emulated, `textSecondary` resolves to `hc`'s value.
  4. With `emulateMedia({ media: 'print' })` and `data-k-scheme="dark"`, `paper`'s values apply and no dark value does.
  5. `media="screen"` elements are absent from a printed PDF's text.
  6. `breakBefore="page"` starts a new page of a printed PDF.
  7. A `node` page with `keel-theme=slate` and a `static` page with the same cookie paint `slate` from the first frame.
  8. Under forced colors (Chromium's `--force-high-contrast`), no rule of Keel's CSS carries `forced-color-adjust`, and the focus outline shows.

## Migration
None. No in-tree app writes `themes`, an overlay, a print key or a non-hex color. Apps with both schemes get `screen` on their dark blocks, which changes only what prints.

## Token impact
- Spec: k.schemes 1,827 to 3,098 of 3,100; k.values 815 to 2,424; k.a11y-static 2,108 to 3,099; k.aria 1,775 to 2,437; k.cli 1,493 to 2,947; k.ui 2,965 to 3,002; k.looks 3,080 to 3,091; k.testing 3,102 to 3,097. Each fits by trimming sentences that restate what another sentence or section says. No section limit moves. `spec.map` stays 1,644 of 1,660 (one status shorter) and the `keel docs` map 1,689 of 1,690.
- After the breaking review (chars / 4, against 3,100): k.themes 3,088; k.values 3,098; k.ui 3,098; k.schemes 3,099; k.a11y-static 3,027; k.deploy 1,937; `keel docs k.cli` 1,500 of its 1,500; the `ui` area 495 of 500; skills keel-client 3,169 of 3,170 and keel-library 1,199 of 1,200. No limit moves.
- After the second breaking review (chars / 4, against 3,100): k.values 2,831; k.gamut 1,241 (new); k.themes 2,952; k.check-time 861 (new); k.a11y-static 3,064; k.ui 3,093. The `ui` area stays within 500 with the k.gamut row, the `holds` of k.values and k.themes dropping the topics that moved; the `client` area gains one row. No limit moves.
- `keel explain`: five entries (E1816, E1817, E1818, E1071, W1072), each under 300 tokens.
- `@keel/ui`: `ThemeSelect`, `appearance`, the six color parsers and the gamut mapping. The parsers live in `@keel/ui/tokens` and `@keel/ui/css`, the mapping in `@keel/ui/css` (check and build time only, k.check-time), so the client entry gains `ThemeSelect` and `appearance` only. `@keel/ui` is already over its 6 kB budget on this lane; the build re-bases it and says by how much.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the clauses above, after RFC 0243's merge. 3. Build, by package:
- `@keel/ui`: `TokenSchema` gains `overlay`, `themes` and the color forms (`internal/valueForms.ts`, `internal/colorSyntax.ts`); `css/colorLinear.ts` takes each form to linear sRGB, `css/gamutMap.ts` maps into a gamut, `css/composite.ts` composites `<alpha>` within a form, `contrast` judges any `<color>` in each shipped form (k.gamut); `@keel/ui/tokens` exports `defineTokens`, `TokenSchema` and the `Tokens` type; `css/combinations.ts`; `compileStyles`' `rootBlocks` emits layers and the `screen` and subtree blocks; `vocabulary` gains `breakBefore`, `breakAfter`, `breakInside`; the `print` key in `className` and the section order; `media` and `Box scheme`; `ThemeSelect` on `SchemeSelect`'s machinery; `appearance` registered as a capability (`real`, `shell`, `sim`).
- `@keel/check`: `lowContrast` and `focusProblem` over `combinations`, 7:1 under `contrast`, the `media` and `scheme` chain, overlays and E1817; E1816; E1814's `scheme` message; library `themes` in E1810, E1812 and E1813.
- `@keel/testing`: `contrastViolations` over `combinations`, resolving an element's scheme from its closest `data-k-scheme`.
- `@keel/cli`: `keel tokens import` and `keel tokens set` (one `tokensEdit` module beside E1810's fix writer); `schemes.json` with `themes`; the head script reads both cookies.
- `@keel/server`: `data-k-theme` from `keel-theme`; `appearance` on a server ctx reads the request's cookies.
- `@keel/compiler` `projectTokens`: `themes` and the "an element writes `scheme`" and "writes `media`" flags.
- Docs: the keel-client skill's Base and looks paragraph (themes, print props), the keel-library skill (shipped `themes`, a border on state-by-background controls), `docs/BRAND.md` section 6 (a dark scheme for `brandTokens` stays the brand's call), READMEs, a changeset, and the guide from the outline above.
- A proof: one example app with the `tokens.ts` above, the article page, and an import from `design/` (personas A5, K1).

## For the operator
1. **Themes beside schemes, not in place of them** (D2). Recommended: keep. It keeps the glossary term, RFC 0243's CSS and every clause it is building, and it is the axis designers already think in (Figma's Light and Dark modes cross its brand modes).
2. **The contrast theme is held to 7:1** (D4). A designer whose high-contrast theme meets only AA gets errors. Recommended: keep; `prefers-contrast: more` asks for more than AA, and Keel is the place that can prove it.
3. **Print is judged only with a `print` theme** (D8). Recommended: keep; an app that adds one opts into the judgement, and Keel then prints exactly what it judged.
4. **Overlays name their backdrops** (D9). Recommended: keep; it is the one way an alpha color has an exact contrast number.
5. **No subtree theme** (D7). Recommended: keep until an app needs one; the cost is a descendant block per theme pair.
6. **Sections** (D12): theme text sits in k.schemes, k.values, k.themes, k.a11y-static and k.aria; the gamut rule in k.gamut. Recommended: keep.
7. **Brand dark palette.** The example `tokens.ts` holds a dark scheme for every brand color. Recommended: a brand task adopts those values into `brandTokens` (with the brand guide's sign-off), so the scaffold starts with both schemes and a `print` theme.
8. **Evidence per combination** (A6). `keel evidence` reports each route's 1.4.3 result, and the render behind it judges every combination, but the bundle does not list the combinations. Recommended: a k.evidence follow-up adds `combinations: [names]` to each a11y record, so a compliance owner reads which themes a claim covers without reading `tokens.ts`.
9. **Where E1807's words and E1818 live.** E1807's words sit in k.themes Token errors; E1818 has its own section, k.check-time, in the `client` area beside k.boundary and k.bundle, since it is a rule about what reaches a client bundle. Recommended: keep.
10. **E1818 has no fix.** No client value stands in for `defineTokens` or `combinations`, so the message names what to use (token names, `brandTokens`) and the diff is left to the author. Recommended: keep.
11. **E1816 deletes a `ThemeSelect` with no theme to pick.** The other choice, adding a theme to `tokens.ts`, would invent a design. Recommended: keep.
12. **Colors ship in Keel's own forms** (second breaking review). A color outside sRGB ships as Keel's mapped sRGB value and, on a P3 screen, a P3 value; a screen wider than P3 shows the P3 value. A designer's out-of-P3 `oklch()` never reaches a screen as written. Recommended: keep; it is the one way the judged ratio is the shown ratio.
13. **The minifier.** Lightning CSS rewrites colors whatever its targets (`hsl()` to hex, `rgb(... / 0.95)` to `#...f2`, a display-p3 value to a hex fallback with `@supports`), and a PostCSS plugin may too. Recommended: the Vite plugin gives esbuild's minifier (which keeps every form and value) to a build that sets none, and each browser build verifies its emitted CSS against the compiled CSS, failing with E1819 (k.gamut CSS); a project's own `cssMinify`, `css.transformer` or PostCSS config is kept, never refused, and fails only when what it wrote differs. The check reads the output as written, whole: each judged declaration must be found where Keel put it, no other `--k-*` declaration may sit in a `.css` file, and no Keel color declaration in JavaScript or HTML, so inlining Keel's stylesheet into JavaScript (a css-injected-by-js plugin) is refused, not verified. A `cssTarget` older than `color()` gets the P3 blocks under a Keel-written `@supports`; reverse it by refusing such a target instead.

# k.values: Token values
status: proposed

`TokenSchema` (k.ui) takes a token value only in the form its group defines below, so no value can end a declaration, open a string or reach outside the stylesheet. The forms are positive: anything a group's form does not produce is refused.

**Forms.** `<n>` is a decimal number (`0`, `1.5`, `-2`); `<length>` is `0` or `<n>` followed by one of `px`, `rem`, `em`, `%`, `vw`, `vh`, `ch`; `<ref>` is `var(--k-color-<name>)`, the custom property (k.ui, k.looks Names) of a color token the same tokens hold. Words are separated by single spaces. A `<color>` is opaque, one of:
- `#` and 3 or 6 hex digits;
- `rgb(<c> <c> <c>)`, each `<c>` an `<n>` from 0 to 255;
- `hsl(<h> <p> <p>)`, `<h>` an `<n>`, bare or followed by `deg`, and each `<p>` an `<n>` from 0 to 100 followed by `%`;
- `oklab(<l> <ab> <ab>)`, `<l>` an `<n>` from 0 to 1 or one from 0 to 100 followed by `%`, each `<ab>` an `<n>` from -0.5 to 0.5;
- `oklch(<l> <ch> <h>)`, `<ch>` an `<n>` from 0 to 0.5;
- `color(display-p3 <u> <u> <u>)`, each `<u>` an `<n>` from 0 to 1.

An `<alpha>` is `#` and 4 or 8 hex digits, or one of the function forms with ` / <a>` before its `)`, `<a>` an `<n>` from 0 to 1 or one from 0 to 100 followed by `%`. So no named color, comma, `none`, `calc()` or relative color is a form.

| group | a value is |
| --- | --- |
| `color` | `<color>`, or a `{ light, dark }` pair of them |
| `overlay` | `{ value, over }`: `value` an `<alpha>` or a `{ light, dark }` pair of them, `over` a list of 1 to 8 distinct names of color tokens the tokens hold |
| `space` | `<length>` or `auto` |
| `size` | `<length>`, `auto`, `min-content`, `max-content` or `fit-content` |
| `radius` | `<length>` |
| `font` | families joined by `, `: each a run of letters, digits, `-` and spaces, or a string in `"` or `'` holding no quote, backslash or line break |
| `fontSize` | `<length>` |
| `weight` | an integer from 1 to 1000, `normal` or `bold` |
| `shadow` | `none`, or 1 to 4 shadows joined by `, `: each optional `inset`, then 2 to 4 `<length>`s, then an optional `<color>`, `<alpha>` or `<ref>` |
| `border` | `0`, `none`, or a `<length>`, then one of `solid`, `dashed`, `dotted`, `double`, then a `<color>` or `<ref>` |
| `breakpoint` | `<n>` followed by `px`, `em` or `rem` |
| `motion` | `<n>` followed by `ms` or `s` |

So `url(...)`, a `var(...)` of any property but a held color token's, `!important`, a backslash, a quote outside `font` and an unclosed bracket are each refused. A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `value` or `over` after it for an overlay, then `light` or `dark` for a pair; under `themes.<theme>.` in a theme): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks).

**Stylesheet.** Every value a form admits makes a declaration the browser keeps, so the compiled CSS file loses no rule to a token.

**Overlays.** An overlay token is a color with alpha and the opaque colors it may sit on. `bg` and `fg` take an overlay's name as they take a color's (k.a11y-static Token names), and its custom property is `--k-overlay-<name>`. Contrast is judged on the overlay composited over each `over` color (k.a11y-static Combinations); a color with alpha anywhere else but a `shadow` is refused. An `over` naming anything but a color token the same tokens hold (an overlay among them) fails `TokenSchema` at `overlay.<name>.over`, so `keel check` reports E1807 at `tokens.ts` line 1, column 1 (k.a11y-static Tokens) and judges no element; a backdrop an element's chain finds that `over` does not hold is E1817, from `keel check` only, at the opening quote of the overlay's literal (k.a11y-static Overlays), and the render check composites over the painted backdrop and reports no E1817.

**Contrast.** Every `<color>` has one luminance, computed exactly: hex and `rgb()` are sRGB, `hsl()` becomes sRGB by CSS Color 4's `hslToRgb`, each linearised as WCAG 2 linearises; `oklab()`, `oklch()` (its hue in degrees) and `color(display-p3 ...)` (CSS Color 4's transfer function) become linear sRGB through CSS Color 4's matrices; the luminance is `0.2126 R + 0.7152 G + 0.0722 B`, clamped to 0 to 1. A color outside the sRGB gamut, a linear channel below 0 or above 1 by more than 0.000001, is judged as given and again after CSS Color 4's gamut mapping to sRGB (the OKLCH chroma search with JND 0.02 and epsilon 0.0001), and the lower ratio stands, so a pair holds on an sRGB screen and on a wider one. An `<alpha>` over a backdrop is `a × c + (1 - a) × b` on each encoded sRGB channel of the overlay, mapped to sRGB first, and the backdrop, as browsers blend.

**Themes.** `themes` in `tokens.ts` (k.schemes) maps a name to a theme: an optional `when` and any of the groups `color`, `overlay`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow` and `border`, each holding only names its top-level group holds, each value in its group's form, an overlay's as its `value` with no `over`. `when` is `choice` (the default: a visitor picks it), `contrast` (on under `prefers-contrast: more`) or `print` (on when printing; it holds no pair). A name is a letter from `a` to `z` then up to 23 letters and digits, not `default`, `system`, `light` or `dark`. At most one theme is `contrast`, at most one is `print`, and at most 8 are `choice`. Anything else fails `TokenSchema` (E1807). `breakpoint`, `motion`, `base` and `look` take no theme: a media query reads no custom property, and a theme changes values, never classes.

**Library themes.** A library's shipped object (k.looks Shipped tokens) may hold `themes` with the keys `contrast` and `print` only, each a theme with no `when` holding names its own groups hold; any other key is E1812 `<id>Tokens holds themes "<key>"; only contrast and print`. The app's `contrast` theme holds every name the shipped `contrast` holds, and its `print` theme every name of the shipped `print`, else E1810 `<name> needs themes.<theme> <group> "<token>"; spread <id>Tokens.themes.<key>.<group>`, whose fix adds that spread to the theme's group as k.looks Fix adds one to a group. A `choice` theme takes the library's top-level values; the app may re-value an `<id>.` name in it, held as a top-level key is (E1813). In a library's own folder, a shipped `contrast` or `print` is judged as a theme of that `when`, whatever the root `tokens.ts` writes.

**Conformance.**
- `TokenSchema` refuses with rule `format` at that path each of `font: { a: '"Inter var, sans-serif' }`, `color: { a: '"oops' }`, `color: { a: 'rgb(1,2,3' }`, `color: { a: 'red\\' }`, `color: { a: 'red' }`, `color: { a: '#12345' }`, `space: { a: '1px !important' }`, `size: { a: 'url(x.png)' }`, `border: { a: '1px solid var(--x)' }` and `motion: { a: '120' }`.
- `TokenSchema` accepts `brandTokens`, `space: { a: '-2rem' }`, `size: { a: 'fit-content' }`, `font: { a: "'Inter var', sans-serif" }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 1px 2px #000000' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`.
- `border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one.
- A shipped `acmeTokens` holding `font: { 'acme.f': '"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`.
- In Chromium, the CSS file compiled from `brandTokens` and from tokens holding one value of each form in the table, every group used by a style prop, parses as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, and each rule holds every declaration it was emitted with.
- `TokenSchema` accepts as a color each of `rgb(184 66 13)`, `hsl(19deg 87% 39%)`, `oklab(0.54 0.12 0.1)`, `oklch(54% 0.16 40)` and `color(display-p3 0.67 0.29 0.1)`, and refuses with rule `format` each of `rgb(184, 66, 13)`, `rgb(300 0 0)`, `oklch(54% 0.16 40 / 0.5)`, `white`, `oklch(none 0 0)` and `rgb(from #000 r g b)`.
- `shadow: { a: '0 1px 2px rgb(0 0 0 / 0.2)' }` and `overlay: { scrim: { value: '#1a191e99', over: ['card'] } }` with a color token `card` are accepted; `overlay: { scrim: { value: '#1a191e', over: ['card'] } }`, one with `over: []`, and one with `over: ['nope']` are each refused with rule `format`, the last at `overlay.scrim.over`.
- With color tokens `a` `oklch(0.72 0.14 45)` and `b` `#141317`, `<Text fg="a" bg="b">x</Text>` reports no E1804, and with `a` `color(display-p3 0 0 1)` and `b` `#000000` it reports one whose message holds `2.44:1`, the ratio after mapping to sRGB, which is below the 2.59:1 of the color as given.
- `themes: { slate: { color: { text: '#222222' } } }` is accepted with a color token `text`; each of `themes: { light: {} }`, `themes: { a: { when: 'hover' } }`, `themes: { a: { color: { nope: '#000000' } } }`, `themes: { a: { breakpoint: { md: '1px' } } }`, `themes: { a: { look: {} } }`, `themes: { a: { when: 'print', color: { text: { light: '#000000', dark: '#ffffff' } } } }`, two themes with `when: 'print'` and nine themes with no `when` fails `TokenSchema`, each one E1807 in `tokens.ts`.
- In the k.looks fixture with `acmeTokens` also holding `themes: { contrast: { color: { 'acme.accent': '#08427D' } } }` and the app's `tokens.ts` adding `themes: { hc: { when: 'contrast', color: {} } }`, `keel check` reports one E1810 with message `@acme/ui needs themes.hc color "acme.accent"; spread acmeTokens.themes.contrast.color`; after its fix, none, and the CSS's `keel.contrast` layer declares `--k-color-acme-accent:#08427D`; a shipped `themes: { slate: {} }` is one E1812 with message `acmeTokens holds themes "slate"; only contrast and print`.

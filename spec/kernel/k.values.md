# k.values: Token values
status: proposed

`TokenSchema` (k.ui) takes a token value only in the form its group defines below, so no value can end a declaration, open a string or reach outside the stylesheet. The forms are positive: anything a group's form does not produce is refused.

**Forms.** `<n>` is a decimal number (`0`, `1.5`, `-2`); `<length>` is `0` or `<n>` followed by one of `px`, `rem`, `em`, `%`, `vw`, `vh`, `ch`; `<color>` is `#` and 3 or 6 hex digits; `<ref>` is `var(--k-color-<name>)`, the custom property (k.ui, k.looks Names) of a color token the same tokens hold. Words are separated by single spaces.

| group | a value is |
| --- | --- |
| `color` | `<color>`, or a `{ light, dark }` pair of them |
| `space` | `<length>` or `auto` |
| `size` | `<length>`, `auto`, `min-content`, `max-content` or `fit-content` |
| `radius` | `<length>` |
| `font` | families joined by `, `: each a run of letters, digits, `-` and spaces, or a string in `"` or `'` holding no quote, backslash or line break |
| `fontSize` | `<length>` |
| `weight` | an integer from 1 to 1000, `normal` or `bold` |
| `shadow` | `none`, or 1 to 4 shadows joined by `, `: each optional `inset`, then 2 to 4 `<length>`s, then an optional `<color>` or `<ref>` |
| `border` | `0`, `none`, or a `<length>`, then one of `solid`, `dashed`, `dotted`, `double`, then a `<color>` or `<ref>` |
| `breakpoint` | `<n>` followed by `px`, `em` or `rem` |
| `motion` | `<n>` followed by `ms` or `s` |

So `url(...)`, a `var(...)` of any property but a held color token's, `!important`, a backslash, a quote outside `font` and an unclosed bracket are each refused. A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks).

**Stylesheet.** Every value a form admits makes a declaration the browser keeps, so the compiled CSS file loses no rule to a token.

**Conformance.**
- `TokenSchema` refuses with rule `format` at that path each of `font: { a: '"Inter var, sans-serif' }`, `color: { a: '"oops' }`, `color: { a: 'rgb(1,2,3' }`, `color: { a: 'red\\' }`, `color: { a: 'red' }`, `color: { a: '#12345' }`, `space: { a: '1px !important' }`, `size: { a: 'url(x.png)' }`, `border: { a: '1px solid var(--x)' }` and `motion: { a: '120' }`.
- `TokenSchema` accepts `brandTokens`, `space: { a: '-2rem' }`, `size: { a: 'fit-content' }`, `font: { a: "'Inter var', sans-serif" }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 1px 2px #000000' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`.
- `border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one.
- A shipped `acmeTokens` holding `font: { 'acme.f': '"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`.
- In Chromium, the CSS file compiled from `brandTokens` and from tokens holding one value of each form in the table, every group used by a style prop, parses as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, and each rule holds every declaration it was emitted with.

# k.values: Token values
status: proposed

`TokenSchema` (k.ui) takes a token value only in the form its group defines below. The forms are positive: what a form does not produce is refused. Each form is chosen so that a CSS tokenizer reads the value as exactly the tokens the form names, and so that the property it reaches takes effect.

**Characters.** Outside a quoted string a value holds only the ASCII characters its form names: letters, digits, `_`, `.`, `%`, `#`, `-`, `+`, `*`, `/`, `,`, `(`, `)` and single spaces between tokens, with none leading or trailing. A quoted string (`font` only) opens and closes with the same `"` or `'` and holds any code point but that quote, a backslash, a control character (U+0000 to U+001F, U+007F to U+009F) and a lone surrogate. So no value holds an escape, a newline, a form feed, a null or a comment opener.

**Numbers and lengths.** `<n>` is digits with an optional `.` and digits (`0`, `1.5`; not `.5`), with no sign and no exponent. `<unit>` is one of `px`, `cm`, `mm`, `q`, `in`, `pt`, `pc`; `em`, `rem`, `ex`, `rex`, `cap`, `rcap`, `ch`, `rch`, `ic`, `ric`, `lh`, `rlh`; `vw`, `vh`, `vi`, `vb`, `vmin`, `vmax`, each also with the prefix `s`, `l` or `d` (`dvh`); `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`. `<length>` is `0` or `<n><unit>`; `<lp>` is a `<length>` or `<n>%`. `<env>` is `env(safe-area-inset-top)`, with `right`, `bottom` or `left` in place of `top`, optionally followed by `, <length>` inside the brackets. `<math>` is `calc(<sum>)`, `min(<sum>, <sum>)`, `max(<sum>, <sum>)` (two to four arguments) or `clamp(<sum>, <sum>, <sum>)`. A `<sum>` is terms joined by ` + ` or ` - `, each a length side, and a term is factors joined by ` * ` or ` / `, with exactly one length side per term and a `/` followed by a non-zero `<n>`. A factor is an `<lp>`, an `<n>`, an `<env>`, a `<math>` or a `(<sum>)`. Brackets nest at most four deep and a value holds at most 32 numbers, lengths and names. A `<math>` the browser computes below a property's range is clamped there by the browser, so it still takes effect.

**Colors.** `<color>` is `#` and 3 or 6 hex digits; `<ref>` is `var(--k-color-<name>)`, the custom property (k.ui, k.looks Names) of a color token the same tokens hold; `<paint>` is a `<color>`, a `<ref>` or `currentColor`. A `<color>` holds no alpha.

| group | a value is |
| --- | --- |
| `color` | `<color>`, or a `{ light, dark }` pair of them |
| `space` | an `<lp>`, `auto`, an `<env>` or a `<math>` |
| `size` | an `<lp>`, `auto`, `min-content`, `max-content`, `fit-content`, an `<env>` or a `<math>` |
| `radius` | an `<lp>` or a `<math>` |
| `font` | one to eight families joined by `, `: a quoted string, or one or more words joined by single spaces, each a letter or `_` then letters, digits, `_` and `-`, none of `inherit`, `initial`, `unset`, `revert`, `revert-layer` and `default` |
| `fontSize` | a `<length>`, `<n>%` or a `<math>` |
| `weight` | an integer from 1 to 1000, `normal` or `bold` |
| `shadow` | `none`, or one to four shadows joined by `, `: an optional `inset `, then two to four lengths, the first two and the fourth `<length>` or `-` and a `<length>`, the third a `<length>`, then an optional ` <paint>` |
| `border` | `0`, `none`, or a width (`<length>`, `thin`, `medium`, `thick`), one of `solid`, `dashed`, `dotted`, `double`, and a `<paint>` |
| `breakpoint` | `<n>` above 0 followed by `px`, `em` or `rem` |
| `motion` | `<n>` followed by `ms` or `s` |

A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks). Refused, and why: `url(...)` and `image-set(...)` reach outside the stylesheet; a `var(...)` of anything but a held color token can hold anything; `!important` and the CSS-wide keywords change the cascade, not the value; a negative literal is dropped by `padding`, `gap`, `border-radius`, `font-size`, widths, blurs, durations and media queries; `none` and `%` for a width that `w`, `h` and `border` ignore. A `space` token whose value is `auto` is in no group of `p`, `px`, `py` and `gap`, which ignore it (E1801 at the use, k.a11y-static Token names).

**What check judges.** Contrast (k.a11y) takes a `fontSize` at its smallest: a `<length>` in `px`, `pt`, `rem` or `em` (16px to the `rem` and `em`) as written, a `clamp()` at its first argument when that is such a length, and any other value as normal text. Contrast and `base.focus` judge `<color>` and `<ref>` values; a `currentColor` border or shadow is not judged.

**Stylesheet.** Each value a form admits gives a declaration the browser keeps and computes to a value other than the property's initial one, unless it is written as that value (`0`, `normal`). No part of the value forms ships in a client bundle: they run in `keel check`, `keel build`, `keel dev` and `defineTokens` under Node.

**Conformance.**
- `TokenSchema` refuses with rule `format` at that path each of `font: { a: '"Inter var, sans-serif' }`, `font: { a: '"a\fb"' }`, `font: { a: '"a\u0000b"' }`, `font: { a: '"a\ud800"' }`, `font: { a: '3M Sans' }`, `font: { a: 'inherit' }`, `color: { a: '"oops' }`, `color: { a: 'rgb(1,2,3' }`, `color: { a: 'red\\' }`, `color: { a: 'red' }`, `color: { a: '#12345' }`, `space: { a: '1px !important' }`, `space: { a: '-2rem' }`, `space: { a: 'calc(1px+2px)' }`, `space: { a: 'calc(1px * 2px)' }`, `space: { a: 'calc(1px / 0)' }`, `size: { a: 'url(x.png)' }`, `size: { a: 'none' }`, `border: { a: '1px solid var(--x)' }`, `border: { a: '10% solid #000000' }`, `fontSize: { a: '-1px' }`, `breakpoint: { a: '0px' }` and `motion: { a: '120' }`.
- `TokenSchema` accepts `brandTokens`, `space: { a: 'clamp(8px, 2vw + 4px, 24px)' }`, `space: { a: 'env(safe-area-inset-top, 0)' }`, `size: { a: '100dvh' }`, `size: { a: 'min(44rem, 100% - 32px)' }`, `size: { a: '50cqi' }`, `font: { a: '"Inter, var", sans-serif' }`, `font: { a: '"3M Sans", serif' }`, `fontSize: { a: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)' }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 -1px 2px #000000' }`, `border: { a: '1px solid currentColor' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`.
- `border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one.
- A shipped `acmeTokens` holding `font: { 'acme.f': '"Inter' }` is one E1812 with message `acmeTokens fails TokenSchema at font.acme.f`.
- With `space: { a: 'auto' }`, `<Box p="a" />` is one E1801 at the literal and `<Box mx="a" />` is none.
- With `fontSize: { big: 'clamp(24px, 3vw, 40px)' }` and color tokens `low` `#787878` and `bg` `#ffffff`, `<Box bg="bg" fontSize="big"><Text fg="low">x</Text></Box>` reports no E1804, and with `fontSize: { big: 'min(24px, 3vw)' }` it reports one.
- In Chromium, the cases are generated from the forms (each unit; each keyword; each math function at two, three and four arguments; nesting at four and at five; 32 and 33 names; a family list at one and eight; inside and outside a string, each of `"`, `'`, `\`, each control character and a lone surrogate): every case `TokenSchema` accepts, set on an element through the property its group's props write, reads back from `style` as a non-empty value and gives a computed value other than the initial one unless written as it, and every generated case the forms do not produce is refused.
- In Chromium, the CSS file compiled from `brandTokens` and from tokens holding one generated case per form, every group used by a style prop, parses as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, each rule holding every declaration it was emitted with.
- `keel build`'s client JavaScript for a project with `brandTokens`, one scheme and no library holds none of the strings `safe-area-inset`, `cqmin`, `revert-layer` and `[aria-pressed="true"]`.

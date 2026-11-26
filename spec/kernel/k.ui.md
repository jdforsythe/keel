# k.ui: Tokens and styling
status: conformance-covered
**Tokens.** `tokens.ts` at the project root, validated by `TokenSchema` from `@keel/ui`:
```ts
export const tokens = defineTokens({
  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },
  space: { 1: '4px', 2: '8px', 3: '16px' },
  fontSize: { sm: '14px', md: '16px', lg: '24px' },
  breakpoint: { md: '768px' }, motion: { fast: '120ms' },
})
```
Groups are closed: `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border` (shorthands such as `1px solid var(--k-color-divider)`), `breakpoint`, `motion`, `overlay` (k.values), `base`, `look`; beside them `schemes` and `themes` (k.schemes). A name may be a library's, `<id>.<name>` (k.looks). `base` holds optional style sets `page`, `heading`, `link`, `button`, `control`, `label`, `fieldError`, `summary` (style props with `states`, token names checked as at a use, E1801) and `focus`, a color token. `look` maps a name to such a set; a look names no look. A color is a value or `{ light, dark }`, one per scheme (k.schemes). Motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Frame` (k.origins), `Input`, `TextArea`, `Select`, `Checkbox`, `SchemeSelect` (k.schemes). `Input`, `TextArea`, `Select` and `Checkbox` take `styles` with parts `field` (the wrapper), `label` and `error` (k.aria part styles); style props stay on the control. Required a11y props, `autocomplete` and contrast: k.a11y. Stdlib widget parts and their `styles`: k.aria. Every base element takes `lang`, written as its `lang` attribute. `Text role` takes `status` or `alert`, written as the attribute: a live region (WCAG 4.1.3), announced when its children change, so it is rendered from the first render (empty if need be) and its children change; a `status` region inserted holding text is not announced (E1826, k.a11y). `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). Event props are a closed set: `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs. A prop given as a getter (compiled JSX passes each non-literal value as one) updates what it writes as its reads change; `as`, `level`, `role` (`Text`, `Host`), `scroll`, `field`, `children`, event props `look` and an id derived from `label` are read at build. A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input), so server HTML shows it. Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written. A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime). An eager `Node` child is made first, so its island re-renders (E1253; check E1808).

**Style props** are the only styling: no `class` prop, no `styles()`. Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap textAlign breakBefore breakAfter breakInside`. Types take a `TokenName` (an identifier or short numeric key: `16px` and `#fff` are type errors); a token name the project's tokens lack is E1801, judged by `keel check` (k.a11y-static Token names). Responsive values are keyed by breakpoint, and by `print`; `media` and `breakBefore`, `breakAfter`, `breakInside`: k.aria Print. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object, so `disabled` stays the boolean attribute.
```tsx
<Box as="section" p={{ base: '2', md: '3' }} bg="bg" states={{ hover: { bg: 'accent' } }}>
  </Box>
```
The compiler emits one atomic class per (prop, token, breakpoint, state), deduplicated across the app, into one CSS file. `direction`, `align`, `justify` and `wrap` make the element flex. `textAlign` takes `start`, `center` or `end`, the inline start and end of the element's writing direction: `end` is the right edge in `ltr` text and the left in `rtl`, so a numeric column takes `end` in every locale; there is no `left` or `right`. `gap` spaces a flex element's children, so `gap` needs a `direction` at or below its smallest breakpoint (a computed `direction` counts), on an element, a look or a `base` set (E1809). `w` and `h` size the border box. An element with `hidden` is not displayed whatever its style props. `look="<name>"` on a base element or `Part`, or in a part style, applies that `look` set's classes; the element's own props replace the set's per prop and state; a missing look is E1801 likewise.

**Scroll regions.** `Box scroll="x"` is a scroll region: content wider than the box scrolls inside it, and the page keeps its width. It renders a `div` with `role="region"`, `tabindex="0"` (a keyboard reaches it and scrolls it with the arrow keys) and its name from `label` (`aria-label`) or `labelledBy` (`aria-labelledby`), exactly one of the two (E1802, k.a11y). It takes no `as`. `"x"` is the one value.
```tsx
<Box scroll="x" label="Prices"></Box>
```

**Base.** The compiled CSS file holds, after the custom properties, a `keel.base` cascade layer: `[hidden]{display:none!important}`, `body` with `overflow-wrap: anywhere` `table` with `break-word` (a column keeps its words whole), `th` with `text-align: inherit` (a header cell aligns as the cells of its row, at the start unless a `textAlign` says otherwise), `.k-scroll` with `overflow-x: auto` and `min-width: 0` (a scroll region in a flex row shrinks to its container), the summary's list unmarked, then each `base` set on its role (`page` on `body`; `heading`, `link`, `button` on `Heading`, `Link`, `Button`; `control` on `Input`, `TextArea`, `Select`; `label` and `fieldError` on a control's label and error; `summary` on the no-script summary, k.forms), its `states` under the role selector, and with `base.focus` a 2px solid outline in that color at 2px offset on `:focus-visible`. Atomic rules are unlayered, so a style prop wins over the base. Base elements carry their role class whatever the tokens (`k-heading`, `k-link`, `k-button`, `k-control`, `k-label`, `k-error`; `k-scroll` on a scroll region). Tokens with no `base` give no role rules.

**Standard slots.** JSX children are the default slot and arrive as `props.children` (k.component); base elements accept a thunk or a plain string/Node. `loading: () => JSX`, `empty: () => JSX`, `error: (e: KeelError) => JSX`. These names carry these signatures everywhere; `For` accepts `empty`.

**Rules.** E1801 raw value where a token is required (fix: nearest token), or a token the tokens lack · E1803 `style` attribute · E1805 lowercase intrinsic element in app code (fix: matching base element) · E1806 standard slot name with another signature · E1807 `tokens.ts` fails `TokenSchema` · E1808 base element `children` made eagerly (an element call or JSX, or an array or `const` of them) (fix: `() =>`) · E1809 `gap` with no `direction` (fix: `direction="column"`). E1802 and E1804: k.a11y.

**E1808's message.** `<base> children made before it; pass a thunk` (`Box`: 41 units).

**Conformance.**
- Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once.
- `p={{ base: '2', md: '3' }}` yields the `2` rule unconditioned and the `3` rule inside `@media (min-width: 768px)`.
- Under `prefers-reduced-motion: reduce` every motion token resolves to `0ms`.
- Every base element rendered with only its required props has no axe violations.
- Two `Box as="nav"` with distinct `label`s pass axe; a `nav` without one is E1802.
- A signal bound to a style prop changes only the element's class list; no element ever has a `style` attribute.
- `fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it.
- `Image src` accepts a string such as `'logo.png'` (no `Href` required); a `javascript:` value renders as `about:blank`.
- `fire(id, 'click')` on a Button with `onClick` calls the handler once; `fire(id, 'change')` on a Checkbox with `onChange` passes the new checked state.
- An `Input`, `TextArea`, `Select` or `Checkbox` given a signal for `value` or `checked` shows its first value in the markup; a later signal write changes only the property.
- `@keel/ui` exports no `styles`; no base element takes `class`; `Button` has no `label`, its children are its text.
- An `Input` bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default.
- A route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry, and resume adopts its server nodes without E1253 when children are thunks; a route of base elements with no event prop, `field` or signal has no `data-k`.
- A base element given `lang="ja-JP"` has `lang="ja-JP"` in server and client output; without it, none.
- A getter `label` over a signal on an `Input`, `Select`, `TextArea`, `Checkbox` and `Box as="nav"` shows each write on the same element.
- `Text role="status"` and `Text role="alert"` write that `role` attribute in server and client output; a `Text` without `role` writes none; any other `role` is a type error.
- A `Part` with `hidden` and `direction="column"` is not displayed: the CSS holds `[hidden]{display:none!important}` before the atomic rules.
- An `Input` with `w="full" px="2" border="control"` in a 320px container is 320px wide in Chromium; the `w` rule declares `box-sizing:border-box`.
- `<Box gap="2">` with no `direction` is E1809 and its fix adds `direction="column"`; with `direction={{ base: 'column', md: 'row' }}`, or a look that sets `direction`, it is clean and is a row at 1024px; `gap={{ base: '2' }}` with `direction={{ md: 'row' }}` is E1809.
- With tokens `base.page { fg: 'fg', bg: 'bg' }` and no style props on the page, `body`'s computed color and background are the tokens'; a `fg` at a use wins.
- `<Button look="primary" px="1">` has the look's classes for every prop but `px`, and `k-px-1`; `look="nope"` is E1801.
- `styles={{ label: { fg: 'accent' }, error: { fg: 'error' } }}` on an `Input` with a `field` puts those classes on its `<label>` and its error element.
- A 200-character unbroken string in a 320px `Box` keeps the document 320px wide.
- `textAlign="end"` on a `Part role="cell"` compiles to one rule declaring `text-align:end` and no `display`; `textAlign={{ base: 'start', md: 'end' }}` puts the `end` rule inside the `md` media block; `textAlign="right"` is E1801.
- The `keel.base` layer holds `th{text-align:inherit}` and `.k-scroll{overflow-x:auto;min-width:0}` with any tokens, `brandTokens` and tokens with no `base` alike.
- `<Box scroll="x" label="Prices">` renders a `div` with `role="region"`, `tabindex="0"`, `aria-label="Prices"` and class `k-scroll`, in server and client output, and has no axe violations holding a `table`; `labelledBy="t"` writes `aria-labelledby="t"` and no `aria-label`; a `Box` without `scroll` writes none of these.
- `scroll` with `as`, `scroll="y"`, and `scroll="x"` with neither or both of `label` and `labelledBy` are type errors.
- In a project with no `tokens.ts`, `<Box p="2" direction="column">` is one E1801 at `"2"` and none at `"column"`; with `brandTokens`, `<Text fg="nope">x</Text>` is one E1801 at `"nope"` and `<Text fg="text">x</Text>` none.

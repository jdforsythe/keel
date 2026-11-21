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
Groups are closed: `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border` (shorthands such as `1px solid var(--k-color-divider)`), `breakpoint`, `motion`. A color is a value or `{ light, dark }`, chosen by `prefers-color-scheme`. Motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Frame` (k.origins), `Input`, `TextArea`, `Select`, `Checkbox`. Required a11y props, `autocomplete` and contrast: k.a11y. Stdlib widget parts and their `styles`: k.aria. Every base element takes `lang`, written as its `lang` attribute. `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). Event props are a closed set: `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs. A prop given as a getter (compiled JSX passes each non-literal value as one) updates what it writes as its reads change; `as`, `level`, `role` (`Host`), `field`, `children`, event props and an id derived from `label` are read at build. A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input), so server HTML shows it. Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written. A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime). An eager `Node` child is made first, so its island re-renders (E1253; check E1808).

**Style props** are the only styling: no `class` prop, no `styles()`. Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap`. Types take a `TokenName` (an identifier or short numeric key: `16px` and `#fff` are type errors); a missing token is E1801. Responsive values are keyed by breakpoint. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object, so `disabled` stays the boolean attribute.
```tsx
<Box as="section" p={{ base: '2', md: '3' }} bg="bg" states={{ hover: { bg: 'accent' } }}>
  </Box>
```
The compiler emits one atomic class per (prop, token, breakpoint, state), deduplicated across the app, into one CSS file.

**Standard slots.** JSX children are the default slot and arrive as `props.children` (k.component); base elements accept a thunk or a plain string/Node. `loading: () => JSX`, `empty: () => JSX`, `error: (e: KeelError) => JSX`. These names carry these signatures everywhere; `For` accepts `empty`.

**Rules.** E1801 raw value where a token is required (fix: nearest token) · E1803 `style` attribute · E1805 lowercase intrinsic element in app code (fix: matching base element) · E1806 standard slot name with another signature · E1807 `tokens.ts` fails `TokenSchema` · E1808 base element `children` made eagerly (an element call or JSX, or an array or `const` of them) (fix: `() =>`). E1802 and E1804: k.a11y.

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

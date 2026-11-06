# k.ui: Tokens and styling
status: implemented

**Tokens.** `tokens.ts` at the project root, validated by `TokenSchema` from `@keel/ui`:
```ts
export const tokens = defineTokens({
  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },
  space: { 0: '0', 1: '4px', 2: '8px', 3: '16px' }, radius: { 1: '4px' },
  font: { body: 'system-ui' }, fontSize: { sm: '14px', md: '16px', lg: '24px' },
  breakpoint: { md: '768px' }, motion: { fast: '120ms' },
})
```
Groups are closed: `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `breakpoint`, `motion`. A color is a value or `{ light, dark }`, chosen by `prefers-color-scheme`. Motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `TextArea`, `Select`, `Checkbox`. Required a11y props are in the type: `Heading level`; `Image alt` or `decorative`; `label` on `Input`, `TextArea`, `Select`, `Checkbox`; `Link to: Href` with text; `Button` text or `label`. `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). Event props are a closed set (RFC 0009): `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs.

**Style props.** Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow direction align justify wrap`. Types accept any string shaped like a token name (`TokenName`: an identifier or short numeric key, so `16px` and `#fff` are type errors); whether the token exists is E1801, reported by `check`. Responsive values are keyed by breakpoint. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object; this keeps `disabled` free as the boolean attribute on form controls and `Button`.
```tsx
<Box as="section" p={{ base: '2', md: '3' }} bg="bg" states={{ hover: { bg: 'accent' } }}>
  <Heading level={2}>Orders</Heading>
</Box>
```
The compiler emits one atomic class per (prop, token, breakpoint, state), deduplicated across the app, into one CSS file. Dynamic values switch classes; no inline style is generated.

**Scoped styles.** `const css = styles({ card: { p: '3', radius: '1' } })` in a component file, applied with `class={css.card}`. Same vocabulary, same atomic output, file-local.

**Standard slots.** JSX children are the default slot and arrive as `props.children` (k.component); base elements accept a thunk or a plain string/Node. `loading: () => JSX`, `empty: () => JSX`, `error: (e: KeelError) => JSX`. These names carry these signatures everywhere; `For` accepts `empty`.

**Rules.** E1801 raw value where a token is required (fix: nearest token) · E1802 missing a11y-required prop · E1803 `style` attribute or exported `styles` · E1804 an element setting `fg` and `bg` below 4.5:1 contrast (3:1 at `fontSize` >= 24px), checked per color scheme · E1805 lowercase intrinsic element in app code (fix: matching base element) · E1806 standard slot name with another signature · E1807 `tokens.ts` fails `TokenSchema`.

**Conformance.**
- Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once.
- `p={{ base: '2', md: '3' }}` yields the `2` rule unconditioned and the `3` rule inside `@media (min-width: 768px)`.
- Under `prefers-reduced-motion: reduce` every motion token resolves to `0ms`.
- Every base element rendered with only its required props has no axe violations.
- A signal bound to a style prop changes only the element's class list; no element ever has a `style` attribute.
- `fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it.
- `fire(id, 'click')` on a Button with `onClick` calls the handler once; `fire(id, 'change')` on a Checkbox with `onChange` passes the new checked state.

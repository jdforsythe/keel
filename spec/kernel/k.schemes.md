# k.schemes: Color schemes
status: proposed

An app has a light scheme, a dark scheme or both. With both, the person's system preference picks one, a `SchemeSelect` lets them pick, and a server renders the pick on the first paint.

**Schemes.** `tokens.ts` takes an optional `schemes`: `['light']`, `['dark']` or `['light', 'dark']`; any other value is E1807 (k.ui). Without it, an app has both when one of its own color tokens (a name with no `.`, k.looks) is a `{ light, dark }` pair, else `['light']`. A pair gives one value per scheme and a string the same value in both; a pair's value for a scheme the app lacks is unused and never judged. In a library's own folder the root `tokens.ts` gives the schemes.

**CSS.** The compiled CSS (k.ui) opens with the custom properties:
- one scheme: `:root` declares `color-scheme:<scheme>` and each pair's value for that scheme;
- both: `:root` declares `color-scheme:light dark` and the light values; then `@media (prefers-color-scheme: dark){:root:not([data-k-scheme="light"]){<dark>}}`; then `:root[data-k-scheme="dark"]{color-scheme:dark;<dark>}` and `:root[data-k-scheme="light"]{color-scheme:light}`, `<dark>` each pair's dark value.

So the system preference applies until `<html>` carries `data-k-scheme`, which wins over it. Native controls and scrollbars follow `color-scheme`.

**Choice.** `SchemeSelect` from `@keel/ui` is the one control for a person's pick. It renders as `Select` (k.ui) does, with the options `system`, `light` and `dark` in that order, their words from `labels: { system, light, dark }`, named by exactly one of `label` and `labelledBy` (E1802), with `Select`'s style props and `styles`, role class `k-control` and `id`. Its value is `<html>`'s `data-k-scheme`, else `system`. Picking `light` or `dark` sets `data-k-scheme` to it and writes the cookie `keel-scheme=<value>; Path=/; Max-Age=31536000; SameSite=Lax`, with `; Secure` on https. Picking `system` removes the attribute and writes `keel-scheme=; Path=/; Max-Age=0; SameSite=Lax`. It is bound (`data-k`). The cookie holds one of two words and no identifier.

**First paint.** `keel build` and `keel dev` write the app's schemes as `schemes.json` (`{ "schemes": [...] }`) into each `node` deployable's artifacts folder, beside `routes.json` and `std.json`, and `createApp` reads it once from `artifacts`; with no file the server takes `['light']`. In an app with both schemes, a `node` deployable's document writes `data-k-scheme="<value>"` on `<html>` when the request's `keel-scheme` cookie is `light` or `dark`, and none for any other value. A `client` or `static` deployable whose modules render a `SchemeSelect` holds in each document's head, before its first stylesheet link, `<script src="/assets/keel-scheme-<hash>.js"></script>`: a classic script of at most 300 bytes that sets the attribute from the cookie before the body is parsed. `script-src 'self'` allows it and nothing is inline (k.security). A deployable that renders no `SchemeSelect`, and an app with one scheme, hold no scheme script. A `client` deployable builds to `dist/<name>/` with or without `servedBy` (k.hosting Artifact), its one document `index.html`.

**Checks.** Contrast (E1804; k.a11y, k.a11y-static) and the `base.focus` color (k.ui) are judged in each of the app's schemes and in no other. `SchemeSelect` in a project whose tokens have one scheme is E1814 at the element.

**Rules.** E1814 `SchemeSelect` with one scheme (message `SchemeSelect needs schemes light and dark; the tokens have <scheme> only`; fix: none).

**Conformance.**
- With color tokens `fg` `{ light: '#111111', dark: '#eeeeee' }` and `bg` `{ light: '#ffffff', dark: '#111111' }` and no `schemes`, the CSS's `:root` block declares `color-scheme:light dark` and `--k-color-fg:#111111`, a `@media (prefers-color-scheme: dark)` block holds `:root:not([data-k-scheme="light"])` declaring `--k-color-fg:#eeeeee`, and a `:root[data-k-scheme="dark"]` rule declares `color-scheme:dark` and `--k-color-fg:#eeeeee`.
- With those tokens and `schemes: ['light']`, the CSS's `:root` declares `color-scheme:light` and `--k-color-fg:#111111` and the CSS holds no `prefers-color-scheme` and no `data-k-scheme`; with `schemes: ['dark']`, `:root` declares `color-scheme:dark` and `--k-color-fg:#eeeeee`.
- `schemes: ['light', 'light']`, `schemes: ['sepia']` and `schemes: []` are each one E1807.
- With `brandTokens` composing a library's color `acme.x` `{ light: '#111111', dark: '#eeeeee' }` (k.looks) and no `schemes`, the CSS holds no `prefers-color-scheme`.
- With color tokens `fg` `{ light: '#111111', dark: '#787878' }` and `bg` `'#ffffff'`, `<Text fg="fg" bg="bg">x</Text>` is one E1804 with message `fg "fg" on bg "bg" is 4.42:1 in dark, needs 4.5:1`; with `schemes: ['light']` it is none.
- `<SchemeSelect id="scheme" label="Scheme" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />` renders a `select` with options of values `system`, `light`, `dark` and texts `System`, `Light`, `Dark`, value `system`, with no axe violations.
- After `fire('scheme', { type: 'change', value: 'dark' })`, `document.documentElement` has `data-k-scheme="dark"` and `document.cookie` holds `keel-scheme=dark`; after `fire('scheme', { type: 'change', value: 'system' })`, it has no `data-k-scheme` and `document.cookie` holds no `keel-scheme`.
- A `createApp` whose `artifacts` folder holds `schemes.json` `{ "schemes": ["light", "dark"] }` answers a document request sent with `Cookie: keel-scheme=dark` with `<html` carrying `data-k-scheme="dark"` and its `SchemeSelect` value `dark`; with `keel-scheme=blue`, with no cookie, with `{ "schemes": ["light"] }` or with no `schemes.json`, the document has no `data-k-scheme`.
- `keel build` of a `static` deployable, and of a `client` deployable, with both schemes whose page renders a `SchemeSelect` writes an `index.html` whose head holds a `<script src="/assets/keel-scheme-` before its first `<link rel="stylesheet"`, naming a file of at most 300 bytes; without the `SchemeSelect`, no `keel-scheme` script.
- With `tokens.ts` exporting `brandTokens`, a page rendering a `SchemeSelect` is one E1814 at the element with message `SchemeSelect needs schemes light and dark; the tokens have light only`.

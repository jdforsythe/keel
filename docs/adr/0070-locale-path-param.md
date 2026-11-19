# ADR-0070: the locale is a path param, with an optional unprefixed default (RFC 0079)

**Status:** accepted (2026-11-10), user decisions D4 to D7, under the WORKFLOW RFC defaults 1, 3 and 6.

**Context.** Formatted values and page text depend on a locale, which must be addressable, typed, and pinned by tests and session replay. `createApp` shares one `ctx` across requests, and loaders see no headers. A guard redirect drops the matched route's params. An app that adds a second locale would move every existing URL under a prefix.

**Decision.**
- An app declares its served locales once, as an `s.enum` of `i18n.Locale` tags in a `*.schema.ts` file. A route that shows text has the path `/:locale/...`; components, loaders and actions read `params.locale` and pass it as an argument.
- `s.enum(values, { pathDefault })` marks one served locale whose URLs carry no prefix. k.prefix is the codec: `routes.href` leaves that value's segment out, a URL without a locale segment parses as it, and its prefixed form answers 308 to the unprefixed URL. Types do not change: `params.locale` is always present, and a link without a locale does not compile. E1509 reports a route that could collide with the prefix (a static segment equal to a locale, another leading param, an unprefixed twin, a second prefix param), with a fix that prepends the prefix param.
- A guard redirect carries the matched route's same-name params; a missing one is E1508 (K4).
- Every k.ui base element takes `lang` (K3).
- The scaffold `project` template is born with the locale param and an unprefixed `en-US`, in a scaffold task after this batch.

**Alternatives.**
- `?locale=`, rejected: search keys are optional, so a link that omits it falls back to the default without a compile error, and the key is threaded by hand through redirects and form actions.
- A locale capability on `ctx`, a provider or a request store, rejected: action at a distance (principle 2), and tests and replay would pin the locale apart from the URL.
- `Accept-Language` negotiation, rejected for now: loaders see no headers, and one URL would render differently per client.
- A manifest-level prefix option, rejected: declared per module, away from the served locales.
- 404 for the prefixed default, rejected: it keeps one URL per page too, but breaks links made before the opt-in; the router already redirects a trailing slash.

**Consequences.**
- Every typed link passes a locale; switching locale is a `Link` to the same route with another value.
- k.prefix is a new kernel section (889 tokens); k.router gains pointers and K4 within its cap (1,499 tokens) and `@keel/router` is re-based to 9 kB.
- An app that adds a locale keeps its URLs when its first locale is the `pathDefault`.

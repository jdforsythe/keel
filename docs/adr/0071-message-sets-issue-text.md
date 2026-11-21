# ADR-0071: message sets are schemas loaded per route, and forms take issueText (RFC 0079)

**Status:** accepted (2026-11-10), user decisions D2, D8 and D9, under the WORKFLOW RFC defaults 3, 5 and 6.

**Context.** Page text must be translated with typed params and a closed key vocabulary, declared once (principle 4), with no provider or ambient locale (principle 2). Only the active locale's text may ship, a `client` deployable runs its loaders in the browser, and resume must keep the server's text. Form errors come from k.forms in fixed English.

**Decision.**
- `@keel/std-messages`: `messages(locales, keys, load)` in `<Set>.schema.ts` declares each key's params; one file per locale, `<Set>/<locale>.ts`, default-exports `Set.text({...})`. A message without params is a string; one with params is `{ text }`, `{ plural: p, ... }` or `{ select: p, cases }`, rendered by `formatMessage(message, params, locale)`, which goes through std-i18n `plural` and `formatNumber`. Each message is a format type (ADR-0068).
- Text travels as loader data: a loader returns `await Set.load(params.locale)`, whose dynamic import makes each locale file its own chunk. A static route level ships no message; an island ships one entry in `#k-state`.
- `@keel/std-messages/tools` registers E2401 to E2406: a missing locale file or malformed `load`, a missing translation, an undeclared key, an unused key, a placeholder that does not match its params, and literal copy in a component or `routes.ts` file. E2406 is an error.
- `form(schema, { issueText })` gives each field issue's text from the app's entry and locale; without it the kernel's English text applies (K5).

**Alternatives.**
- One file per set holding every locale, rejected: a `client` deployable would ship every locale, and splitting per locale would need a compiler transform.
- ICU MessageFormat strings, rejected: a 5 to 10 kB parser and a second string language TypeScript cannot check.
- Components importing message files, rejected: every locale would ship in every island bundle.
- English messages carried by each format type, rejected: they cover one rule and one language.

**Consequences.**
- Every route that shows text has a loader; a layout's loader parses its params, since a layout declares none.
- A missing translation has no fix: none can be derived.
- `@keel/std-messages` is about 1.2 kB gzip; its tools about 5 kB on node. k.forms grows to 1,279 tokens.

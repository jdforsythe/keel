# ADR-0069: ambient locale and time zone reads are E1758 (RFC 0079)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 1 and 6.

**Context.** `price.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(ms).getHours()` read the host's locale or time zone, so a server in UTC and a browser in Tokyo write two strings for one value (principle 10). E1601 catches ambient effects whose fix is a `ctx` call; a locale has no `ctx` equivalent, because the locale is route data passed as an argument.

**Decision.** k.check gains E1758, a source rule in the existing pipeline that resolves names as E1601 does (globals, literal computed keys, same-file aliases). It reports in app code: `navigator.language` or `languages`; an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale; an `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`; a local-time getter on a `new Date(...)` expression. It carries no fix: the locale or zone is an argument the caller holds.

**Alternatives.**
- Widening E1601 in k.ctx, rejected: one code would then name two kinds of fix, and k.ctx has 11 tokens of headroom.
- A rule in `@keel/std-i18n/tools`, rejected: it would run only in modules that list the package, while the defect exists in any app (default 6).
- Local-time getters on any `Date` value, rejected for now: finding them needs types, so only `new Date(...)` expressions are reported.

**Consequences.**
- No app in the repository reads a locale today, so E1758 reports nothing on upgrade.
- k.check reaches 1,499 tokens after trimming citations and a restated budget sentence; its next change needs a split.
- `@keel/check` crosses its 33 kB budget and is re-based to 34.5 kB with the measured bytes in the commit (default 7).

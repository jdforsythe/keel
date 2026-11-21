---
"@keel/std-messages": minor
---

Message sets (std.messages): `messages(locales, keys, load)` declares a set's keys and params in a `*.schema.ts` file; each locale file default-exports `Set.text({...})`, and `Set.load(locale)` imports and parses one locale's entry. `formatMessage(message, params, locale)` renders `{ text }`, `plural` and `select` messages through std.i18n `formatNumber` and `plural`. `@keel/std-messages/tools` registers E2401 to E2406.

---
name: keel-text
description: "Keel page text and locales: @keel/std-messages sets (messages, Set.load, formatMessage), route title, formatMoney/formatDate/formatDuration/formatNumber, plural; E1758, E23xx, E24xx"
---

# Text, titles and locale formats

Spec: `pnpm spec std.messages`, `std.i18n`, `k.head`.

- Page text: a message set loaded by the route's loader (`await Set.load(params.locale)`), read as `props.data.text.<key>`. A key with params renders through `formatMessage(props.data.text.count, { n }, props.params.locale)`.
- Route `title`: `title: (p) => p.data.text.showTitle`, a message from the route's loader data (a path route only; a layout has none).
- Values on screen: `formatMoney`, `formatDate`, `formatDuration` or `formatNumber` with the route's `props.params.locale`; never `toLocaleString` (E1758) or an `Intl` formatter with a locale (E2301). Counts: `plural(n, locale, { one: '# item', other: '# items' })`.
- Each locale has `<Set>/<locale>.ts` with every key; literal copy in JSX text, a text attribute (`label`, `placeholder`, `title`, `aria-label`...), an uppercase call's props or a route `title` is E2406 (E2401 to E2406: `keel explain <code>`).

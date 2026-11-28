# ADR-0051: bound controls write their first value as the markup default, and timings use a segmented LRU (RFC 0062)

**Status:** accepted

**Context.**
- Server-rendered edit forms showed empty fields. `value`, `checked` and `selected` are control state on the server DOM, as in a browser, and nothing wrote the markup (backlog 0166).
- The 256-name timings LRU let request-derived names evict every name with history (red team 0172).

**Decision.**
- **Defaults from the first sync.** `Field.bind` writes the element's state after its first sync as the markup default (`markDefault`, `@keel/forms` internal). That is an input's `value` attribute, a textarea's text, `selected` on selected options, and `checked` on a checkbox or radio. It writes only what differs, and nothing for `password` or `file`. `@keel/ui` controls with a reactive `value` or `checked` write their first value the same way (`markFirst`, `@keel/ui` internal). Later writes change only the property.
- **Edits before bind win (backlog 0180).** If a control differs from its markup default at bind (`edited`), the field reads the control and writes no default.
- **Server DOM.** Control state stays out of the markup, so the browser, happy-dom and the server run the same DOM calls. The serializer doubles a leading newline in `textarea`, `pre` and `listing`, and the parser drops one, as HTML does (backlog 0179).
- **SLRU timings.** There are two update-ordered `Map`s per ctx. A new name goes into the unprotected segment and, at 256 names, evicts that segment's least recent name, counted in `dropped`. A known name moves to the protected segment's recent end. Past 192 protected names, the least recent moves back unprotected, which is not counted. The guarantee is bounded (backlog 0178): a kept name with `count` 2 or more is evicted only after 192 other names had a repeat call since its last call.

**Alternatives.**
- Serialize properties as attributes in the server DOM. Server and browser HTML would then differ (RFC 0060).
- Write the default on every sync. That churns attributes, breaks native reset, and could put a typed password in the markup.
- Protect names at 8 samples, or cap request-derived names separately. Names with fewer samples would stay erasable, and the separate cap needs a naming rule.

**Consequences.**
- Golden-1's edit page shows `value="Milk"` and the selected priority under plain Node. Snapshot tests of bound controls gain these attributes.
- `@keel/forms` +275 B gzip, `@keel/ui` +95 B, `@keel/std-timings` +79 B, `@keel/server` +97 B (13,789 of 13,824). All are within budget.
- **Known limits.** Islands made of `@keel/ui` elements re-render at resume (E1253), so edits typed before resume are lost. That is filed separately. A crawler that requests each URL twice can push older history out of the protected 192.

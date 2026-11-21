# ADR-0100: widget values are controlled; interaction state is a chart instance holding indexes (RFC 0084)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 2, 3 and 4.

**Context.** A widget has values the app acts on (a selection, a chosen key) and state only the widget knows (open or closed, the highlighted option, whether focus returns to a trigger). std.statecharts compiled one declaration to one store, so two listboxes on a page could not each have a chart.

**Decision.** Every widget is controlled: it reads its value through a function and reports a change through a callback, so the app keeps the value in a store, a form field, a signal or the route's search. Interaction state is an instance of one of three charts: `optionsChart` (Listbox, Combobox, Menu, Tabs; data `active`, `count`, `back`), `openChart` (Dialog, Disclosure) and `toastChart` (one per toast). std.statecharts gains `instance(chart, key)`, which compiles the declaration again in the calling scope as the store `<id>:<key>`, disposed with the scope. Chart data hold indexes and counts only: no key, text or typed character enters a chart, its log or a session. `explore` proves `openChart` and `toastChart` in closed form (`proven`) and runs `optionsChart` to depth 6 over chosen counts (`exhaustive`).

**Alternatives.**
- Widget state in signals, rejected: unlogged, unreplayable and outside `explore`.
- Charts holding keys and option text, rejected: app data and typed queries would enter logs and sessions.
- Zag.js or XState machines, rejected: a second state runtime beside stores.

**Consequences.**
- std.statecharts goes from 1,120 to 1,298 tokens.
- Option lists hold at most 10,000 entries, the bound of `optionsChart`'s data, and its rung is `exhaustive`, never `proven`.
- The typeahead buffer is the one widget signal outside a chart; it empties 500 ms after the last key.

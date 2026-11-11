---
"@keel/check": minor
"@keel/compiler": minor
---

`keel check` reports API routes (k.api). A type error on a `manifest({...})` entry is E1510 for an entry with neither `component` nor `api: true` or an API route without `path`, and for an API route with `component`, `errorElement`, `title` or `layout`, with a fix that removes them; a guard without `redirect` on a page or layout is E1508. E1511 marks an API route in a module a `client` or `static` deployable serves, at that module in `topology.ts`. `routeLiterals` reads an entry's `api` literal and a guard declared without `redirect` (`guard: null`), and `routes.json` must match both (E1005).

---
"@keel/router": minor
---

A manifest entry is a page, a layout or an API route: `{ api: true, path, loader? }`, with actions through `routes.actions`, answers JSON and has no view. An entry with neither `component` nor `api: true`, an entry whose `api` is other than `true`, or an API route with `component`, `errorElement`, `title` or `layout`, fails to compile and `manifest()` throws E1510; an API route with neither a loader nor an action throws E1510, and a guard `redirect` naming an API route throws E1508, on the first read of the table. `guard({ redirect }, fn)` returns a `Guard`, which fits pages, layouts and API routes; `guard({}, fn)` returns an `ApiGuard`, which fits API routes only (E1508 on a page or layout). `routes.href` takes page ids only, `matchHref` returns `null` for an API path, the client router matches no API route, and `routes.json` marks API routes `api: true`.

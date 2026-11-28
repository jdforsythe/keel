---
"@keel/ctx": minor
"@keel/runtime-dom": minor
"@keel/server": minor
---

A new observer gets the ctx's current `nav`, then the `error` events reported since it (the first 16, kept while nothing observes too; a `nav` clears them), each replayed with `at`, `clock.now()` when it was reported, so an observer started after a first-load error still sees it and when it happened. A `Boundary` reports every catch to the ctx, observed or not. A document whose loader failed carries that error in `#k-state` as `{ code, message: code, data: { at? } }`, and `resume` reports it right after the served `nav`.

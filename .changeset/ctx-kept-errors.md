---
"@keel/ctx": minor
"@keel/runtime-dom": patch
---

A new observer gets the ctx's current `nav`, then the `error` events reported since it (the first 16, kept while nothing observes too; a `nav` clears them), so an observer started after a first-load error still sees it. A `Boundary` reports every catch to the ctx, observed or not.

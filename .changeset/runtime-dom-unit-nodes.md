---
"@keel/runtime-dom": patch
---

A unit's nodes include what a structural op at its top level renders before its anchor: a `Boundary`, `If`, `Match` or `For` that is a top-level node of a rendered fragment (a route with an `errorElement` is one) leaves the document, and moves, with the unit that rendered it. Navigating away from a top-level route with an `errorElement` no longer leaves its page in place.

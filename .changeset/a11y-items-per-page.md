---
"@keel/cli": minor
"@keel/testing": minor
"@keel/check": patch
---

k.a11y, k.ledger: an a11y item is `a11y:<project>:<routeId>#<criterion>`, one per page route (a `path`, no `api: true`) of each project `keel ledger` finds by its `.keel/routes.json`; a layout is checked through the pages it wraps, its module's static codes counting against each, and a layout no page's chain holds is W1731. Under `keel test` a `render`, `renderRoute` or `resumeDocument` given no `artifacts` takes the project's `.keel/a11y.json` and `tokens.ts` (`@keel/testing/setup`); a `tokens.ts` that throws, exports no `tokens` or fails `TokenSchema` makes the render throw E1807; given `artifacts`, a render takes those alone.

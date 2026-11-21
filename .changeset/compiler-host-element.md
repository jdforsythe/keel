---
"@keel/compiler": minor
---

`Host` from `@keel/ui` is a base element: its literal `id` is in `ids.json` and `a11y.json` as a `div` with its `role`, it is stamped as `data-k`, and its style props become one class. Build-time evaluation reads a `.css` import as empty; the browser build emits it as its own stylesheet asset (k.host-code).

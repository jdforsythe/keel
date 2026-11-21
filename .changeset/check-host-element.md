---
"@keel/check": minor
---

`Part` from `@keel/ui/aria` is open to app code: no rule guards its import. `Host` is read by E1802 (exactly one of `label` and `labelledBy`, a blank literal `label`), E1824 (`code` is `() => import("./x.ts").then((m) => m.x)`, and `input` is given) and E1825 (a `.css` import only in a host element code file).

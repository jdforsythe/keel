---
"@keel/router": patch
---

`routes.actions` throws E1505 for a value that is not an action (`undefined`, a plain object, a string), and attaches nothing. `undefined` hints an import cycle: import `routes.ts` before `*.server.ts` (backlog 0191; RFC 0063).

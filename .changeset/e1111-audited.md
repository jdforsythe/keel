---
"@keel/check": patch
"@keel/compiler": patch
---

E1111 exempts only audited stdlib exports (`tableSearch` from `@keel/std-tables`), not any call into a `@keel/std-` package; part styles are collected only for components of `@keel/std-headless` and `@keel/std-tables`.

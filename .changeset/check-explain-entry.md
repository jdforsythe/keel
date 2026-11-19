---
"@keel/check": minor
---

`explain` moves to its own entry, `@keel/check/explain` (k.explain); `@keel/check` no longer exports it. The explanation table lives only in that entry, so `check()` loads none of it. Rules registered through `defineRule` from `@keel/check` are explained by `@keel/check/explain` in the same process. Budgets: `@keel/check` 50kb, `@keel/check/explain` 13.5kb.

Migration: replace `import { explain } from '@keel/check'` with `import { explain } from '@keel/check/explain'`. The text returned is the same.

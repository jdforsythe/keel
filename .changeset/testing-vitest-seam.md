---
"@keel/testing": patch
---

`@keel/testing` names vitest in one internal module, so the structure lint (S0009) follows a std entry through `@keel/testing` instead of stopping at it.

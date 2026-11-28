---
"@keel/reactive": minor
---

`moduleRoot` (`@keel/reactive/internal`) runs a compiled top-level statement in a root of its own. An ownerless `scope()` outside one, without `detached`, raises the E1208 defect; E1203 is a defect.

---
"@keel/check": minor
"@keel/compiler": patch
---

`keel check` reports E1152 at a binding's `layout` that names a layout of a module not in `deps`, and E1506 over each deployable's table for such a `layout` that names no layout entry there (its module placed in another deployable, or no such entry) or closes a cycle. `reportedCodes()` lists E1502, E1503, E1504 and E1506. `routeLiterals` names a placed module that resolves to no app folder or stdlib package unread (W1005) instead of dropping it.

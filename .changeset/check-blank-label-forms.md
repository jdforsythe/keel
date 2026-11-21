---
"@keel/check": patch
---

E1802 reports a blank `label` through a namespace import of `@keel/ui` (`<ui.Box label="">`) and a label made only of character references that decode to white space (`label="&#32;"`).

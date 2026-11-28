---
"@keel/check": minor
"@keel/cli": minor
---

`keel check` reads routes from module contracts and bindings: a type error inside a `contract(...)` or `manifest(...)` argument is E1510, E1506 or E1515 by its position; E1513 and E1514 check a contract's place and imports; E1502, E1503, E1504, E1509 and E1653 read contract literals per deployable table; E1155, E1111, E1508, E1511 and E1567 read contracts. `.keel/surface.json` is `version: 2`, one record per contract with its callers and API entries, and `keel check --base` compares API entries (E1562), with W1568 for a base that is no version 2 surface. E1507, E1512, E1561 and E1157 are retired; `keel explain` names the k.contract rule that replaced each.

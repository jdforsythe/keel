---
"@keel/check": patch
"@keel/testing": minor
---

`keel check` no longer reports E1005 for an app's `.keel/monitored.json` or `.keel/ledger.json`: k.ledger reads them and the compiler never writes them. `testResults` (and so `keel test` and the repository reporter) reports a failure carrying a harness code (E1704 from `properties` and `simulate`, E1708 to E1710 from `explore`) as that code at the test file's own frame, with the message's first line before the test name; other failures stay T0001.

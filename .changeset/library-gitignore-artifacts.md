---
"@keel/scaffold": patch
---

A scaffolded library's `.gitignore` also ignores `.keel/*.json` but `.keel/ledger.json`: the artifacts of the build `keel test --e2e` runs first are derived, and a library commits its ledger alone.

---
"@keel/cli": patch
---

The ledger credits an export from a test only when the test uses the imported binding: an import shadowed by a local of the same name, or named only in a type position, earns no credit.

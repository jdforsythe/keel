---
"@keel/cli": patch
---

`keel ledger --diff --scope <prefix>` fails only on errors inside its scope: an E1713 for a package outside the scope no longer fails it, and one I1713 line counts those errors.

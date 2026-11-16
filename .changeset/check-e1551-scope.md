---
"@keel/check": patch
---

E1551 reads app files only: a `loader`, `action` or `commitStores` call in a file under the root's `packages/` is kernel or stdlib code and is not reported.

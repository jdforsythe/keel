---
"@keel/check": patch
---

k.formats: E1106 does not report `s.format` in a library's `src/` and `unsafe/` files, installed, linked or in `keel check`'s own folder; any other file of such a folder, one under `modules/` among them, keeps the rule.

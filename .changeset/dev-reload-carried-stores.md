---
"@keel/compiler": patch
"@keel/store": patch
---

Under `keel dev`, a module evaluated again after an edit creates its module-level store in place of the earlier load's (the module registry's ids are carried over at each load, as inspector sections are), so editing a file that holds one, such as an outbox made at a module's top level, no longer fails `id already in use by a live store`. Two stores of one id within one load still throw.

---
"@keel/compiler": patch
"@keel/store": patch
---

Under `keel dev`, a file evaluated again after an edit creates its module-level store in place of the earlier load's, so editing a file that holds one, such as an outbox made at a module's top level, no longer fails `id already in use by a live store`. The takeover is narrowed to the file whose store held the id: a store another file adds with that id throws as in production, and once the load ends, an id no store took leaves the module registry and the scope that owned its store is disposed. Each app file under `keel dev` names itself at its start, and the dev server module calls `storesReload`, `storesFile` and `storesLoaded` of `@keel/store/internal`; a build and a test call none.

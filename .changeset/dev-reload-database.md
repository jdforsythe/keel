---
"@keel/compiler": patch
"@keel/std-postgres": patch
---

In `keel dev`, editing a file that declares a database with `database` from `@keel/std-postgres/server` loads the server graph again whole, so the next request runs the edited declaration instead of failing with E1602. A fresh evaluation of std-postgres reuses the PGlite folders and `pg` pools the process already opened.

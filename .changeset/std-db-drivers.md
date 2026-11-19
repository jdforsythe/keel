---
"@keel/std-db": minor
---

`@keel/std-db/sqlite` and `@keel/std-db/postgres`: storage drivers that keep k.persist's contract (`get`, `set`, `read`, `commit`) plus `close()`, over `node:sqlite` and `pg`, in the tables `keel_kv` and `keel_meta` at layout 1. Opening rejects E2152 on a newer layout and E2153 on a database it cannot open, naming `KEEL_DATABASE_URL` and no part of it. `@keel/std-db/tools` registers E2151.

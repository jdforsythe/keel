---
"@keel/std-postgres": minor
---

`database(name)` reads its migrations from `modules/<moduleId>/migrations/*.sql` of the app folder (`KEEL_APP_DIR`, else the working directory) at its first call; `{ migrations }` stays an optional map read instead. A refused or lost connection while opening the store or migrating is that call's `keel.unreachable`; a failed migration pass keeps nothing and the next call runs it again. With no `KEEL_POSTGRES_URL` and `KEEL_DEV_DIR` set (`keel dev`), the store is `pglite:<KEEL_DEV_DIR>/postgres`.

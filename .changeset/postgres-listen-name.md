---
"@keel/std-postgres": patch
---

The listening connection `follow` opens on a `postgres:` URL has the `application_name` `keel-listen-<pid>`, so an operator tells one process's listener from another's in `pg_stat_activity`.

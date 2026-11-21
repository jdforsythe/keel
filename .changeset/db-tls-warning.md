---
"@keel/std-db": patch
"@keel/std-postgres": patch
---

A `KEEL_DATABASE_URL` or `KEEL_POSTGRES_URL` with `sslmode=require` or `sslmode=prefer` connects as before, verifying the certificate as `verify-full`, and `pg` no longer prints its multi-line security warning at the first connect.

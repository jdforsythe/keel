# db lane: spec sentences to apply (orchestrator, with the other lanes' proposals, before the root gates)

- k.persist Drivers: "A driver that holds connections has `close()`, resolving once they close; the generated entry awaits it after `app.close()`, and any call after it rejects."
- std.db API: "`postgres(url, { clientFactory? })`: `clientFactory` returns a `pg` Pool-shaped object used in place of the pool."
- std.db, postgres bullet: "`commit` and `set` are one read committed transaction that takes..." (per-key `pg_advisory_xact_lock` in sorted key order, then compare, then one upsert).
- std.db, add: "A key or value holding U+0000 or a lone surrogate rejects."
- std.db Rules, E2153: add "or its `layout` is not a version".

Conformance assertion changed: `layout-e2152.test.ts`, in-process Postgres branch sets `exit ??= 1` when the open rejects (D7: the driver rejects, the entry exits).
Bytes (gzip): sqlite 1,486 of 1,536; postgres 1,701 of 2,048; tools 494 of 1,536.
Verified on PGlite only (CI's real server must cover): advisory locks across two connections, read committed visibility after the lock, deadlock-free lock order, TLS/`sslmode`, pool cap 10, 10 s connect timeout, connection loss mid-commit.
Biome import order in `packages/std-db/conformance/{fixtures.ts,sigkill-restart.test.ts,two-processes-409.test.ts}`: fix in an `rfc:0085` commit if the root check reports it.

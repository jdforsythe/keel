# ADR-0206: std.postgres: serializable by default, `allow` with a reason, lone statements serializable (RFC 0184)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** On Postgres 17 at `read committed`, the default, two interleaved `transaction` calls that read a counter and write the value read + 1 both answer `ok` and one increment is lost; no serialization failure is raised, so nothing reruns. Sim and PGlite run transactions one after another, so an app's tests cannot show it. Keel's default must be the safe one, with danger opted into visibly.

**Decision.** `transaction` runs at `serializable`; a serialization failure or deadlock reruns `fn`, at most 3 runs, then `keel.conflict`. The `isolation` option is replaced by `allow`, naming what is given up, with a required literal `reason` (E2459): `'write skew'` runs at `repeatable read`, `'lost updates'` at `read committed`. `keel review` lists each `allow` as R2451, added when k.escapes and this section share a branch. Each lone `query`, `one` and `run` is its own `serializable` transaction, rerun the same way. Sim stays serial, exact at the default. std.db keeps `read committed`: its commit locks each key before it compares.

**Alternatives.** `repeatable read` by default (write skew commits silently); `isolation` plus `reason` (a level's name does not say what is lost); `unsafe(...)` around the opt-down (a folder escape, not an API choice); teaching `for update` (misses write skew); lone statements at `read committed` (outside SSI's view); a check rule for read-then-write across lone calls (false positives without data flow); interleaving sim now (needs a model of each level's snapshots).

**Consequences.** No transaction loses an update or commits write skew unless its call says `allow` and why. Contention costs reruns and, past three runs, 409s; `fn` must be safe to repeat. std.postgres reads `implemented` until clauses 13 to 17 are covered; the section budget is re-based to 2,325 tokens. A sim that shows an `allow` level's anomaly is a follow-up RFC.

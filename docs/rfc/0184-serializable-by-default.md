# RFC 0184: std.postgres: serializable by default, `allow` with a reason, lone statements serializable

Status: implemented (ADR-0206). Amends RFC 0158 (the `transaction` text of std.postgres). From a scenario test, `packages/std-postgres/test/racing-writes.test.ts`, on Postgres 17.

## Decisions
- D1: `transaction(fn)` runs at `serializable`. Rejected: `repeatable read`, which still lets write skew commit silently (Proposal, Levels).
- D2: the rerun bound stays 3 runs of `fn`, rerun at once, then `keel.conflict` (409), nothing committed: the bound `commitStores` and the store commit already use. Rejected: a larger bound or a backoff; the bound is a statement of contention an app can see as 409 and fix, and a backoff needs a clock wait inside a request.
- D3: the opt-down is `allow`, a closed vocabulary naming what is given up, with a required `reason`: `{ allow: 'write skew', reason }` runs at `repeatable read`, `{ allow: 'lost updates', reason }` at `read committed`. The `isolation` option is removed (one way, P1); no level is lost, so no feature is cut. Rejected: `{ isolation, reason }`, whose values name a level, not the anomaly an author or reviewer has to weigh.
- D4: `reason` is a non-empty string literal, checked by a new rule, E2459, and refused at run time when missing or empty. `allow` outside the vocabulary throws, as an unknown `isolation` throws now.
- D5: `keel review` lists each `allow` as a sanctioned opt-in: new code R2451 (std.postgres's first in the R2xxx space RFC 0178 D3 keeps for stdlib findings), danger `high` for `'lost updates'`, `medium` for `'write skew'`. k.escapes is not on this branch; the row is added to k.escapes and its clause to k.escapes's code clause when both are on one branch (For the operator, 2).
- D6: each lone `query`, `one` and `run` is its own `serializable` transaction, rerun as `fn` is. Rejected: lone statements at `read committed`, which leaves them outside the serializable guarantee of every transaction they race (Proposal, Lone statements).
- D7: no check rule for a read and a write from it in two lone calls: telling a dependent write from an independent one needs data flow, and a read id used in an insert (a foreign key holds it) would be a false positive. The keel-data skill and the API text teach it; `simulate` (k.sim) already varies the order of lone statements of concurrent callers by plan delays, so an app's tests can show it (clause 17).
- D8: sim stays serial. Under sim each transaction runs whole in step order, which is a history `serializable` allows, so at the default sim is exact. What an `allow` level permits does not happen under sim; a sim that interleaves an `allow` transaction's statements is a follow-up RFC (Known limits).
- D9: `@keel/std-db` keeps `read committed`. It has no app transaction path (E2151); its `commit` takes `pg_advisory_xact_lock` for each key in sorted order before it compares the head, so the compare reads the newest committed head and a stale write is 409 (std.db's racing test and its serial-order clause). No change.
- D10: std.postgres goes from `conformance-covered` to `implemented`: five new clauses (13 to 17) are at `none` until the conformance-writer and the build land. `spec.section` and `docs.section` are re-based from 1,875 to 2,325 (Token impact).

## Problem
On Postgres 17 at the default, `read committed`, two interleaved `transaction` calls that each read a counter and write the value read + 1 both answer `ok`, and the counter ends at 1 (`racing-writes.test.ts`, the read committed case). Nothing reruns and no conflict is reported: a silent lost update. The spec allows it: `transaction(fn, { isolation? })` names three levels, the code defaults to `read committed` (`makeDatabase.ts`: `opts?.isolation ?? "read committed"`; `Isolation.ts`), and only a serialization failure (40001) or deadlock (40P01) reruns `fn`, which `read committed` never raises for this race.

Today, from the spec and code:
- `transaction` runs `fn` at the given level, `read committed` when none; it reruns on 40001 or 40P01, at most 3 runs, then `keel.conflict`; a lone statement uses the pool (autocommit, `read committed`) on `pg` and a `read committed` transaction on PGlite; its serialization failure is `keel.conflict`, not rerun.
- `transaction concurrent` (the keel-data skill, k.sync) is a store transaction's option in `@keel/store`, `'reject'` (default, 409 on a stale `base`) or `'rebase'`, not std.postgres. `keel.conflict` 409 covers a stale store commit, std.db's compare, and std.postgres's serialization failure past its third run.
- The sim's planned `conflict` is a serialization failure at a run's commit (or a lone call's answer): it exercises the rerun path, not an interleaving. Sim and PGlite have one session, so two transactions run one after another and a test never sees the race.
- The keel-data skill says `transaction(fn)` "reruns on serialization failure, then is `keel.conflict`" and nothing about the level, so an author reads it as safe.

Keel's premise is that the default is the safe one and danger is opted into, visibly. An author, or an agent, writing read-then-write in a `transaction` has done what the API asks and gets data loss only under production concurrency.

## Proposal
### Levels (what each closes on Postgres 17)
| level | closes | leaves open |
|-|-|-|
| `read committed` | dirty read | non-repeatable read, phantom, lost update (read, then write back), read skew, write skew |
| `repeatable read` (snapshot isolation) | dirty read, non-repeatable read, phantom, read skew (one snapshot for the whole transaction), lost update on one row (an update or delete of a row another transaction committed since the snapshot is 40001) | write skew (two transactions each read what the other writes, each writes a different row: the on-call doctors), the read-only transaction anomaly |
| `serializable` (SSI) | all of them: committed serializable transactions have the effect of some serial order | none among serializable transactions; a transaction at a lower level racing them is outside the guarantee |

`repeatable read` closes the reported race but not write skew, the same shape over two rows (racing-writes' doctor case), which an author cannot tell from the first. So the default is `serializable`.

### API (std.postgres)
```ts
const r = await kitchenDb(ctx).transaction(async (tx) => {
  const n = await tx.one(sql(Counter)`select n from counter where id = 1`)
  if (!n.ok) return n
  return tx.run(sql(NoRows)`update counter set n = ${n.value.n + 1} where id = 1`)
})                                                  // serializable: ok or keel.conflict, never lost
kitchenDb(ctx).transaction(fn, { allow: 'lost updates', reason: 'view counts: one increment in one statement' })
```
- `transaction(fn, { allow?, reason? })` runs `fn(tx)` in one `serializable` transaction. A serialization failure or deadlock runs `fn` again, at most 3 runs, then is `keel.conflict`, nothing committed. What `fn` does outside `tx` must be safe to repeat, as it must now.
- `allow: 'write skew'` runs at `repeatable read`; `allow: 'lost updates'` at `read committed`, which also gives up what `'write skew'` gives up. `reason` is required, a non-empty string literal (E2459); `allow` outside the two, or no `reason`, throws. The type `Isolation` is replaced by `Allow` (`'write skew' | 'lost updates'`).
- A transaction at an `allow` level keeps no serial order with those it races: its writes can break a serializable transaction's read. The API text says so; review lists every such place (D5).

### Lone statements
Each lone `query`, `one` and `run` is its own `serializable` transaction, rerun on 40001 or 40P01 as `fn` is, then `keel.conflict`. A lone statement is atomic at any level; at `serializable` it is also inside the order every default transaction keeps, so a lone write cannot break a transaction's read. Under sim each run of a lone statement takes one plan step, as a run of `fn` does.

A read in one call and a write from it in another are two transactions; no level joins them. The API sentence and the skill say: a write using another call's read goes in one `transaction` with it. Two callers doing this in a test, started together, already lose the update under sim (clause 17), and `simulate` varies their order by the plan's delays.

### Review (R2451, added with k.escapes)
k.escapes table row:
| R2451 | opt-in: `'lost updates'` high, `'write skew'` medium | an `allow` property of the object a `.transaction(` call takes; `reason` its reason |

Its clause joins k.escapes's first (each code reported on its fixture by a range, not on its clean twin). std.postgres's Rules gain `R2451 (k.escapes) each allow` at the same commit.

### Tests
At the default, sim's serial runs are a history Postgres allows, so an app's sim tests and its production agree on the outcome set (sim reaching the 409 side through planned `conflict`s). A test written against `allow` code passes under sim even where Postgres would lose an update; that is the follow-up (Known limits).

## Alternatives
- **`repeatable read` by default.** Rejected (D1): closes the counter, not write skew; an author cannot tell which shape they wrote.
- **Keep `isolation`, require `reason` below `serializable`.** Rejected (D3): `isolation: 'read committed'` does not say "lost updates" to the reviewer or the agent that writes it.
- **`unsafe(reason, fn)` around an opt-down.** Rejected: `unsafe` is a whole-file folder escape for types and globals (R1001, R1058); an isolation level is an API choice with a closed vocabulary.
- **`select ... for update` taught instead of a level.** Rejected: it closes the counter, not write skew over rows not yet read, and depends on every author remembering it.
- **Lone statements stay `read committed`.** Rejected (D6): a lone conditional write races a serializable transaction outside SSI's view; the cost of the change (a `set n = n + 1` hot row now reruns under contention) is the cost every default transaction pays.
- **A check rule for read-then-write over two lone calls.** Rejected (D7): no false-positive-free form without data flow.
- **Sim interleaves every transaction's statements now.** Deferred (D8): one PGlite session holds one open transaction, so interleaving needs a model of each level's snapshots; at the default the serial sim is already exact.
- **More runs, or a backoff.** Rejected (D2).

## Spec diff
Applied in this commit:
- **std.postgres** (status `implemented`, D10): API: `transaction(fn, { allow?, reason? })` at `serializable`, the serial-order statement, `fn` safe to repeat; a new bullet: `allow` and its two values, the levels and what each permits, `reason` (E2459), lone statements serializable and rerun, the read-then-write sentence. Errors: `keel.conflict` is a serialization failure or deadlock past its third run. Modes: each run of a lone statement takes a plan step; `conflict` commits nothing; sim runs each transaction whole in step order, `allow`'s anomalies absent under sim. Rules: E2459. Conformance gains five clauses (13 to 17).
- **`spec/std/README.md`**: the std.postgres row reads `implemented`, E2451-E2459.
- **Ledger**: std.postgres#13 to #17 at `none` in `tooling/ledger/ledger.json`.
- **Budgets**: `spec.section` and `docs.section` 2,325.
- At the merge with k.escapes: the R2451 row and std.postgres's Rules mention (Proposal, Review).

## Conformance diff
By the `conformance-writer`, under `rfc:0184`, from the spec text alone, in `packages/std-postgres/conformance/`:
- 13: `show transaction_isolation` under sim, on PGlite and on Postgres 17, at the default, alone, and with each `allow`.
- 14: on Postgres 17 (`KEEL_TEST_POSTGRES_URL`), the counter pair and the doctor pair, each waiting at a barrier after its read; the doctor pair once more with `allow: 'write skew'`.
- 15: under sim, a lone `run` with plan `conflict`, `none`, and with `conflict` three times.
- 16: the throws, and E2459 on a fixture and its clean twin.
- 17: under sim, two lone read-then-write callers end the counter at 1; in `transaction`s, at 2.
- `sim-transaction-plan.test.ts`'s `// Spec:` header quotes the new `transaction` sentence.
Spec topics: `pnpm spec std.postgres`; for context `pnpm spec k.sim`, `pnpm spec k.data`.

## Build
- `@keel/std-postgres`: `transaction`'s options `{ allow?, reason? }`, the level from `allow` (`serializable` without), the throws; `Isolation` replaced by `Allow`; a lone statement at `serializable` (on `pg`, the pool's connections with `default_transaction_isolation=serializable` so a statement stays one round trip; on PGlite, the statement path's transaction at `serializable`) and its rerun loop with a plan step per run; `/tools` gains E2459 and its explain text; `Conflict`'s comment.
- `packages/std-postgres/test/racing-writes.test.ts`: the default case becomes "no lost update"; the read committed case moves to `allow: 'lost updates'`; the unique-title race reruns on Postgres 17 (40001 for a check-then-insert at `serializable`), so `runs` is at most 2.
- Docs: the keel-data skill (the default, `allow`, the read-then-write rule, what sim shows), the std-postgres README.
- No golden app calls `transaction`; none changes.
- Size: about 120 lines of source and 40 of rule; `@keel/std-postgres/server` gains under 1 kb.

## Known limits
- Under contention a default transaction reruns, and past its third run is 409: a hot row written by more than three concurrent callers answers some 409s. SSI's predicate locks are coarser without an index (a sequential scan locks the relation), so a missing index raises false 40001s. `allow: 'lost updates'` with `set n = n + 1` in one statement is the counter's escape.
- What `allow` permits never happens under sim, so an app's tests cannot show an `allow` transaction's race. Follow-up RFC: sim interleaves an `allow` transaction's statements with another's at statement boundaries, each taking a plan step, reads at the level's snapshot.
- R2451 reads syntax: an options object built elsewhere evades it, as an aliased `reveal` evades R1012; E2459 needs the literal only when `allow` is written in place.

## Migration
None: unreleased.

## Token impact
std.postgres 7,408 to 9,291 characters (2,323 tokens). `spec.section` and `docs.section` are re-based from 1,875 to 2,325: the section states the default level, the opt-down and what each level permits, lone statements and what sim shows, and each is a clause a conformance writer needs; splitting transactions into their own section would move a covered clause (4). The keel-data skill gains about 60 tokens.

## For the operator
1. `serializable` for lone statements too (D6). Recommendation: accept; a single guarantee for every call is the one an author can hold, and the hot-counter cost has a visible escape.
2. R2451 lands at the merge with k.escapes (D5). Recommendation: accept; the row is stated here so the merge is a copy.
3. A 25% section budget re-base (D10). Recommendation: accept now; the pre-P1 trim review can split std.postgres if the budget comes back down.

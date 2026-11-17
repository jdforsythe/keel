---
name: keel-storage
description: "Durable Keel storage and reach: topology storage 'sqlite'|'postgres', KEEL_DATABASE_URL, commitStores, @keel/std-workflows workflow/flows, prove from @keel/testing/prove, shells and keel build --target; E1560, E1563, E1572-E1575, E1605, E2151-E2153, E2351-E2354, E1715-E1718, E1112"
---

# Storage, workflows, shells, proofs

Spec: `pnpm spec k.persist`, `std.db`, `std.workflows`, `k.shell`, `k.prove`.

**Database:** `topology({ api: { modules, adapter: 'node', storage: 'sqlite' } })` (`'file'`, `'sqlite'`, `'postgres'`) and `@keel/std-db` in `dependencies` (E1572). Set `KEEL_DATABASE_URL`: for SQLite an absolute `file:` URL whose folder exists (default `file:/data/keel.sqlite`), for Postgres a required `postgres:` URL (a bad value or an unset Postgres one: E1560; unopenable: E2153; newer layout: E2152). Never import `@keel/std-db` (E2151). Before a deploy, `keel check --base` reports E1563 (a required field added: make it `.optional()`) and W1564.

**Outside a request:** `await commitStores(ctx, factory, fn)` from `@keel/server` in `*.server.ts`; `fn` returns a `Result`, may run 3 times, calls transactions only. A `drivers` option on a sim ctx is E1605; one key twice in `commit` is E1606.

**Workflow:** add `@keel/std-workflows`, `@keel/std-jobs`, `@keel/std-statecharts`; `workflow('api.removal', { chart, steps: { purging: { run, done, failed } }, waits })` in `removal.server.ts` (id prefixed by module: E2351; state names: E2352; W2353 a step never undone). `jobs.server.ts`: `queue({ ...removal.jobs })`; `runners.server.ts`: `[jobs, flows(jobs, [removal])]` (else E2354). Start it with `tx(s.removal.start, { id, data })` in an action whose `stores` hold `removal.stores`. A step runs at least once; use `key`.

**Proofs:** `test('invariants', () => prove([addTodo(b), toggleTodo(b)]))`, needs dev `z3-solver` (E1718; without it the ledger says `example`). E1715 outside the fragment (use `explore`); E1716 counterexample (an integer written with no `max` and guard leaves the safe range: bound it, `n < 9 ? n + 1 : n`; an optional written as `o: p.o` may be `undefined`: guard it); E1717 raise `rlimit`; E1721 `prove` ran in a worker thread: vitest `pool: "forks"`.

**Shells:** `shells: { tauri: { id: 'dev.acme.app', name } }` on a `client` deployable (E1573). `KEEL_ORIGIN=https://... keel build --target tauri` or `--target capacitor --platform android|ios` (E1574 origin, E1575 missing toolchain, E1052 flags).

**Secrets:** a `reveal`ed value reaching `tx`, `store`, `storage`, a log, a file or a `throw` is E1112: store `credentials(ctx).hash(secret)` or a minted token's `digest` (keel-compliance).

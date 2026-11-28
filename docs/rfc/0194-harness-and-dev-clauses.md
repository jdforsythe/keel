# RFC 0194: k.ctx, k.testing, k.sim, std.postgres, k.data: six behaviours the spec now states

Status: implemented (ADR-0216). Amends k.ctx (API), k.testing (Rules, Properties), k.sim (Simulation), std.postgres (Modes) and k.data (Dev). From the fixes 881fe4d8, 8cac7dc2, 7f569daa, c89e22c1, c85f8ae5 and cc87f217.

## Problem
Six fixes made the framework do what the spec did not say.
- A page that threw while an island claimed it showed only "the claim threw" under a harness, so the author of a failing `resumeDocument` test could not see the cause.
- `simulate`'s `run()` settled while a `ctx.net` route was still answering (a server on another ctx doing real I/O), so a scenario read state before the response.
- The listening connection had no name, so an operator could not tell a process's listener in `pg_stat_activity`.
- Under `keel dev`, editing a helper that a capability's file called left the old registration and old code in the module graph; k.data Dev covered only the file that calls `register`.
- A real `ctx.net.fetch` whose connection was reset as it was set up threw outside the returned promise, where a refused one rejected, so a caller's `catch` never saw it.
- A 100-run property on a rendered page timed out at the flat test timeout on a slow machine, and the time `keelConfig` now gives such a test was in no spec text.

## Proposal
- **k.testing, Rules:** E1720 names a throw while an island claims with its thrown text.
- **k.sim:** a `ctx.net` route that has not answered is work in flight; `run()` waits for it, and with nothing else moving the run's clock steps.
- **std.postgres, Modes:** the listening connection's `application_name` is `keel-listen-<pid>`.
- **k.data, Dev:** editing an app file that registered a capability, directly or through a helper it calls, or editing that helper, loads the server graph again whole; a capability id two files register is still E1602.
- **k.ctx, API:** a real `ctx.net.fetch` whose connection is refused or reset rejects with a `TypeError` and never throws outside the returned promise.
- **k.testing, Properties:** under `keelConfig` a test that calls `properties` or `simulate` and declares no timeout is given 300 ms per run its calls name, at least the configured test timeout; a call reached through a helper is not counted, and a call inside a loop counts once.

## Alternatives
- **Name the cause in production too.** Rejected: the thrown text can carry data (k.errors); a harness ctx is no production one.
- **Leave `run()` to the caller's `await`.** Rejected: a scenario cannot await a request it did not start.
- **A per-process random listener name.** Rejected: the pid ties it to an operator's process list.
- **A flat longer timeout for every test.** Rejected: a hang in a test with no runs would then wait as long.
- **Reload on every app file edit.** Rejected: it drops the registry's cheap path for files that register nothing.

## Spec diff
Applied in this commit:
- **k.testing**, Rules: E1720 carries the thrown text. Conformance: an island whose component throws `new Error('boom')` while claiming is E1720 whose text holds `boom`.
- **k.sim**, Simulation: the in-flight sentence in `run()`. Conformance: a route awaiting a promise the scenario resolves after `run()` starts, or a clock `after` of the run: `run()` resolves once the route has answered.
- **std.postgres**, Modes: the name. Conformance: with a `follow` open, `pg_stat_activity` holds a backend whose `application_name` is `keel-listen-<pid>`.
- **k.data**, Dev: the sentence above. Conformance: under `keel dev`, editing the helper or the app file makes the next request run the edited code with no E1602; a second file registering the id is E1602.
- **k.ctx**, API: the sentence above. Conformance: a real `ctx.net.fetch` to a port nothing listens on, and to a server that resets the connection as it is set up, each rejects with a `TypeError`, with no uncaught exception.
- **k.testing**, Properties: the sentence above. Conformance: a test with one 100-run `properties` call and no declared timeout has 30 s; one with a declared timeout keeps it; one with no such call keeps the configured timeout.
- **Ledger**: the six new clauses at `none`.

## Conformance
By the `conformance-writer`, under `rfc:0194`, from the spec text alone, in `packages/runtime-dom` or `packages/testing`, `packages/testing`, `packages/std-postgres`, `packages/compiler` and `packages/ctx` conformance folders. Spec topics: `pnpm spec k.ctx`, `pnpm spec k.testing`, `pnpm spec k.sim`, `pnpm spec std.postgres`, `pnpm spec k.data`.

## Migration
None: unreleased.

## Token impact
Each section gains under 80 tokens.

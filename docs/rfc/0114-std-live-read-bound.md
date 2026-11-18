# RFC 0114: std.live: a read is bounded at 30 s

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0507. ADR-0136 records it.

## Problem
`live` runs one read at a time. In `packages/std-live/src/live.ts` the flag `reading` is set before `await attempt(() => opts.read(ctx))` (line 35) and cleared only when that promise settles. A `read` that never settles (a fetch with no timeout on a stalled connection, a loader awaiting a lock) leaves `reading` true for the life of the scope: every later `saved` event only sets `again`, no read runs again, the hydrated store never refreshes, and `status()` keeps the value of the read before, `live`. Nothing in std.live bounds a read, and the backoff covers only reads that settle `err`.

## Proposal
Each read is raced against `ctx.clock.after(30_000, signal)`. A read is pending until it settles or that wait ends, whichever is first. When the wait ends first the read counts as failed: `status()` turns `connecting` (as for an `err`), the backoff schedules the next read 1 s later, doubling to 30 s, or the next event runs it at once, and the pending flag clears so events cause reads again. The late read is not cancelled (`read` takes no signal), and when it settles it commits nothing: it is older than its bound, as a read older than a read started later commits nothing today.

The bound is a fixed constant, 30 s on `ctx.clock`, so it runs under sim and a test reaches it with `advance`. Disposing the scope aborts the wait with the retry timer.

The two existing lines stay true and gain the bound: "one read at a time" counts only pending reads, so after a read times out a second may run while the first is still in flight; and the first then commits nothing, because it is past its bound.

## Alternatives
- An `AbortSignal` passed to `read`: lets a read stop its own fetch, but changes the `read` signature for every caller and still needs a bound for reads that ignore the signal. Left out; a later RFC can add it beside the bound.
- A `timeout` option on `live`: a second way to write the same view; no caller has asked for another value (default 2).
- Bounding only the status (turn `connecting`) and not the read: the store would still never refresh.

## Choices
- C1: the bound is 30 s, fixed, equal to the backoff cap. A read slower than the longest wait between retries is treated as lost; std.live has no config shape, so no option.
- C2: a timed-out read enters the backoff at its current step, as an `err` does, not at once: a server that stalls every read is retried at the backoff's pace, not in a loop.

## Spec diff
std.live, the first API bullet, whole new text:
```
- One read at a time: a read is pending until it settles or 30 s pass on `ctx.clock`, whichever is first. Events that arrive while one is pending cause exactly one more read after it, and a read never commits after its 30 s or after a read started later.
```
The third API bullet, whole new text:
```
- A failed read, or one not settled within 30 s, commits nothing and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event, whichever is first.
```
Conformance, appended as the last bullet:
```
- Under sim, after a committed read, a `saved` event starts a read that never settles; once `ctx.clock` passes 30 s from its start, `status()` is `connecting`, and 1 s later a second read runs; when that one settles `ok`, it commits and `status()` is `live`.
```
Section length 2,737 to 3,138 characters (685 to 785 tokens).

## Conformance diff
One `rfc:0114` commit by the `conformance-writer`:
- New `packages/std-live/conformance/read-bound.test.ts`, citing the new bullet, with the `controlled` read of `fixtures.ts`: read 0 resolves `ok` (status `live`); `server.save` starts read 1, left unresolved; `tick(ctx, 29_999)` leaves one call outstanding; `tick(ctx, 1)` makes `status()` `connecting`; `tick(ctx, 1000)` makes the read count 3; read 2 resolves `ok` and commits, `status()` `live`; read 1 then resolves `ok` and the hydrated log does not grow.
- No existing file changes. `dispose.test.ts:27` ticks 100 s after disposing and expects no further read: the bound's wait is aborted with the scope, so it holds. `stale-read.test.ts` never advances the clock, so no read reaches its bound there.

## Migration
None for callers. A `read` that took longer than 30 s and then succeeded now commits nothing and is retried; such a read was a stalled view before.

## Build order
1. Orchestrator: `spec/std/std.live.md` (done with this RFC). The `conformance-writer`: the new file above.
2. One std-live lane owns `packages/std-live/src/live.ts` (the race on `ctx.clock.after`, a read counter so a late result commits nothing, the wait aborted on dispose, the doc comment) and `packages/std-live/test/**`, the README if it states the read rules, and a changeset (`@keel/std-live` patch). It runs `check`, `build`, the std-live suite once and `pnpm budgets`.
3. Orchestrator: ledger, backlog 0507 closed, HANDOFF.

## Token impact
std.live 685 to 785 tokens (2,737 to 3,138 characters). No other section changes.

## Amendment (red team 6, finding 1)
A read given up at its 30 s stays open on the wire: `read` had no signal, so with a hanging backend the bound starts a new read every 31 s while the old ones hold their connections (62 unsettled reads in one sim hour). In a browser that fills the 6 connections HTTP/1.1 allows per origin within minutes, and the user's writes queue behind dead reads.

`read` now receives an `AbortSignal` as a second argument: `read(ctx, signal)`. It is aborted when the read's 30 s pass while it is pending and when the scope is disposed while it is pending. Those are the only cases where a pending read's result is dropped: a read started later supersedes an earlier one only after the earlier one's bound, so no third abort rule is needed. The signal is positional, as in `ctx.clock.after(ms, signal)`; a `read` written `(ctx) => …` still type-checks, so no caller changes. A `read` that ignores the signal stays bounded by the 30 s race. The Alternatives line above that left the signal out is reversed.

Choices the operator can reverse:
- A1: a positional second parameter, not an options object `read(ctx, { signal })`. Both leave current callers valid; the positional form matches `ctx.clock.after` and k.services forwards it as its `signal` option.
- A2: a read that settled is never required to see an abort; the builder may abort its controller after settling, which the spec permits.

Spec diff (std.live, 785 to 922 tokens): the API paragraph's `read(ctx)` becomes `read(ctx, signal)` with the clause "`signal` is an `AbortSignal` the read may pass on as the k.services `signal`, and a `read` that takes only `ctx` stays valid"; a new last API bullet:
```
- A read's `signal` aborts when its 30 s pass while it is pending and when the scope is disposed while it is pending, so a read whose result can no longer commit is cancelled; a read that ignores `signal` stays bounded.
```
Conformance, appended as bullet 10:
```
- Under sim, a read that never settles has its `signal` not aborted 29,999 ms after it starts and aborted at 30,000 ms; disposing the scope while another such read is pending aborts its `signal`.
```

Conformance writer: a new `packages/std-live/conformance/read-signal.test.ts` citing bullet 10, with a `read` that records its signal and never settles. Builder: `packages/std-live/src/live.ts` passes the bound's controller signal (aborted at the bound and in `onDispose`) as `opts.read(ctx, b.signal)`, widens the `read` type to `(ctx: C, signal: AbortSignal) => Promise<Result<P, E>>`, updates the doc comment, the README and the `keel-realtime` skill example if it shows `read`, and adds a changeset (`@keel/std-live` minor).

# RFC 0113: std.schedules: an entry without a mark stores its start time

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0518. ADR-0135 records it.

## Problem
std.schedules Restart says "an entry without a mark starts from now". `packages/std-schedules/src/internal/runSchedule.ts` reads that as: with no mark, look only forward from `ctx.clock.now()`. Run says an `err` from `enqueue` stores no mark and rejects `run`, which k.topology runs again.

Put the two together for a new entry. Its first fire time `t` comes, `enqueue` errs, no mark is stored, `run` rejects. k.topology starts the runner again at some time after `t`; the entry still has no mark, so it starts from that new now, and `t` is before it. The fire at `t` is never enqueued, under `'once'` too. Every later fire is retried this way because each has a mark before it; only the first fire of an entry can be lost.

## Proposal
At start, before it waits, the runner stores the start time as the mark of each entry that has none, in the one `ctx.storage` key `std.schedules.<module>` that holds the marks (one `set` for all such entries). From then on the entry has a mark, and the existing Restart rule covers the first fire like any other: a rerun after `t` sees `t` passed since the mark, and `'once'` enqueues it once (the key `<id>@<t>` makes a second enqueue add nothing, std.jobs). `'skip'` enqueues none, as for any missed fire.

"Starts from now" keeps its meaning: the start time is the mark, and `seek` looks for fire times after it, so a fire time before the first start is never enqueued. A failing start write rejects `run` like a failing mark write after a fire.

## Alternatives
- Retry the failed first `enqueue` inside `run` before rejecting: a second retry policy beside k.topology's restart, and the fire is still lost if the process ends during it.
- Store a mark only on the first `err`: no mark exists when the process dies between the fire time and the `enqueue`, so the fire is lost there instead.

## Spec diff
std.schedules, the Restart bullet, whole new text:
```
- **Restart.** The mark survives a restart. At start, an entry without a mark starts from now: it stores the start time as its mark before it waits, so a fire whose `enqueue` errs has passed at the next start. If fire times passed since the mark, `'once'` enqueues one job for the latest of them and `'skip'` none. When `signal` aborts, the runner stops waiting.
```
Conformance, appended as the last bullet:
```
- With no mark, a first fire whose `enqueue` errs rejects `run`; started again after that fire time, `'once'` enqueues exactly one job for it, with key `<id>@<t>`.
```
Section length 3,864 to 4,143 characters (966 to 1,036 tokens).

## Conformance diff
One `rfc:0113` commit by the `conformance-writer`:
- New `packages/std-schedules/conformance/first-fire-err.test.ts`, citing the new bullet: sim ctx at 02:59Z, entry `0 3 * * *` with no mark, `jobs.enqueue` spied to return `err` once; `run` rejects after 03:00Z; the spy restored, the clock moved to 03:30Z and `run` started again: one job is enqueued, key `orders.nightly@<03:00Z ms>`, and running the queue runs it once.
- `packages/std-schedules/conformance/e2554.test.ts:89`: the `ok` fire now records two writes to `std.schedules.orders` (the start mark, then the fire's mark); the assertion becomes `["std.schedules.orders", "std.schedules.orders"]`.
- `packages/std-schedules/conformance/e2554.test.ts:94`: the `err` fire records only the start write; the assertion becomes `["std.schedules.orders"]` (no write after the `err`).
- `missed-and-crash.test.ts` needs no change: its title at line 135 still quotes "starts from now", and its second run has a mark, so no start write meets the rejecting spy at lines 104-106.

## Migration
None for apps: a deployed entry that already has a mark sees no change, and an entry without one gains a mark at its next start. The `std.schedules.<module>` value keeps its shape (entry id to epoch ms).

## Build order
1. Orchestrator: `spec/std/std.schedules.md` (done with this RFC). The `conformance-writer`: the conformance diff above.
2. One std-schedules lane owns `packages/std-schedules/src/internal/runSchedule.ts` (the start write and its doc comment), `packages/std-schedules/test/**`, `packages/std-schedules/README.md` if it states the Restart rule, and a changeset (`@keel/std-schedules` patch). It runs `check`, `build` and the std-schedules suite once.
3. Orchestrator: ledger, backlog 0518 closed, HANDOFF.

## Token impact
std.schedules 966 to 1,036 tokens (3,864 to 4,143 characters). No other section changes.

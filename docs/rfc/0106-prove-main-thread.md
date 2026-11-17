# RFC 0106: `prove` refuses a call in a worker thread (E1721)

Status: accepted by the orchestrator under WORKFLOW RFC defaults 6 and 7 (2026-11-17), for the user to confirm or reverse. For backlog 0699. ADR-0129 records it.

## Decisions
- D1: `prove` called where `isMainThread` of `node:worker_threads` is `false` rejects E1721 before any other check and before Z3 loads. The message is `prove runs on the main thread; this call is in a worker thread` (default 6: a guard is possible, so the kernel refuses instead of the docs warning).
- D2: one new code, E1721, in k.prove's rule list and in the explanations catalog, with the fix `test: { pool: "forks" }`. No new API and no option to switch the refusal off: a second way to call `prove` that can hang is no way (default 2).
- D3: k.prove gains one rule bullet and one conformance bullet, 1,451 to about 1,490 tokens of 1,500.
- D4: `@keel/check` holds the catalog row and has 62 B of room; it is re-based by one 0.25kb step if the row takes it over (default 7).

## Problem
Measured on `jdforsythe/test-impl` at `77a9112d`, Node 24.19.0, `z3-solver` 5.3.3.

`z3-solver` is an Emscripten pthreads build. An evaluation runs on a solver thread while the calling thread keeps making Z3 calls (a config, a context, their release). When the calling thread meets the solver thread inside the allocator it waits on a futex, and Emscripten's futex wait asserts `emscripten_is_main_browser_thread()` for a caller that is itself a worker. The process then aborts, or the wait never ends.

- `packages/testing/test/prove.overlap.test.ts` forces that meeting. In a forked process it passes. Under `vitest run --pool=threads` it aborted once and hung 245 s once on 2026-11-17 (night), and hung past a 150 s bound on the same day (this RFC's run).
- `packages/testing/test/prove.board.test.ts`, a plain proof, passed twice under `--pool=threads` in 1 s. So a proof in a worker usually resolves, and sometimes takes the process down or holds it until the runner's timeout, with no coded line.
- Nothing in `packages/testing` reads `isMainThread`. k.prove says Z3 is "single-threaded" and says nothing of the caller's thread. `pnpm test` and the mutation run use forks, so the repo does not meet it; an app whose runner uses worker threads does.

A proof tool that hangs one run in some is worse than one that refuses: the author cannot tell a slow proof from a dead one, and E1717 (no verdict within `rlimit`) never fires because the solver is not the part that is stuck.

## Proposal
`prove` begins with the thread check. In a worker thread it rejects with `proveError("E1721", "prove runs on the main thread; this call is in a worker thread", {})`; `see` is `k.prove`. The check precedes the E1710 argument checks, the `initial` check and `loadTools`, so the refusal is the same whatever the arguments and Z3 is never loaded in the worker.

`@keel/testing/prove` is a Node entry (k.prove API), so the `node:worker_threads` import adds no platform. A forked test process, a plain `node` script and the CLI are main threads and see no change.

The catalog row: `E1721`, "prove: called in a worker thread", "Z3 can abort or hang when its caller is a worker; run the test in a process.", fix `test: { pool: "forks" }`, `k.prove`.

## Alternatives
- A sentence in k.prove and no guard. Rejected: default 6, and the failure is a hang with no code.
- Running Z3 in a child process that `prove` starts. It would work from any thread, and costs a process start and a serialised query per call; nothing needs it while forks is the runner's default. Left out; `tasks/FUTURE.md` holds it.
- Refusing only overlapping calls. Rejected: `prove` already serialises its own calls, and the meeting is between one call's main-thread work and its own solver thread.
- An option to allow the worker. Rejected: D2.

## Spec diff
k.prove, after the E1718 bullet:
```
- E1721 `prove` called in a worker thread, where Z3 can abort or hang (fix: vitest `pool: "forks"`).
```
k.prove Conformance, last bullet:
```
- In a worker thread, `prove` rejects E1721.
```

## Conformance diff
New `packages/testing/conformance/prove-e1721.test.ts`: a `node:worker_threads` worker calls `prove` with transactions that prove on the main thread, and the call rejects with code E1721; the same call on the main thread resolves. No existing conformance file changes.

## Migration
An app or runner that calls `prove` in a worker thread now gets E1721 on every run instead of a pass on most. Set the runner to processes: vitest `test: { pool: "forks" }` (its default). No golden app changes: each runs its proofs under forks.

## Token impact
k.prove 1,451 to about 1,490 of 1,500. No other section changes. The map is unchanged.

## Known limits
The guard reads the thread, not the runtime: a main thread of a runtime other than Node is outside k.prove's API line and outside this check.

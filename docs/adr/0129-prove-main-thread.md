# ADR-0129: `prove` refuses a call in a worker thread with E1721 (RFC 0106)

**Status:** accepted by the orchestrator under WORKFLOW RFC defaults 6 and 7 (2026-11-17); the user confirms or reverses.

**Context.** `z3-solver` is an Emscripten pthreads build: an evaluation runs on a solver thread while the caller keeps making Z3 calls. When the caller is itself a worker thread and meets the solver thread in the allocator, Emscripten's futex wait asserts it is on the main thread; the process aborts or the wait never ends. A plain proof in a worker usually resolves; `prove.overlap.test.ts`, which forces the meeting, hangs under vitest's threads pool and passes in a forked process. There is no coded line when it happens, and E1717 does not fire.

**Decision.**
- D1: `prove` reads `isMainThread` of `node:worker_threads` first; in a worker it rejects E1721, `prove runs on the main thread; this call is in a worker thread`, before any other check and before Z3 loads.
- D2: E1721 joins k.prove's rules and the explanations catalog with the fix `test: { pool: "forks" }`. There is no option to allow the worker.
- D3: k.prove gains one rule bullet and one conformance bullet.

**Alternatives.**
- A sentence in the spec with no guard. Rejected: the kernel enforces where it can (default 6).
- Z3 in a child process started by `prove`. Left out: a process start per call, and nothing needs it while runners default to processes.
- An opt-out. Rejected: a second way to call `prove` that can hang.

**Consequences.**
- A runner on worker threads gets E1721 on every proof and a fix line, in place of a rare abort or hang.
- Main-thread callers, forked test processes and the CLI see no change.
- `@keel/testing/prove` imports `node:worker_threads`; it is a Node entry already.

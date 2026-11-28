# ADR-0075: runners and `close()` are a deployable's lifecycle (RFC 0080)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1 and 3.

**Context.** `createApp` returns `{ fetch }` only: no start hook, no stop, no signal. A job queue or a schedule has nowhere to run and no moment to stop, and a stdlib package cannot add one without a kernel gap being closed (default 1).

**Decision.** A module's background work is the `runners` export of `modules/<id>/runners.server.ts`: a list of `Runner`s `{ run(ctx, signal) }` that stdlib packages build. `createApp({ runners })` calls each `run` of the served deployable's modules once after startup with the app's `ctx`; a `run` that rejects before its `signal` aborts is a `diag` on the log and runs again 1,000 ms later on `ctx.clock`. `app.close()` aborts every runner's `signal` and every open event stream and resolves when every `run` has settled. Scheduling uses `ctx.clock.after(ms, signal)`, which has real, shell and sim implementations; no capability is added.

**Alternatives.**
- A `process` capability on `ctx`, rejected: one lifecycle per `ctx` where each runner needs its own signal, and k.ctx has no room.
- A file convention a package registers from `./tools` (`jobs.server.ts` imported because a package says so), rejected: action at a distance (principle 2).
- Jobs inside `routes.ts` or `routes.jobs`, rejected: a job is not an HTTP surface, `routes.ts` reaches clients for links, and k.router has no room.

**Consequences.**
- One file per module says what it runs; std rules E2504 and E2553 report a queue or schedule missing from it.
- A restart is `close()` and a new `createApp` on the same `ctx`, which is how tests and the exit proof simulate one.
- E1552 accepts a module with runners and no routes, so a deployable of jobs alone is valid.

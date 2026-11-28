# k.supervise: Supervised work
status: conformance-covered

**Purpose.** Some code runs other code and must outlive whatever that code throws: a job runner and its jobs, a channel route and its `member`, a live view and its `read`, an outbox and its storage driver. Such code is an owner of those throws, as a `Boundary` and the server's request are (k.errors): it reports each one and goes on. `attempt` cannot say this: its `expect` names the values it expects and never sees a defect (k.attempt, k.expect). `supervise` is the one form that takes every throw, and it is written so that it cannot stand in for a catch.

**API.** `supervise(ctx, id, fn, failed)` (`@keel/ctx`).
```ts
const ran = await supervise(ctx, 'jobs.run', () => job.fn(input, ctx, signal), Thrown.make({}))
if (!ran.ok) return again(ran.error.code)
```
- `id` is a string literal: dotted, starting with the id of the module or package that calls. It names the supervised work in the report.
- `failed` is a `KeelError`, the supervisor's own failure for work that threw. It is a value, made before `fn` runs, so nothing of a thrown value reaches it. A `failed` that is no `KeelError` (k.attempt `err`) is the defect E1458, thrown by the call before `fn` runs.
- `fn` returning `v` gives `ok(v)`, and returning a keel `Result` gives that `Result` itself, as `attempt` does (k.attempt); a promise settles the same way in a promise. A returned value whose inspection throws (a `Proxy` whose traps throw) is a throw of `fn`.
- For every value `fn` throws or rejects with, a defect and a value wrapping one among them, `supervise` reports the value once (Report) and gives `err(failed)`. It never throws and never rejects for a throw of `fn`; a throw of the reporting itself is dropped. So a supervised throw neither hangs its caller nor ends the process (k.leave Process).
- `supervise` sets no time: a promise that never settles leaves its call pending, since only the owner of the work knows how long it may take and how to stop it. Each supervisor bounds its work on `ctx.clock` (the table below).
- The caller learns that the work threw and nothing more: not the value, its class or its text. Code that must tell one failure from another uses `attempt(fn, expect)` inside `fn`.

**Report.** A supervised throw is reported once, as the throw it is, never as the value `failed`:
- on a server `createApp` serves, one `diag` with code `keel.unexpected` whose message is `supervised <id> threw: ` and the thrown value's form (k.serverlog Thrown values). A defect is written as a defect, with its code, fingerprint, site and causes; its text follows only where that section writes text;
- on every ctx, one `error` event to its observers (k.ctx): the `KeelError` `{ code: 'keel.unexpected', message: 'keel.unexpected', data: { at: <id> } }`. The event holds nothing of the thrown value.

**Who writes it.**
- A kernel package and a library's file (k.library) may call `supervise`. `keel review` lists every call (R1018, k.escapes), for a person to read that `fn` runs code the caller does not own and that `failed` is handled.
- In app code a call is E1461. An app that must run code it does not own (a plug-in, a script a customer wrote) keeps that runner in a library package of its workspace (k.library), where review lists it. The stdlib is held to the same rule: each of its supervisors is a library's call, listed.
- `supervise` is no second catch. It hands back no thrown value to test, it writes every throw to the log as a failure, and its `failed` cannot depend on what was thrown. Not held: a library that wraps its own code in it and so hides its own bugs from its caller; R1018 is where a person sees that.

**The stdlib's supervisors.** Each failure path below runs for any thrown value, a defect and a non-`Error` among them, after the report.

| Supervisor | `id` | Supervised | Bound on `ctx.clock` | After a throw or the bound |
| --- | --- | --- | --- | --- |
| std.jobs' runner | `jobs.run` | a job's `fn`, a workflow step's `run` among them (std.workflows) | the job's `timeoutMs`, then its `signal` aborts (`jobs.timeout`) | `err` `jobs.thrown`: the run counts an attempt, waits and runs again, or moves to `failed` with that code |
| std.channels' route | `channels.member` | `member` (synchronous), the re-read of `stores` before it, and `currentUser()` | 5,000 ms for a save's read (std.channels); `identify`'s own 5,000 ms (k.user) | a denial: at open and at a delivery the stream gets `closed` `denied` and ends; at a publish, 403 |
| std.live | `live.read` | `read` | 30 s, then its `signal` aborts | a failed read: nothing is committed, `status()` is `connecting`, and the next read runs on the backoff std.live gives |
| std.offline | `offline.storage` | one `ctx.storage` call | 10 s for a write (std.outbox) | the entry is `failed` with `offline.storage` (std.outbox) |

**Rules.** E1461 `supervise` called in app code, at the callee, message `supervise in app code: a library owns supervised work; here use attempt(fn, expect)`; or, in a library's file, with an `id` that is no string literal, at the argument, message `supervise id is not a literal`. No fix. At run time, the defect E1458 `supervise takes a KeelError as failed` (API). The callee is found as k.unsafe One path says. R1018 (k.escapes) each call.

**Conformance.**
- With `T` a `KeelError` and a sim ctx: `supervise(ctx, 'm.run', () => 1, T)` is `ok(1)`; `supervise(ctx, 'm.run', () => err(U), T)` deep-equals `err(U)` for a second `KeelError` `U`; each `async` form resolves to the same; and none of them reports an `error` event.
- With `t` each of `new Error('a')`, the string `'s'`, `undefined`, the object `{ code: 'x' }`, a value `defect('bug', { code: 'E2801' })` throws and `new Error('w', { cause: d })` for `d` a defect: `supervise(ctx, 'm.run', () => { throw t }, T)` returns a value deep-equal to `err(T)` and does not throw, and `supervise(ctx, 'm.run', async () => { throw t }, T)` resolves to the same and does not reject.
- For each of those throws an observer of `ctx` gets exactly one `error` event, its `error` deep-equal to `{ code: 'keel.unexpected', message: 'keel.unexpected', data: { at: 'm.run' } }`; with an observer that throws, `supervise` still returns `err(T)`.
- In production mode on a node server, a runner calling `supervise(ctx, 'm.run', () => defect('user failed', { code: 'E2801', data: { email: 'jane@x.com' } }), T)` logs one `diag` whose code is `keel.unexpected` and whose message matches `^supervised m\.run threw: Defect E2801 #[0-9a-f]{8}( at \S+:\d+)?$`; no logged line holds `jane`; the process writes no E1577 and keeps serving; with `mode: 'dev'` a second `diag` follows whose message starts `supervised m.run threw: Defect: E2801 user failed`.
- In `modules/m/a.ts` of an app, `supervise(ctx, 'm.run', f, T)` is one E1461 at the callee, message `supervise in app code: a library owns supervised work; here use attempt(fn, expect)`, with no fix; in `node_modules/@acme/jobs/src/run.ts` of a library (`"keel": "library"`) the same call is none, and `supervise(ctx, name, f, T)` with `name` a `const` string there is one E1461 at `name`, message `supervise id is not a literal`.
- `keel review` reports one R1018 for each `supervise` call of a library's file, and none for a file with no such call.
- A std.jobs job whose `fn` calls `defect('bug')`, throws the string `'s'` or rejects with `undefined`, with `attempts: 2`: the runner runs it twice, the job is then in `failed` with code `jobs.thrown`, each run logs one `supervised jobs.run threw: ` record, a job enqueued after it runs, and the process has no unhandled rejection.
- A std.channels route whose `member` calls `defect('bug')` or throws the string `'s'`: a stream opened on it gets `{ kind: 'closed', reason: 'denied' }` as its only event and ends within 1,000 ms on `ctx.clock`, and a publish answers 403.
- A std.live `read` that calls `defect('bug')` or throws the string `'s'` on its first run and returns `ok` on its second: `status()` is `connecting` after the first, a second read runs 1 s later on `ctx.clock`, and `status()` is then `live`.
- With every `ctx.storage` write rejecting with the string `'s'` or with a defect, std.offline's `send` leaves the entry `failed` with `offline.storage`, and the process has no unhandled rejection.

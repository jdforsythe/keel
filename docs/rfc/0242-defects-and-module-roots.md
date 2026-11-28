# RFC 0242: k.errors and k.reactive: `defect`, `attempt`'s `expect`, module roots; no `unsafe` throws, catches or detached scopes

Status: D1 to D40 implemented (ADR-0264), but E1260, which waits for RFC 0251's `processSlot` (the plan's D226). A breaking review passed the model at its root and failed it at its edges: D41 to D56 settle those (Breaking review, below), implemented; a re-review passed the wall test again and found nothing wrong at the root: D57 to D71 close what it found (Re-review, below), implemented; where they differ from an earlier decision or section of this RFC they replace it. A third review tried to break the build and found the error model wrong at its root: D21 to D40 restate it (Third review, below); where they differ from an earlier decision or section of this RFC they replace it. For the operator to confirm. Under the plan's D191 and D192. Amends k.errors (Split, API, Rules, Layers), k.reactive (Static), k.unsafe (Type predicates, One path, E1762), k.escapes (R1015, R1017), k.serverlog (Thrown values, E1596), k.store (Guards), k.schema (Guard, `parseJson`, rule `json`), std.postgres (Errors). New sections: k.attempt, k.defects, k.fixes, k.identity, k.shared, std.postgres-errors; after the breaking review k.supervise, k.expect, k.realm. Glossary: **defect**, **module root**, **kernel-held identity** (in place of key guard, which this RFC introduced and no release held), **fix chain**, **supervisor**, **coded refusal**.

## Decisions
- D1: `defect(message: string, code?: DefectCode): never` and `isDefect(x: unknown, code?: string): x is Defect`, in `@keel/schema` beside `ok`, `err` and `attempt`. A defect is an `Error` named `Defect`, its message `<code> <message>` when a code is given, its `code` a non-enumerable own property. `DefectCode` is `` `E${number}` ``; E1455 holds a given code to a literal `E` and four digits.
- D2: `attempt(fn, expect?)`. Without `expect`, as today. With it, a thrown or rejected value that is no defect goes to `expect`; a `KeelError` it returns is the `err`, `undefined` throws or rejects with the very value. A defect is never handed to `expect`.
- D3: `try`/`finally` without `catch` is ordinary code (E1452 already reads it so; k.errors now says it): the cleanup-then-rethrow sites use it.
- D4: an `unsafe(` range no longer lifts E1451 or E1452, in an app or a library: a throw is a defect, a catch is `attempt`. E1451's message names `defect`.
- D5: state a library keeps for its module's life lives in a module root, entered later with `run`; what a module root is, D11 says.
- D6: E1207 is lifted nowhere and judged in every file but a kernel package's own (`packages/<p>/`, `<p>` one of the fifteen kernel folders): no stdlib package or library detaches a scope.
- D7: R1013 (`keel review`, medium): a `defect` call on a `Result`'s `err` branch, for a person to judge whether the failure was expected.
- D8: the code is optional. A section that names a code for a throw passes it; a throw no section codes takes none. Giving every stdlib throw a code is a later sweep, not this RFC.

- D9 (review): a type predicate or assertion whose claimed type holds a call or construct signature with a parameter or a non-`void` return, or a type parameter of the predicate, is E1762 outside an `unsafe(` call: it is a cast nothing counts. A key guard (a mark the module set) is none. `keel review` lists every other predicate (R1015). The kernel exports key guards `isStore`, `isTransaction` and `isSchema`.
- D10 (review): E1452 also refuses a `return`, `break` or `continue` that leaves a `finally` block, everywhere, kernel included (structure-lint): a catch by another name, so the catch code.
- D11 (review): the owner stays synchronous; Keel keeps none across `await`, since a browser has no async context to keep it in. A module root is only the scope the compiler runs a module's top-level statement in. `scope(fn)` made while no scope runs and no module root is being made is E1208, a defect at run time; check reports the shape it can see (a `scope` or primitive call after an `await`).
- D12 (review): a failure a caller could meaningfully handle is a value, also when it reaches the code as a platform's throw; a defect is a bug or corrupted state. std.postgres gives `postgres.database { sqlstate }` for classes `22`, `40` (but the reruns), `53`, `54`, `55`, `57` (but `57P01` to `57P03`, `keel.unreachable`) and `P0`; any other SQLSTATE is the defect E2461. A `follow` that cannot listen reports `lost`.
- D13 (review): R1013 is defined by flow, as TypeScript narrows `.ok`, not by a list of shapes.
- D14 (review): the defect mark is an own key `Symbol.for('keel.defect')`, so a second copy of `@keel/schema` knows it; a defect that crosses a clone, a worker or JSON arrives as a plain value. `attempt`'s `expect` never sees a value wrapping a defect through `cause` or `errors`.
- D15 (review): E1451, E1452, E1455 and E1207 find their callee by its symbol in the type pass (aliases, literal computed members, `call`, `apply`, `bind`, `Reflect.apply`); any other value use of the function is the code at that use. E1451 adds `Promise.reject`; E1452 adds `.then(f, g)`, `Promise.allSettled` and `Promise.any`.
- D16 (review): no new section (`keel docs`' map is at 1,689 of 1,690 tokens and a section adds 7): the key and wrappers go in k.errors, callee resolution in k.unsafe One path (the one path around a check), E1762 in k.unsafe.
- D17 (director, 2026-11-26): tests run a package's `src` as the product ships it. In a library package's own folder (`"keel": "library"`) `keelConfig` runs the compiler's own plugin (`@keel/compiler/vite`), so the library's top-level statements run in module roots under test as in an app that lists it; test files stay uncompiled (the compiler's test-code paths gain `conformance/`, as k.check App code reads them), so a test file's top level has no module root, as Roots outside module evaluation says; a kernel package ships through `tsc` alone and its tests run it so. This replaces that section's "`keelConfig` runs no Keel compiler". Rejected: making std-headless build its charts lazily, which reshapes a library to suit an uncompiled test run.
- D18 (builder): std.outbox-owner's "declared outside a scope" meant shared by several ctxs, not ownerless: such an outbox is declared at a module's top level (its module root) or, in a test, in a `detached` root. A maker called with no owner stays E1203; the clause's wording follows the rule.
- D19 (builder): PGlite keeps no statement timer and gives no way to cancel a running statement (it runs in-process, synchronously, and has no cancel request), so a driver timer cannot end one and a check after it returns would report a timeout for a statement whose effects stand. std.postgres' 57014 clause holds on Postgres only; on a `pglite:` engine a statement that leaves `statement_timeout` other than `0` sets it back to `0` and fails with `0A000`, the defect E2461: refused where it is set, never ignored.
- D20 (builder, at the merge with the main line): structure-lint's code for control leaving a `finally` is S0020, since the main line's S0018 is a raw temp folder in test code; S0019 (E1762) keeps its number.

- D21 (third review): the wall test is this RFC's acceptance test. Ordinary correct code is ported by applying the first fix each diagnostic offers, else the edit its message names, until check is clean; the end is correct or the RFC is wrong. It is conformance: the fix chains of k.fixes.
- D22: a failure is one of two things in types. Expected: a `KeelError` (code, typed data, optional `cause`) in a `Result`, whose error type is bounded to `KeelError`. Unexpected: anything thrown. `err` takes a `KeelError` only (E1458 at check, a defect at run time).
- D23: `attempt(fn, expect)`, `expect` required. `fn` returns a value: `ok`. Returns a keel `Result`: that `Result`, never nested. Raises a defect: passed on, unseen. Throws anything else: `expect` decides; `undefined` passes the value on unchanged. A thrown object shaped like a `KeelError` is treated as any other throw. This replaces D2's "without `expect`, as today".
- D24: an `expect` tests its parameter (E1452 when it has none or never uses it); one that claims by `instanceof Error` alone is R1017 in review.
- D25: the throwing built-ins an author meets weekly are listed in k.attempt; a bare call is E1457. Keel gives a total form where it is the better product (`S.parseJson(text)`, since parsed JSON needs a schema anyway; `URL.parse` is the platform's), and `attempt(fn, expect)` for the rest.
- D26: a function that throws today is not rewritten by a fix. E1451's message names both ends: a `Result` return when a caller can act (each caller then returns it on or reads it, E1453 holding them to it, up to an owner that takes a `Result`), a defect when none can.
- D27: cleanup after a failure is `try`/`finally` with a flag; a library that owns a resource owns its rollback (std.postgres `transaction`). No kernel helper.
- D28: the cause travels as data. `X.causedBy(cause, data)` wraps, `X.in(e)` finds a typed error on the chain (8 steps); std.postgres' `keel.conflict` carries the `postgres.database` error that caused it.
- D29: the autofix rule (k.fixes): a fix is offered only when its output compiles in place, behaves as before for every input, callers' failures included, and leaves nothing behind. Per code: E1451 only `throw <KeelError>` where the return type takes the `Result`; E1452 only cleanup-and-rethrow, to the flag form; E1455 only the missing `cause`; every other form, none.
- D30: E1451's, E1452's, E1453's, E1203's and E1208's messages and explanations are rewritten to name the shape to write (k.errors Rules, k.reactive Static, k.fixes Explanations); every example in an explanation compiles, as conformance.
- D31: module state on a server (k.shared). While a request is served, a write to any node a module root owns, and making a node in a module root, is the defect E1256: the rule is on the node's owner, so no maker is outside it. Check reports the visible forms: a `set` on a module-level signal in server code (E1256), a write to plain module state there (E1260). Per-request state lives in the request's scope, per-process caches in `processSlot` (RFC 0251).
- D32: identity is the kernel's record, not a key (k.identity). Each maker records what it made in a `WeakSet` or `WeakMap` in the realm's kernel record; made values are frozen; a copy is not the thing and is refused where handlers are bound (E1515); the server reads schemas and personal-data sets from the maker's record. This replaces D9's key guards and D14's own key.
- D33: E1762 restated (k.identity Proven predicates): a predicate's body is one of five proofs (a proven predicate, an owned or built-in class, the module's own set with typed adds, a schema's `parse`, a structural check of every property) or it is E1762; a type holding a signature only by the first three; assertions the same.
- D34: `Secret` has no static member, and the constructor reached from an instance is the defect E1764.
- D35: a production log holds of a thrown value its class, a code Keel knows, a keyed fingerprint, the top frame and the causes' classes and codes, never its text (k.serverlog Thrown values). Full text only under `mode: 'dev'` or until the instant `KEEL_LOG_THROWN` names, at most 24 hours ahead (E1596).
- D36: `defect(message, code?, detail?)`: the message a literal (E1455), values in `detail.data`, the failure that led here in `detail.cause`; on a failed `Result`'s branch the cause is required, with a fix.
- D37: on PGlite the driver reads the effective `statement_timeout`, the per-database and per-role defaults and each function's setting after every statement and refuses any value but `0`, by value and never by text (std.postgres-errors). Class `08`: `08000`, `08001`, `08003`, `08006` are `keel.unreachable`; `08007` is `postgres.database`; `08004`, `08P01` and the rest are the defect E2461.
- D38: each minor finding has a home (The minors, below).
- D39: the guarantee is stated in layers (k.errors Layers), as RFC 0245 states its own.
- D40: six new sections, since k.errors, k.unsafe, k.leave and std.postgres are at their limits. `tooling/budgets.mjs` reports no token line over with them; `keel docs --for E1451` stays within its 400 by naming the code in fewer lines. This replaces D16's "no new section".
- D41 (breaking review): code that runs other code and must survive its throws calls `supervise(ctx, id, fn, failed)` (`@keel/ctx`, k.supervise). Every throw, a defect among them, is reported once as the throw it is (a `supervised <id> threw:` record by k.serverlog's rules, an `error` event to observers) and the call gives `err(failed)`, `failed` a value made before `fn` runs. Kernel packages and a library's files may call it, each call listed by review (R1018); in app code it is E1461.
- D42: an `expect` is a function check can read, and it claims only in a branch a test of the thrown value selects, with `undefined` in its return type (k.expect Readable, Decides; E1452). Truthiness, a self-comparison, `void x` and a value used only in the error are no test. What cannot be proven narrow is review's (R1017, widened).
- D43: an `expect` carries a number, a boolean or a literal union out of the thrown value, never text (k.expect Carries, E1460). A `make` or `causedBy` message is a literal (E1460).
- D44: a `KeelError` is made by `make` or `causedBy` only; an object literal where one is expected is E1458. The kernel's codes an author returns are `keelError.denied`, `.notFound`, `.conflict`, `.unreachable`, `.busy` and `.fields` (`@keel/schema`).
- D45: no `Result` in a `Result`. `ok` given one is E1459 in check's type pass and a defect at run time; `ok`'s TypeScript signature stays `ok<T>(value: T)`, since a type that refused a `Result` would refuse every `ok(v)` over a type parameter.
- D46: identity is held in a binding of the maker's own package, under no key (k.identity). This replaces D32's realm record and D14's reason for it. A realm holds one copy of each kernel package: a second copy is E1765 at its evaluation, naming both file URLs, and at check and build (k.realm).
- D47: the `keel.` registered symbols are the kernel's: naming one, or listing the global object's symbol keys, in app or library code is E1766; a `Symbol.for` check cannot fold is R1019. The kernel reads `WeakSet`, `WeakMap` and their methods once at evaluation.
- D48: a coded refusal at start is printed with its own code, message and `see`, in production too, and exits 1; E1577 is for a value Keel did not raise (k.deploy Refusals at start). An unknown module in `topology.ts` is E1552 at `keel check` and `keel build` (k.topology).
- D49: an E1577 record is one record; with full text on (dev, or before `KEEL_LOG_THROWN`'s instant) the scrubbed text follows its form in that record (k.serverlog, k.leave).
- D50: E1260 and `processSlot` leave k.shared until the RFC that builds them: nothing refuses a request's write to plain module state today, and k.shared, k.resume and the keel-server skill say so and say where a config value, a pool and a cache go. A section's Rules names only codes that have an explanation row, whatever its status (k.explain).
- D51: catches and throws under other spellings: a promise's `then`, `catch` or `finally` taken by a binding pattern, a promise member under a computed key, a generator's `throw`, and a listener for uncaught throws are refused by check (k.unsafe Other spellings); a listener whose event name is no literal is R1020.
- D52: a getter or `Proxy` that throws while `attempt` searches for a defect ends the search; `expect` gets the first thrown value. `err` refuses `data` that is `undefined` or a function. The production site is the source line, read through the map.
- D53: `explain`'s `see` is printed whole; E1457's message names `Prefs.parseJson(text)`, so a schema's method is not read as `s.json`'s.
- D54: the guarantees whose cases the migration dropped are stated as clauses: a dev page for E1256 names the store (k.shared #9), and the scrub holds in production mode inside the window (k.serverlog #18).
- D55: the three wall-test patterns (retry, rollback, wrapping an SDK) do not fit a skill: each published skill sits at its token target, and a target is not raised in a lane. The keel skill points to `keel explain E1452`; the block is in this RFC for the operator's re-base.
- D56: three new sections (k.supervise, k.expect, k.realm), since k.attempt, k.errors, k.identity and k.leave are at their limits.
- D57 to D71 (re-review): closed data for what an `expect` carries, closed database errors, Decides' shapes, the start window, E1766 by what is done, the trusted slots, supervise's minors, std.channels' bound, a workspace library, R1018 one hop, E1765's message, one defect form, `races`' `threw` (Re-review, below).


## Problem
The `unsafe` count is 33 on the main line (d829b060) and 41 in `lane-std-formats` (466b3d5a). It was 13 when only the kernel was held to the rules. RFC 0163 put the stdlib on the library format, so each package is read as app code in every app that lists it. The mover lanes met the rules by wrapping, and three wrappers account for 19 of the main line's 33 and 26 of the lane's 41.

1. **A throw for a bug.** E1451 refuses `throw` in app code, and k.errors' Split says unexpected failures (bugs, broken invariants) are exceptions, so the stdlib has no way to say "this is a bug" but an `unsafe(` range around `throw new Error(message)`, which k.check lifts E1451 for. Eleven such files on the main line: `std-channels/unsafe/fault.ts`, `std-conflicts/unsafe/raise.ts`, `std-db/unsafe/raise.ts`, `std-headless/unsafe/keyFault.ts`, `std-jobs/unsafe/refuse.ts`, `std-live/unsafe/outsideScope.ts`, `std-offline/unsafe/raise.ts`, `std-postgres/unsafe/raise.ts`, `std-schedules/unsafe/refuse.ts`, `std-statecharts/unsafe/refuse.ts`, `std-workflows/unsafe/refuse.ts`. Seven more in the lane: `std-i18n/unsafe/refuse.ts`, `std-messages/unsafe/badSet.ts` and `refused.ts`, `std-money/unsafe/noDecimalForm.ts`, `std-tables/unsafe/tableFault.ts`, `std-temporal/unsafe/notDuration.ts`, `std-text/unsafe/boundFault.ts`. Each reason says the same: "a bug in the app's code, never an expected failure a Result would carry". Some throw a code (`E2801`, `E2503`, `E1203`) by `Object.assign(new Error(...), { code })`, some none.
2. **A catch that keeps what was thrown.** `attempt` is the one catch, and it turns any throw into `keel.unexpected` with `data.cause` a string. A library that wraps a throwing driver needs the thrown object: std-postgres reads pg's SQLSTATE and severity to tell a serialization failure (rerun), a constraint (`postgres.constraint`) and a lost connection (`keel.unreachable`) from a fault; std-db reads its own E2152 and E2153 and the driver's `code`/`errcode`. So `std-db/unsafe/settle.ts`, `settleNow.ts` and `std-postgres/unsafe/settle.ts` wrap `try`/`catch` returning `{ threw, error }`, and std-offline's `afterRejection.ts` and `recovering.ts` catch to note a rejected storage write or rethrow. lane-std-sessions adds `std-sessions/unsafe/caught.ts` and a `raise.ts` that rethrows a caught error after cleanup. Each rethrow `raise(s.error)` is a second wrapper around the first.
3. **A detached scope for module-level state.** `std-offline/unsafe/detached.ts` and `std-statecharts/unsafe/detached.ts` make the store of an outbox or chart declared at module level in `scope(..., { detached: true })`, and `std-conflicts/unsafe/isolated.ts` runs a stores factory in one; lane-std-sessions adds the recorder's `detached.ts`. E1207 refuses `detached` in app code; RFC 0238 lifted it in a library's `unsafe/` ranges, so these count.

What exists that the sites did not use, read from the code:
- `packages/reactive/src/scope.ts`: `scope(fn)` made while `rt.owner` is null has `parent` undefined, and nothing disposes it but its own `dispose()`. `scope` and `run` restore the owner in `finally`, so between jobs no owner runs and a module's top level runs with none.
- `packages/compiler/src/internal/lowerFile.ts` `moduleScope`: each top-level `const x = store(...)` (and `signal`, `computed`, `resource`) runs inside `scope(() => { v = f() })` at module level: a root of its own. This is how an app's module-level store is owned, and the spec never said so.
- `chart` already detaches only when `owner() === undefined`, where a plain `scope` is the same root. The outbox detaches because its store is made on first use (backlog 0493: a store made at import threw E1203), and first use may run under a component, where a plain `scope` would nest and be disposed with it. `run` on a root made at declaration answers that.
- `packages/check/src/rules/noTryCatch.ts` skips a `try` with no handler: `try`/`finally` is no E1452 today.
- `packages/check/src/rules/noDetachedScope.ts` skips every file under `packages/`, the stdlib's included, and RFC 0238 lifted E1207 in a library's ranges: an escape the kernel's rule text does not need.

So the stdlib's escapes are not irreducible. Two are sanctioned ways the kernel lacks (a defect, a catch that hands back what it recognizes), and the third is a way the kernel has and never named.

## Proposal
### Defects (`@keel/schema`, k.errors)
```ts
import { defect, isDefect } from '@keel/schema'

export function keyOf(id: string, key: string): string {
  return /^[a-z][A-Za-z0-9]*$/.test(key) ? `${id}.${key}` : defect(`${id}: key is no identifier`, 'E2801')
}

export function only<T>(rows: readonly T[]): T | undefined {
  return rows.length > 1 ? defect(`one() got ${rows.length} rows`) : rows[0]
}
```
`defect` returns `never`, so it sits where a value is expected (`??`, `?:`, `return`) and narrows as a throw does. It is the one way code held to the rules raises an unexpected failure, k.errors' second half of Split; a bare `throw` stays E1451, everywhere outside a kernel package, `unsafe(` ranges included.

What it is at run time: an `Error`, `name` `Defect`, `message` `E2801 shop: key is no identifier` (the code first, so `toThrow(/E2801/)` cases and log lines keep it), `code` a non-enumerable own property (Node prints it once with the stack). `isDefect(x, code?)` recognizes only what `defect` made (a private brand), so a test, a worker protocol or `attempt` can tell a defect from a platform's throw, and a value named `Defect` by hand is none.

Where it goes: where any throw goes, and nothing more.
- Browser: the nearest `Boundary` renders its fallback with `keel.unexpected`; `mode: 'dev'` shows the message; the ctx's observers get it, and std.sessions scrubs its text of given personal data as for any error.
- Server: a loader's, action's or runner's defect is answered and logged as a throw (k.server); the log's scrub (k.privacy Server log) replaces the request's `.pii()` and secret values in its message. The message is the code's own text and names no value a person gave; that is review's to hold, not a rule's (a key or a count is fine).
- `simulate`: a defect fails the run as a throw does and shrinks the same way. Tests: `expect(() => keyOf('shop', 'Bad key')).toThrow(/E2801/)`, or `isDefect(caught, 'E2801')`.
- `attempt(fn)` without `expect` makes it `keel.unexpected` with `data.cause` `Defect: E2801 ...`, as for any `Error`.

How it differs: a `Result` failure is a value the caller handles and the type names; a defect is a bug the caller fixes. A platform's throw (an `Intl` `RangeError`, pg's error, a `TypeError` from `fetch`) is an unexpected failure Keel did not raise: it reaches `attempt` and its `expect`, which a defect never does.

### `attempt(fn, expect)` (k.errors)
```ts
import { attempt, err, type KeelError, type Result } from '@keel/schema'

type Serial = KeelError<'postgres.serial', null>
const serial: Serial = { code: 'postgres.serial', message: 'postgres.serial', data: null }
const sqlstate = (x: unknown): unknown => (typeof x === 'object' && x !== null ? Reflect.get(x, 'code') : undefined)

export async function once<T>(run: () => Promise<T>): Promise<Result<T, Serial>> {
  return attempt(run, (x) => (sqlstate(x) === '40001' ? serial : undefined))
}
```
`expect` sees each value `fn` throws or rejects with but a defect, and returns the `KeelError` it stands for, or `undefined` for one it does not expect, which goes on as thrown: the very object, so the caller's own `attempt` or the server's log sees what the driver threw. `fn` sync gives a `Result`, `fn` async a `Promise<Result>`, as today. The overload:
```ts
export function attempt<T>(fn: () => T): Attempted<T>
export function attempt<T, E extends KeelError<string, unknown>>(
  fn: () => T,
  expect: (thrown: unknown) => E | undefined,
): [T] extends [never] ? Result<never, E> : T extends PromiseLike<infer U> ? Promise<Result<U, E>> : Result<T, E>
```
A defect skips `expect` so that no library turns its own bug back into a value (`attempt(() => defect(...), isDefect ? ...)` is how throw-as-goto would look), and so a defect from below (std-db's E2152, the testing harness's) passes through every `expect` unchanged, which is what std-db's and std-sessions' catches did by hand.

### Cleanup after a throw
```ts
export function inTransaction<T>(db: { exec(sql: string): void }, fn: () => T): T {
  db.exec('begin immediate')
  let committed = false
  try {
    const r = fn()
    db.exec('commit')
    committed = true
    return r
  } finally {
    if (!committed) db.exec('rollback')
  }
}
```
No catch, no rethrow: the throw goes on unchanged after the `finally`. This replaces every `settle` followed by `raise(s.error)` that exists only to clean up (std-db `tx`, std-offline's `afterRejection`, std-postgres' engines, std-sessions' group handles).

### Module roots (k.reactive)
```ts
import { type Scope, owner } from '@keel/reactive'
import { defect, s } from '@keel/schema'
import { type Store, type Transaction, store, transaction } from '@keel/store'

const Queue = s.object({ items: s.array(s.string()) })
type Q = { readonly st: Store<s.infer<typeof Queue>>; readonly push: Transaction<s.infer<typeof Queue>, string> }

export function queue(id: string): () => Q {
  // At a module's top level the compiler runs this call in a module root, so `owner()` is that root.
  const at: Scope = owner() ?? defect('queue() outside a scope or a module top level', 'E1203')
  const make = (): Q => {
    const st = store(Queue, { items: [] }, { id })
    return { st, push: transaction(st, `${id}.push`, s.string(), (q, x) => ({ items: [...q.items, x] })) }
  }
  let made: Q | undefined
  return () => (made ??= at.run(make))
}
```
A maker finds an owner where it is called: at a module's top level the compiler's module root, in a component or request that scope. It captures it, and makes its state with that scope's `run` on first use, from whatever runs then. Called with no owner, as after an `await`, it raises E1203. `chart` makes its store at once in the owner it finds. A recorder that must outlive the component calling `record` uses a root its package's top level holds (`const recorders = owner()` there, the compiler's module root): `recorders.run(() => scope(fn, { onError }))`, which its `stop()` disposes. `isolated` (std-conflicts) nests: `scope(() => { isolate(owner()); body() })`, then `dispose()`; its entry is server code with no `uses` above it.

Why not an async context: the server has `AsyncLocalStorage` (`packages/server/src/internal/requestSecrets.ts`, std-postgres' `pgliteEngine.server.ts`), the browser has nothing that survives an `await` without patching `Promise`, and an owner that survives `await` on one side only would make one component behave two ways. RFC 0245's `task` is the owner of async work: its `work` runs with its scope as owner until its first `await`, and code after that uses the scope's `run`, as here.

What is refused: a root anywhere but a module's top level. At run time `scope(fn)` with no owner outside a module root is E1208 (`detached`, kernel and test code only, stays the one other root); `store`, `signal` and the rest with no owner stay E1203, both now defects. At check, E1208 and E1203 at a call that follows an `await` in the same function, not inside a `run` callback: the common shape, reported before it runs. What `run` on a module root reaches is module state, as a top-level `store` is, and only top-level code holds a module root.

### Rules
- E1451's message: `throw in app code; return err(...) when expected, defect(...) when a bug`; its fix stays `return err(`.
- E1455: a `defect` call (any alias or `<ns>.defect` of `@keel/schema`) whose second argument is not a string literal `E` and four digits, at the argument, no fix. TypeScript's `` `E${number}` `` lets `E1.5` and a variable through; the code is a stable name `keel docs --for` finds.
- k.check App code: the lifted set loses E1451 and E1452, and a library's file loses its E1207 exception.
- E1207: judged in every project file but a kernel package's own, `packages/<p>/` for the fifteen kernel folders. `noDetachedScope`'s `packages/` test becomes that list.
- R1013 in `keel review`: a `defect` call reachable only where a `Result` is known not ok, read as TypeScript narrows `.ok` over any name, member or call (`if (!x.ok)`, `x.ok || defect()`, `!x.ok && defect()`, `x.ok !== true`, the statements after `if (x.ok) return`, `if (!g().ok)`). This is the abuse check can name and not judge: turning an expected failure into an exception. Some are right (std-db turns `attempt`'s `keel.unexpected` from opening SQLite into E2153), so a person or the `keel-escapes` skill reads each. What `keel check` still refuses: a bare `throw` or `Promise.reject`, any catch but `attempt` (`.then(f, g)`, `allSettled`, `any` and control leaving a `finally` among them), a non-literal code; what review still sees: every `unsafe(` (R1001), every defect on an `err` path (R1013), every type predicate (R1015).

### Roots outside module evaluation (second review)
Tests make scopes with no owner, and a test body is not module evaluation: vitest calls each `describe` and `it` callback as a function, `keelConfig` runs no Keel compiler (it adds a reporter, a watchdog, timeouts and fetch setup), and `keel test` compiles the app's modules and libraries, never a test file. So a test file's top level has no module root. Making one there would give each test file roots no test end disposes, shared by every test in it, and is not done.

The sanctioned roots outside a compiled module's top level:
- **A test** makes its root with `scope(fn, { detached: true })`. E1207 judges app code and a library's files, and test code is neither (k.check App code), so `detached` is allowed there; the test disposes it when done, or leaves a fixture open on purpose. An app's test may instead let `render`, `renderRoute`, `resumeDocument` or `simulate` own what they make; k.test-run disposes those at the test's end. A `@keel/testing` root per test was weighed and not chosen: the kernel packages before `testing` in `tooling/deps.json` (schema, reactive, store, runtime-dom, compiler, router, forms, ui, check, scaffold) cannot import it in their own tests, so it would be a second way beside `detached` that half the kernel cannot use.
- **The kernel's entry points** (`createApp`, `mount`, `resume`, `createRouter`, the harness) make roots as kernel code, with `detached`.
- **A script run by `node`** is not compiled and holds no scope; it reaches Keel state through those entry points or a harness. A REPL is a script.
- At run time a test calling plain `scope()` with no owner gets the E1208 defect, whose message says `in a test pass detached: true`.

The hole stays closed: app code and a library's files cannot pass `detached` (E1207, by symbol, k.unsafe One path), and plain `scope()` after an `await` in a request is E1208 at run time and, for that shape, at check.

`packages/store/conformance/fixtures.ts` `inScope` keeps `scope(fn, { detached: true })`: it is the sanctioned test root, not a stopgap, and its comment says so ("a test's root: left open so callers inspect live stores").

The change, by folder, mechanically: each `scope(fn)` or `scope(fn, { onError })` a test makes while no scope runs (a test body, a hook, a `describe` callback, a helper one calls, any line after an `await`) gains `detached: true`; a `scope` called inside another scope's `fn` or `run` stays; a `scope(` inside a fixture's source text stays; a maker (`chart`, `outbox`, `store`) called at a test file's top level moves into a `detached` scope or the test body.
- `packages/reactive/conformance`, `packages/reactive/test`: top-level `scope(...)` in test bodies (`dispose-hook-throw`, `owner`, `disposal` and the rest) gain `detached: true`; `module-roots.test.ts` uses `moduleRoot` from `@keel/reactive/internal` for k.reactive#22.
- `packages/store/conformance`, `packages/store/test`: through `inScope` (unchanged) and each direct `scope(...)` in a test body.
- `packages/runtime-dom/conformance`, `packages/runtime-dom/test`, `packages/forms/conformance`, `packages/forms/test`, `packages/ui/conformance`, `packages/ui/test`, `packages/router/test`, `packages/compiler/test`: the same.
- `packages/server/conformance`, `packages/server/test`, `packages/testing/conformance`, `packages/testing/test`: the same; a test that renders through the harness needs nothing.
- `packages/std-channels`, `std-conflicts`, `std-headless`, `std-live`, `std-offline`, `std-sessions`, `std-statecharts`, `std-tables` (`conformance/` and `test/`): the same, and each top-level `chart(...)` or `outbox(...)` of a test file into a `detached` scope.
- `packages/check/conformance`, `packages/check/test`, `packages/cli/conformance`, `packages/compiler/conformance`: `scope(` in fixture source text, unchanged.
- `apps/golden-1/test`, `apps/household/test`: the same as the packages, or the harness.

### Closing the review's holes
1. **A predicate is a cast nothing counts.** `testing/src/internal/axeSync.ts`' `isInternals(x): x is Internals` checks that members exist and are functions and then trusts their signatures. In general whether a body establishes its type cannot be decided. k.unsafe now decides the shape it can, E1762: a claimed type holding a call or construct signature with a parameter or a non-`void` return, or a type parameter of the predicate, since no run-time test proves either. A key guard (`WeakSet.has` of a set the file does not export, or an own `Symbol.for` key) is none, and the kernel gives the guards a library needs: `isStore`, `isTransaction` (`@keel/store`), `isSchema` (`@keel/schema`). Every other predicate is R1015 in review. `axeSync` goes back into `unsafe/`.
2. **`finally` can drop a defect.** `try { return defect('bug') } finally { return 7 }` returns 7. E1452 refuses `return`, `break` and `continue` that leave a `finally`, in app code, libraries and every package (structure-lint).
3. **A module root after `await`.** `owner()` is undefined after an `await`, so the first design let a request make a root. Module roots are now the compiler's only; E1208 refuses any other, at run time and, for the visible shape, at check (above).
4. **std-postgres errors are values.** `postgres.database { sqlstate }` for the classes a caller can act on, `keel.unreachable` for lost connections, the defect E2461 for the rest (the app's own SQL wrong, class `42`; the store, `XX`). A caller retries on `57014` or `55P03` and branches on `22001` with types; `40001` and `40P01` stay reruns, then `keel.conflict`; `23xxx` stays `postgres.constraint`. `follow` reports `lost` for a connection that will not listen. std.db keeps defects: its contract (k.persist storage) rejects, and every caller (the store layer, `commitStores`, std-offline's recovery) handles each rejection alike.
5. **R1013 by flow,** as D13.
6. **Wrappers and copies.** `attempt`'s `expect` never sees a value wrapping a defect (`cause`, `errors`, 8 steps); the catches that would make one a value are E1452; the mark is a registered symbol, so a second copy of `@keel/schema` knows it; a clone, a worker message or JSON carries no defect, and the receiver raises its own (std.multi's worker protocol sends message and code, and re-raises). Tests assert with `isDefect`, never `objectContaining({ name: 'Defect' })`.
7. **Callees by symbol,** as D15, stated once in k.unsafe One path for E1451, E1452, E1455 and E1207. With RFC 0245: E1456 there judges whether a promise floats and counts `.then(f, g)` and `.catch(g)` as handling it; E1452 here judges whether a catch is allowed, and refuses both in app code. So `void p.catch(g)` in app code is one E1452 and one E1456, and in kernel code neither. RFC 0245's text needs no change; its `std-channels/src/subscribe.ts` rewrite, which makes `scope(() => undefined)` "a root where none runs", must take the caller's scope instead (E1208 otherwise).

**Audit of the other migrated packages** against D12: std-schedules `runSchedule.ts:29` makes an `enqueue` err (`keel.conflict`, `keel.unreachable`) a defect, logged by the runner as `keel.unexpected` and rerun. That is an expected transient, a value; k.topology's `Runner.run` returns `Promise<void>`, so the fix is a runner that may resolve a `Result` whose `err` is logged by its code and rerun, a k.topology change for its own RFC; until then the defect stands, listed. Every other converted throw (std-channels, std-conflicts, std-headless, std-jobs, std-live, std-offline, std-schedules' declaration checks and stored marks, std-statecharts, std-workflows) is a declaration the spec refuses, a misuse or a stored value that fails its shape: a defect.

### Personas
- F1 (kernel maintainer): `defect`, `isDefect` and `attempt`'s second argument are additions to `@keel/schema`; nothing an app passed `keel check` with breaks but an `unsafe(` range holding a `throw` or `catch`, of which no app or example holds one. Kernel packages keep their own throws (not held to E1451).
- F2 (stdlib maintainer): every escape this RFC removes is replaced by a public export of `@keel/schema` or `@keel/reactive`. No `@keel/std-*` exception remains in E1207, and the stdlib's own `unsafe/` folders hold casts and platform reads only.
- A2 (product engineer): one more word, `defect`, and the checker's E1451 message says when to use it. An app's module-level stores work as before; the spec now says why.
- A3 (enterprise lead): `keel review` lists each defect on an `err` branch (R1013), so a team that turns another's expected failures into crashes is seen in review. A library listed by another team can no longer detach a scope.
- A7 (tester): a defect is a throw; `toThrow` on its message, `isDefect` on what was caught. A red test names the code.
- L1 (component library author): a widget's bad key or prop is `defect(..., 'E2xxx')`, no `unsafe/`. "No `unsafe/`" in their row now holds for refusals.
- L3 (service library author): wrapping a throwing SDK is `attempt(call, expect)`, reading the SDK's error fields into the library's own `KeelError`s; what it does not recognize goes on unchanged to the app's log, scrubbed.
- L4 (data library author): a driver keeping k.persist's rejecting contract raises defects for refused keys and lost connections; `attempt(fn, expect)` reads the database's codes. A module-level store, outbox or chart of theirs lives in a module root.
- Every persona's question 3 ("anything allowed to the stdlib that is refused to them?"): after this RFC, nothing in these three patterns. Question 5 ("the wall"): a throw, a typed catch and module-level state no longer need `unsafe/`.

## Third review: the error model restated
A reviewer ported five ordinary, correct pieces of code two ways: by the diagnostics and `keel explain` alone, and as an agent does, applying the first offered fix until check is clean. For three of the five the agent's path ended clean and wrong. The same review found a cross-request leak, forgeable router marks, thrown text in production logs, casts E1762 let through, and a timeout PGlite never enforces. The verdict was not to merge. The findings share a root: the first design gave a throw three ways to become a value without anyone naming it (a bare `attempt`, a fix that wrote one, an `err` that took anything), and gave identity to a key anyone can copy. D21 to D40 remove those ways.

### What a failure is
Two forms, in types (k.attempt).
- Expected: `KeelError<C, D>`, `{ code, message, data, cause? }`, in `Result<T, E extends KeelError>`. Made by `X.make(data)` of an `s.error`; wrapped by `X.causedBy(cause, data)`; found again by `X.in(e)`.
- Unexpected: anything thrown. `defect('text', code?, { data, cause })` is the one way code held to the rules throws.

What `attempt(fn, expect)` does with each thing `fn` can do:

| `fn` | result |
| --- | --- |
| returns a value | `ok(value)` |
| returns a keel `Result` | that `Result`: flattened, never `ok(err(..))` |
| raises a defect, or a value wrapping one | passed on unchanged, `expect` not called |
| throws a `KeelError`-shaped object | as any other throw: `expect` decides |
| throws anything else | `expect(x)`: a `KeelError` is the `err`; `undefined` passes `x` on unchanged |

`expect` is required. An unexpected throw stays unexpected and passes through `attempt` unless `expect` claims it, so a bug inside the callback is never a value. `err` refuses what is no `KeelError`, so `return err(new Error(..))` is E1458 and a TypeScript error both.

Wrapping a throwing SDK is the documented path, in the spec (k.attempt Wrapping a throwing library), in E1452's message and in its explanation:
```ts
export const CardDeclined = s.error('pay.declined', s.object({ reason: s.enum(['funds', 'expired', 'other']) }))
export const charge = (p: Charge) =>
  attempt(
    () => sdk.charges.create(p),
    (x) => (x instanceof Error && x.name === 'CardError' ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  )
```
The SDK's message (`card declined for jane@x.com`) has nowhere to go: the data's schema is a closed enum.

A `Promise<void>` function that throws: no fix chooses for the author. If a caller can retry, take another path or tell a person, the function returns `Promise<Result<void, E>>`; each caller then writes `if (!r.ok) return r` or reads `r.error`, and E1453 refuses a caller that drops it, so the change ripples exactly to the owner that takes a `Result` (a loader, an action, a `Handler`) and no further. If no caller can act, it is `defect('text')` and no signature moves.

### The wall test, as fix chains
Each chain is a fixture (k.fixes Fix chains): a start project, the first diagnostic at each step with whether it carries a fix, the edit its message names where it carries none, the end project, and a probe that runs the end.

1. **Retry with backoff.** Start: a loop with `try`/`catch`, `throw new Error('HTTP ' + status)` and a sleep. Steps: E1452, no fix (the catch decides by `i`, then rethrows); E1451, no fix (an `Error`, in a function that returns no `Result`). The messages name `attempt(fn, expect)` and `return err(E.make(data))`. End:
```ts
const once = (ctx: Ctx, url: string) =>
  attempt(async () => {
    const res = await ctx.net.fetch(new Request(url))
    return res.ok ? Feed.parseJson(await res.text()) : err(HttpFailed.make({ status: res.status }))
  }, (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined))
const again = (e: FeedError): boolean => e.code === 'feed.unreachable' || (e.code === 'feed.http' && e.data.status >= 500)
export async function fetchRetry(ctx: Ctx, url: string, tries: number) {
  for (let i = 0; ; i++) {
    const r = await once(ctx, url)
    if (r.ok || i === tries - 1 || !again(r.error)) return r
    await ctx.clock.after(2 ** i * 100)
  }
}
```
The `err` returned inside the callback is the call's own `err`: one `Result`, typed, its status intact, retried.
2. **Roll back and rethrow.** Start: `try { await work(db); await db.query('commit') } catch (e) { await db.query('rollback'); throw e }` in a `Promise<void>` function. Step: E1452, with a fix, since the catch only cleans up and rethrows. End, after one fix:
```ts
let done = false
try { await work(db); await db.query('commit'); done = true } finally { if (!done) { await db.query('rollback') } }
```
The thrown value goes on as itself, SQLSTATE and all; std.postgres above it names it `postgres.database { sqlstate: '40P01' }`, reruns it, and after the third run answers `keel.conflict` whose `cause` is that error, so `DatabaseError.in(r.error)` (`@keel/std-postgres`) still reads `40P01` three callers up. No `defect(e.message)` can be written: there is no `e`, and a `defect` message is a literal.
3. **A throwing SDK.** Start: a `catch` testing `e instanceof Error && e.name === 'CardError'`. Step: E1452, no fix (the catch reads what it caught). End: `charge` above.
4. **JSON with a fallback.** Start: `try { return JSON.parse(text) } catch { return fallback }`. Steps: E1452, no fix; E1457, no fix. End:
```ts
const r = Prefs.parseJson(text)
if (r.ok) return r.value
switch (r.error.code) { case 'schema.invalid': return fallback }
```
A defect raised inside is not swallowed, since nothing catches. `return r.ok ? r.value : fallback` also passes this RFC's check; RFC 0245's reading rule then asks for the form above, which stops compiling the day `parseJson` gains a second code.
5. **Cleanup.** `try { use(h) } finally { h.close() }`: no diagnostic, no edit.

The five more an engineer meets weekly are chains too: a validation failure to show (`const r = Draft.parse(input); if (!r.ok) return r`), a not-found (`err(Missing.make({ id }))`), a timeout (`expect` naming `TimeoutError`), a conflict to retry (a loop on `r.error.code === 'keel.conflict'`), and a bug (`row ?? defect('no row', { data: { id } })`).

### Fixes
The rule and the table per code are k.fixes. What the builder deletes: `noThrow`'s `return err(` rewrite of any thrown expression, and `noTryCatch`'s `attempt` rewrite. Both produced the review's wrong ends. The harness (`fix-diffs.test.ts`) today asserts only that the fixed file no longer holds the code; it gains `tsc` and "no new diagnostic" over every fix-carrying fixture.

### Module state on a server (finding B)
k.shared. The leak was a module-level `signal` written in a loader; E1256 refused only stores. The rule moves from the maker to the owner: a node owned by a module root is module state, whoever made it, and a request may read it and not write it. `signal.set` gains the hook stores have (`moduleWrites`), asked only when the node's root is a module root and only on a server; in a browser the hook is unset. A maker that makes its state lazily in a module root during a request is refused too, or its first value would be a request's. Check reports what it can see: `set` on a module-level signal in server code, and a write to plain module state (E1260), which has no node for the run time to guard. A cache a request writes on purpose is `processSlot(name, make)`, named and listed by review.

### Identity and predicates (findings C and E)
k.identity. The marks were enumerable `Symbol.for` keys, made so that a spread would keep its mark; a spread with one member replaced then passed `isAction`, and the server decoded with the forged `input` and scrubbed by it. Now a maker records what it made in the realm's kernel record and freezes it; a spread is a plain object and is refused where handlers are bound; the server decodes and scrubs from what the maker recorded. A wrapper wraps the function before `action` has it.

E1762 no longer asks which shapes cannot be proven; it asks whether the body is one of five proofs. The review's passes all fail it: `typeof x === 'object'` for `{ admin: boolean }` (property `admin` unproven), an empty assertion, `instanceof Promise` for `Promise<number>`, a `Symbol.for` key for a type with methods.

How the lane's key guards and the twelve predicates it moved into `unsafe` end:

| Value | Ends as |
| --- | --- |
| `isLoader`, `isAction`, `isGuard`, `isStub` (router), `Secret`'s `is`, `isSchema`, `isStore`, `isTransaction`, `isDefect` | kernel-held identity; the shape tests beside them go |
| router `objectSchemaOf` | `isObjectSchema` from `@keel/schema`; leaves `unsafe` |
| runtime-dom `propsSchemaOf` | `isSchema(c.Props)`; leaves `unsafe` |
| std-sessions `routeTableOf` | `isRouteTable` from `@keel/router`; leaves `unsafe` |
| reactive `outcomeOf`, ui `readValue`, router `callable`, testing and router `routeStateOf` | stay: each claims a type argument no value proves |
| compiler `devAppOf`, services `fetcherOf`, `signerOf` | stay: a signature known only from the table that was filled |
| runtime-dom `nodeOf`, schema `formEntriesOf` | stay: a platform object of another realm, read by shape |

The ledger's `unsafe` count is 33 on this lane; three calls leave, so 30. E1762's stricter reading then runs over every package's `src/` (S0019): a predicate it reports gains the missing checks, becomes a schema's `parse`, or moves into `unsafe` and is counted. The builder records each; the count may rise from 30 and the RFC does not promise it will not.

### What a log holds (finding D)
k.serverlog Thrown values. The scrub replaces values the request declared; a thrown text holds whatever its author put there. So a production record holds no thrown text at all: `loader p.def threw: Defect E2801 #9f3c21ab at modules/p/def.server.ts:12 <- Result postgres.database`. The class is from a closed list, a code is written only when `s.error` declared it or Keel owns it, and the fingerprint is an HMAC under `KEEL_SECRET`, so equal failures group and a short text (an SSN) cannot be guessed back from it. An operator who needs the text sets `KEEL_LOG_THROWN` to an instant at most 24 hours ahead; until then each throw also logs its text, scrubbed and cut as before. `keel dev` always does. `defect`'s message is then a developer's literal, which check holds (E1455), and values go in `data`, shown only where text is. RFC 0245's E1577 record follows the same paragraph.

### PGlite and class 08 (finding F)
std.postgres-errors. The refusal read the statement's text for `statement_timeout`; a concatenated name, an escaped identifier and `alter database` passed. The driver now reads the values after every statement (the session's, the per-database and per-role defaults, each function's `set` clause) and refuses any that is not `0`. Cost: one more query in the same process for each statement, measured at about 0.56 ms per statement on PGlite (1,000 `select 1` statements, five rounds), most of it the read of `pg_proc`; the package README records it. Making the parameter unsettable was weighed: PGlite runs as the one superuser, and Postgres has no way to lock a parameter against it.

### The minors (finding G)
| Finding | Home |
| --- | --- |
| `new Promise((_, r) => r(x))` | refused: E1451 at an executor's second parameter |
| `void rr()` | refused: E1453 |
| a dropped inner `attempt` | refused: E1453 inside a function given to `attempt`; a returned inner `Result` is flattened |
| a `Result` kept in an array or object nothing reads | not held here; RFC 0245's sinks (given to other code) and its Not held |
| a `defect` in `finally` | refused: E1452 |
| a throw of a function called in `finally` | not held, listed |
| `JSON.parse` and the other throwing built-ins | the list in k.attempt; E1457; `parseJson` |
| `Secret`'s statics | moved out of reach (D34) |
| class `08` | D37 |
| E1203's explained fix does not compile | the explanation's example is conformance (k.fixes); it reads `owner() ?? defect('no owner')` |
| a maker behind a helper after an `await` | the run-time layer: the E1203 defect; stated in k.reactive Static |

### The layers
k.errors Layers holds the statement. In brief: check refuses every throw but `defect`, every catch but `attempt(fn, expect)`, a discarded `Result`, a defect message that could carry a value, a bare throwing built-in, an `err` of a non-`KeelError`, a visible write to module state in server code, an unproven predicate, and offers a fix only where it is right. The run time, whatever check saw, reports every throw once by code, site and fingerprint and never by text, passes a defect through `attempt`, refuses a write to module state during a request and a value no maker made. Not held, and listed: an `expect` that claims too much, a defect raised for a failure a caller could handle, personal values in unmarked data, a throw inside `finally`'s callee, plain module state written through a helper, a forged identity through the realm record.

### What RFC 0245 takes
This RFC merges first, and RFC 0245 (k.failures, on `lane-server-up`) cites its E1452. Its text fits but for these, which its lane takes at its merge:
1. k.failures Fixes: its first two bullets (remove the `try` of an unread catch; rewrite a reading catch to `attempt` with `const e = attempted.error`) give way to k.fixes. Removing a `try` changes which failures the caller sees (the JSON chain), and the rewrite hands the catch a `KeelError` where it tested a thrown value (the SDK chain). Its third bullet is k.fixes' E1451 row.
2. Its quoted E1452 message becomes this RFC's; its two E1453 messages are already the same.
3. Its examples `attempt(save)` and `onClick: () => attempt(save)` take an `expect` or drop the `attempt`: a handler's rejected promise already reaches the Boundary.
4. Its Reading rule then also judges an `expect` (in place of "never uses its parameter" here) and the JSON chain's end.
5. Its E1577 record is written as k.serverlog Thrown values says.

### Personas, again
- The agent form of A2 (the strictest reader): every diagnostic on the failure path either carries a fix that is right or names the code to write, word for word, and `keel explain` shows one compiling example per shape. An agent that applies the first fix each time ends correct: that is the conformance of k.fixes, not a hope. Where the agent must decide (a value or a defect; which thrown values are expected), no fix decides for it.
- A2, human: three words for failures (`err`, `attempt`, `defect`) and one sentence each. The first failing call they wrap is the Stripe example.
- A3: `expect` is where a team says which failures of a dependency it handles, in one place per call; review lists the wide ones (R1017) and the defects on failed results (R1013).
- A6 (compliance): "can a thrown value put personal data in a production log" has the answer no, by the record's form, not by a scrub's reach; the window that prints text is bounded and itself a record.
- A8 (operator): one new environment value, `KEEL_LOG_THROWN`, refused at start when malformed; a fingerprint to group by; the site in every record.
- A7 (tester): a fix chain is a test anyone can add; a defect's values are asserted on `data`, not parsed from a message.
- F1: `attempt`'s one-argument form and `err`'s open parameter go before any release held them; identity moves behind the same guards' names.
- F2 and L1 to L4: a library holds identity the way the kernel does (the module's own set, proof 3), wraps an SDK with `attempt(fn, expect)`, and its module state is under E1256 with no declaration. L3's question (does the app see what a service library reaches) gains: its failures arrive as codes with typed data.
- L6 (plain npm package): its throws are unexpected until an `expect` names them; its text never reaches a production log.

## Breaking review: the edges
A reviewer tried to break the build of D21 to D40. The verdict: merge after fixes; the model holds at its root (two kinds of failure, one catch that names what it expects, a defect that passes through, identity apart from the value) and fails at its edges. Each finding was reproduced. D41 to D56 are the design for them; the personas each touches are named where it changes what they write.

### Supervising code (finding 1, blocking)
`attempt`'s `expect` is right for code that knows its callee. It is wrong for code that runs someone else's: std-jobs' runner, std-channels' `member`, std-live's `read`, std-offline's storage driver. Those wrote `(x) => (x instanceof Error ? Thrown.make({}) : undefined)`, the nearest thing to "everything" that check accepts, and it is not everything: a job that calls `defect()` or throws a string rejects out of the runner, and in production the unhandled rejection is E1577 and the process ends. A stream hung with no denial; a live view stayed `connecting` with no retry. Meanwhile app code could write the total claim in disguise.

The two needs are different and get different forms.

```ts
// packages/std-jobs/src/internal/runOnce.ts
const ran = await supervise(ctx, 'jobs.run', () => j.fn(parsed.value, ctx, a.signal), Thrown.make({}))
if (!ran.ok) return ran.error.code // 'jobs.thrown', or the job's own err code
```
`supervise` is an owner of throws, as a `Boundary` and the server's request already are. What makes it honest and not a second catch:
- `failed` is a value, made before `fn` runs. Nothing of the thrown value can reach it, so there is no reading, branching or wrapping: the caller learns "it threw".
- Every throw is reported as a throw: on a server one `diag` `supervised jobs.run threw: Defect E2801 #9f3c21ab at modules/p/send.server.ts:12`, by the same rules as a loader's; to observers one `keel.unexpected` with `data.at` the id. A defect is recorded once, as a defect.
- It never rejects for a throw of `fn`, so no supervised path ends the process or hangs.
- Kernel packages and a library's files may call it, and review lists each call (R1018). App code may not (E1461).

Why not in app code: the agent form of A2 takes the shortest path to a clean check, and a catch-all one import away is that path for every E1452. An app that does run code it does not own (plug-ins, a customer's script) writes that runner as a library package in its workspace, where the call is listed. F2's question (could a third party have built std-jobs?) is yes: `supervise` is public to every library. A3: R1018 is where a team sees a dependency take over its throws.

The disguised total `expect`, per form the reviewer wrote:

| Form | Refused by |
| --- | --- |
| `(x) => (void x, T)` | Decides 1: no `undefined` in the return type (E1452) |
| `(x) => (x === x ? T : undefined)` | Decides 2: a comparison whose both sides read the thrown value is no test (E1452) |
| an imported `(_x) => T` | Readable: read by symbol at its declaration, then Decides 1 (E1452); unreadable is E1452 too |
| `(x) => T.make({}, typeof x)` | Decides 1 (E1452), and the message is no literal (E1460) |
| std-offline's `storageFailed` | Decides 1 (E1452); it becomes `supervise(ctx, 'offline.storage', …)` |

Where static proof ends: a test that nearly every value passes (`x instanceof Object`, `typeof x !== 'bigint'`, `x !== 1`, an error in the branch where the test fails, a predicate that returns `true`). Check cannot decide narrowness, so R1017 lists each of those forms, and a predicate is trusted only when its body, in the project, tests a class or a property.

### Start refusals (finding 2, blocking)
`server.mjs` printed `E1577 uncaught exception in work of route -: Error #57bd6d8f` for Keel's own E1596, E1552 and a bad `KEEL_ORIGIN`: the rule that hides thrown text hid Keel's own message from the operator, the one thing A8 has to know that the build did not say. A coded refusal is Keel's text, not an app's: it is kernel-held (k.identity), its message holds names the app declared and never an environment value, and the entry prints it with its own code and `see` and exits 1. E1577 keeps one meaning: a value Keel did not raise. E1552's case, a deployable naming a module that does not exist, is now found where the operator is not: `keel check` and `keel build`, at the id in `topology.ts`.

### E1577 inside the window (finding 3)
k.leave and k.serverlog disagreed. Decided: the record that ends the process is the one an operator most needs to read, so with full text on (dev, or production before `KEEL_LOG_THROWN`'s instant) the scrubbed, cut text follows the form in that same record; otherwise it ends at the fingerprint or the site. It stays one record, since the process may not live to write a second.

### Identity under no name (finding 4)
`Reflect.get(globalThis, Symbol.for('keel.kernel')).get('router.action').add(forged)` passed check with no `unsafe`. The record was reachable by a key anyone can spell, because D32 wanted two copies of a kernel package to agree. That goal is dropped for a stronger one: a realm holds one copy.
- Each maker's package holds its record in a binding of its own module. No entry exports it or a function that adds to it; it is no property of anything.
- A second copy of `@keel/schema`, `@keel/store`, `@keel/router` or `@keel/server` from another file throws E1765 naming both URLs as it is evaluated, which at start is a coded refusal the operator reads; check and build find the same in the dependency tree. Silent disagreement cannot happen.
- The census that detects a second copy lives under `Symbol.for('keel.census')` and holds names and URLs only. Tampering with it can raise or hide E1765; a hidden copy's values fail the first copy's guards. It forges nothing.
- The kernel captures `WeakSet`, `WeakMap` and their methods at evaluation, and the entries import the kernel first, so patching a prototype later changes no guard.
- Check refuses the spellings it can see: `Symbol.for` of a `keel.` string, and listing the global object's symbol keys (E1766). Review lists a `Symbol.for` it cannot fold (R1019) and a non-literal global key (R1056).

What remains reachable only by code written on purpose: replacing a built-in before the kernel loads (a hand-written entry, `node --import`, a loader hook), the inspector, `node:vm`.

### What an error carries (finding 5)
`(x) => (x instanceof Error ? W.make({ why: x.message }) : undefined)` answered `{"why":"dup key SECRET-CODE"}`. The data schema said `string`, and a string is where text hides. k.expect Carries: a value read from the thrown value enters the error only as a `number`, a `boolean` or a union of literals, and never through `message`, `stack`, `cause`, `errors`, `String`, `toString`, `JSON.stringify`, a template or `+`. An SDK's open `code: string` is mapped to the error's closed set (`reasonOf`), which is what k.attempt's `charge` already does. `` T.make({}, `user ${email}`) ``: a message is a literal (E1460), as a defect's is. And a `KeelError` written by hand had no schema at all, so it is made by `make` only (E1458), with `keelError` for the kernel's codes.

The connection to k.privacy, stated without overclaiming: a mark lives on a schema node and types carry none. A value under a marked node of an error's `data` is treated by its mark at every sink. A marked value copied to an unmarked node is found by value where a sink reads text (the log's full-text record, a session's recorded error), and is not held in a response, which carries `data` as its schema encodes it.

### No `Result` in a `Result` (finding 6)
`ok(err(T))` compiled. A parameter type that refuses a `Result` (`T & ([Extract<T, AnyResult>] extends [never] ? unknown : never)`) was tried against `tsc`: it refuses the concrete cases and also `function wrap<V>(v: V) { return ok(v) }`, every generic caller in the kernel and in any library. So the refusal is check's, over the same types (E1459 at the `ok` argument and at a written `Result<Result<…>, E>`), and the run time's for what types cannot see: `ok` given a keel `Result` raises the defect E1459. `err` already refuses by type; `attempt` already flattens.

### Module state today (finding 7)
E1260 and `processSlot` are not built, and k.shared described both in the present tense. Now it says what is: reactive module state is refused at run time (E1256) and, for a signal's `set`, at check; a request's write to a module-level `let`, `Map`, array or object is refused by nothing and leaks. Where things go today: a config value and a connection pool are module-level `const`s made at evaluation; per-request state is made in the handler; a cache a request fills is durable storage or is not kept. The keel-server skill teaches it in one sentence. `explain-and-fixture-per-code` is decidable: a section's Rules, `proposed` or not, names only codes with an explanation row, so E1260 is out of k.shared's Rules until its RFC builds it.

### The wall-test patterns for a skill (finding 8, D55)
Not placed: every published skill is at its token target. For the operator's re-base of the keel skill (about 450 tokens), the block:
```ts
import type { Ctx } from '@keel/ctx'
import { attempt, err, ok, s, type Result } from '@keel/schema'

export const HttpFailed = s.error('feed.http', s.object({ status: s.int() }))
export const Unreachable = s.error('feed.unreachable', s.object({}))
export const CardDeclined = s.error('pay.declined', s.object({ reason: s.enum(['funds', 'other']) }))
type FeedError = s.infer<typeof HttpFailed> | s.infer<typeof Unreachable>
type Feed = { get(url: string): Promise<{ ok: boolean; status: number; text: string }> }

const once = (feed: Feed, url: string) =>
  attempt(async () => {
    const res = await feed.get(url)
    return res.ok ? ok(res.text) : err(HttpFailed.make({ status: res.status }))
  }, (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined))

export async function fetchRetry(ctx: Ctx, feed: Feed, url: string, tries: number): Promise<Result<string, FeedError>> {
  for (let i = 0; ; i++) {
    const r = await once(feed, url)
    if (r.ok || i === tries - 1 || (r.error.code === 'feed.http' && r.error.data.status < 500)) return r
    await ctx.clock.after(2 ** i * 100)
  }
}

export async function inTx(db: { query(sql: string): Promise<void> }, work: () => Promise<void>): Promise<void> {
  await db.query('begin')
  let done = false
  try {
    await work()
    await db.query('commit')
    done = true
  } finally {
    if (!done) await db.query('rollback')
  }
}

const reasonOf = (x: Error): 'funds' | 'other' => (Reflect.get(x, 'code') === 'insufficient_funds' ? 'funds' : 'other')
export const charge = (sdk: { charge(cents: number): Promise<string> }, cents: number) =>
  attempt(
    () => sdk.charge(cents),
    (x) => (x instanceof Error && x.name === 'CardError' ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  )
```
Placed in the keel skill, this block raised no type diagnostic from `tooling/docs-check.mjs`; only the size target failed.

### Spec diff (breaking review)
Written to `spec/` in this change; new sections `proposed`.
- New: k.supervise (10 clauses), k.expect (8), k.realm (8). Areas: state (k.expect, k.supervise), security (k.realm). `tooling/docs-owners.json`: the three owners.
- k.attempt: `err`'s `data`; no `Result` in a `Result` and E1459; `expect` points to k.expect and k.supervise; the defect search lets no throw out; E1457's JSON row and message; clauses #12 to #15.
- k.errors: Rules (a generator's `throw`; pointers for E1459 to E1461 and the other spellings); Layers, all three lists.
- k.unsafe: One path's code list; **Other spellings**; clause #14.
- k.identity: Identity (held in the maker's package, under no key; a coded refusal is one); clause #5 loses its second-copy half; clause #11.
- k.defects: Where it goes (supervised work); clause #4 (no second copy).
- k.serverlog: the `supervised` owner; the site line; E1577's text in its one record; what "in dev and production" means; clauses #16 to #18. k.leave: Process and E1577's rule. k.deploy: **Refusals at start**, E1560 for `KEEL_ORIGIN`; clauses #14, #15. k.topology: an unknown module at check and build; clause #18.
- k.shared: the lifetime table, **Not refused**, Rules without E1260; clause #8 rewritten, #9 new. k.resume: Stores and E1256's rule. k.explain: `see` whole, Rules name registered codes; clauses #5, #6.
- k.escapes: R1017 widened; R1018, R1019, R1020; clauses #13, #14. k.fixes: the no-fix row names the new codes. k.ctx: the `error` event's third source.
- std.jobs, std.live, std.channels, std.outbox: a throw of any value takes the failure path (k.supervise).
- Codes: E1459, E1460, E1461, E1765, E1766; R1018, R1019, R1020.

### Conformance diff (breaking review)
By the `conformance-writer`, from the spec text only. One bullet per new or changed clause, with the file and a fixture sketch. A case that needs a std package lives in that package's `conformance/`.
- k.supervise #1, `packages/ctx/conformance/supervise.test.ts`: a sim ctx, `supervise` over `() => 1`, `() => err(U)` and their `async` twins; an observer array stays empty.
- k.supervise #2, same file: a table of six thrown values (an `Error`, a string, `undefined`, an object, a defect, an `Error` whose `cause` is a defect), sync and `async`; each result deep-equals `err(T)`; no call throws or rejects.
- k.supervise #3, same file: `observe(ctx, push)` gets one `error` event per throw with the exact `KeelError`; a second observer that throws does not change the result.
- k.supervise #4, `packages/server/conformance/supervised-log.test.ts`: `createApp` in production mode with a runner that supervises a `defect` holding an email in `data`; read the log lines; match the regular expression; assert no `jane`, no E1577; repeat with `mode: 'dev'` for the second record.
- k.supervise #5, `packages/check/conformance/supervise-rules.test.ts`: `check()` on `modules/m/a.ts` (one E1461 at the callee, no fix), on a library fixture under `node_modules/@acme/jobs/` (none), and there with a `const` id (one at the id).
- k.supervise #6, `packages/cli/conformance/` k.escapes table test: an R1018 fixture and its clean twin.
- k.supervise #7, `packages/std-jobs/conformance/supervised-job.test.ts`: three jobs (`defect`, a thrown string, `Promise.reject(undefined)`), `attempts: 2`, a sim clock driven past both waits; read `failed`, the log, and a `process` `unhandledRejection` counter.
- k.supervise #8, `packages/std-channels/conformance/member-throws.test.ts`: a route whose `member` raises a defect, then one that throws a string; open a stream, collect events, advance 1,000 ms; publish and read the status.
- k.supervise #9, `packages/std-live/conformance/read-throws.test.ts`: a `read` that throws on its first call and returns `ok` on its second; `status()` after each; the clock advanced 1 s.
- k.supervise #10, `packages/std-offline/conformance/storage-rejects-any.test.ts`: a storage driver whose writes reject with a string, then with a defect; `send`; the entry's state; an `unhandledRejection` counter.
- k.expect #1, `packages/check/conformance/expect-decides.test.ts`: five `attempt` calls in `modules/m/a.ts`, one of them importing `taken` from `./taken.ts`; one E1452 each at the second argument.
- k.expect #2, same file: six clean forms, one importing `named` from `./named.ts`; no E1452.
- k.expect #3, same file: three unreadable arguments; the `not readable` message.
- k.expect #4, `packages/check/conformance/expect-carries.test.ts`: `W` with a `string` field; four copies of text and one `build(x)`; E1460 at the property value or at `build(x)`.
- k.expect #5, same file and `packages/schema/conformance/expect-carries-run.test.ts`: the `HttpError` form is clean, and run with a thrown `HttpError` gives data `{ status: 503, kind: 'a' }`.
- k.expect #6, `packages/check/conformance/error-message-literal.test.ts`: three non-literal messages, two literal ones.
- k.expect #7, `packages/check/conformance/keel-error-by-hand.test.ts`: `err({ … })` and an annotated `const`; E1458 at the literal; the `keelError` form clean.
- k.expect #8, `packages/schema/conformance/keel-error-makers.test.ts` and `packages/server/conformance/keel-error-status.test.ts`: each maker's value; a guard and an action on a node server answering 403 and 422.
- k.attempt #12, `packages/check/conformance/result-in-result.test.ts`: five E1459 forms, three clean, types on.
- k.attempt #13, `packages/schema/conformance/result-in-result-run.test.ts`: untyped calls (the file imports `ok` through an `unknown`-typed binding); `isDefect(v, 'E1459')`; the `async` nest rejects.
- k.attempt #14, `packages/schema/conformance/attempt-cause-getter.test.ts`: an `Error` with `Object.defineProperty(v, 'cause', { get() { throw g } })` and a `Proxy` whose `get` throws; a spy `expect`.
- k.attempt #15, `packages/schema/conformance/err-keel-error.test.ts`: three refused `data` forms, `null` accepted.
- k.unsafe #14, `packages/check/conformance/other-spellings.test.ts`: one file with the six reported lines and the three clean ones, types on.
- k.realm #1, `packages/schema/conformance/second-copy.test.ts` (and its twins in store and router): copy the package folder to a temp folder, `import()` it by file URL, assert the message's start and both URLs.
- k.realm #2, `packages/server/conformance/second-copy-start.test.ts`: a built fixture whose bundle imports a copied `@keel/schema`; spawn `server.mjs`; read stdout and the exit code.
- k.realm #3, `packages/check/conformance/two-copies.test.ts` and `packages/cli/conformance/build-two-copies.test.ts`: a fixture `node_modules` with `@keel/schema` at the top and nested under a dependency.
- k.realm #4, `packages/schema/conformance/same-file-again.test.ts`: `vi.resetModules()`, import again, compare guards.
- k.realm #5, `packages/router/conformance/builtins-patched.test.ts`: a module imported after the kernel sets the three prototype members (restored in `afterEach`); the four guards and `manifest`.
- k.realm #6, `packages/schema/conformance/census.test.ts`: delete the census entry, load the copy, compare guards.
- k.realm #7, `packages/check/conformance/keel-symbols.test.ts`: five E1766 lines, three clean.
- k.realm #8, `packages/cli/conformance/` k.escapes table test: R1019's fixture and twin.
- k.identity #5 (changed), `packages/schema/conformance/is-schema.test.ts`, `packages/store/conformance/guards.test.ts`: the second-copy assertion goes; the rest stands.
- k.identity #11, `packages/router/conformance/identity-unreachable.test.ts`: walk `Object.getOwnPropertySymbols(globalThis)` and every export of each entry listed in the three packages' `exports`; assert no `WeakSet`, `WeakMap` or `Map` of one.
- k.defects #4 (changed), `packages/schema/conformance/defect-key.test.ts`: the clone and worker halves stand; the second-copy half moves to k.realm #1.
- k.serverlog #16, `packages/server/conformance/thrown-log.test.ts`: the `/late` fixture started with `KEEL_LOG_THROWN` one hour ahead on a sim clock; the one E1577 line before and after the instant; a `.pii()` input value marked.
- k.serverlog #17, `packages/cli/conformance/build-site-line.test.ts`: a `keel build` fixture with the `defect` call on line 12; the message's end.
- k.serverlog #18, `packages/server/conformance/privacy-diag-scrub.test.ts` lines 69 and 120: the loop runs `"dev"` and production with the window open, as it did before the migration.
- k.deploy #14, `packages/cli/conformance/start-refusals.test.ts`: spawn `server.mjs` three times with one bad value each; one `diag`, its code, no value, no `E1577`, no `#`, exit 1.
- k.deploy #15, same file: a fixture whose dependency throws at module scope; the E1577 line; no `hunter2`.
- k.topology #18, `packages/check/conformance/topology-unknown-module.test.ts` and `packages/cli/conformance/build-unknown-module.test.ts`: `ghost` with and without its folder; a library whose root manifest id is `ghost`.
- k.shared #8 (changed), `packages/check/conformance/module-state-rules.test.ts` and `packages/server/conformance/module-state.test.ts`: the five writes give no diagnostic (the skipped E1260 cases go); two requests in turn show the leak.
- k.shared #9, `packages/server/conformance/leave-module-stores.test.ts`, `resume-module-store-e1256.test.ts`: the dev page holds the message and the store id; `data` is `{ node, kind: 'store' }`; production holds neither.
- k.explain #5 and #6, `packages/check/conformance/explain-see.test.ts`: `explain('E1762')`'s last line; every kernel code's `see` line; every section's Rules codes against `explain`.
- k.escapes #13 and #14, `packages/cli/conformance/` k.escapes table test: five R1017 forms and one clean; R1018, R1019 and R1020 fixtures with twins.

### The builder, in order (breaking review)
Conformance first, then:
1. `@keel/schema`: each record a module binding (`internal/kernelSet.ts` and `Symbol.for('keel.kernel')` go; `./internal` exports no set and no adder); the census and E1765; built-ins captured at evaluation; `ok` raises E1459 for a keel `Result`; `err` refuses `data` `undefined` or a function; `wrapsDefect` survives a throwing getter; `keelError`.
2. `@keel/store`, `@keel/router`, `@keel/reactive`, `@keel/server`: own records and census entries (reactive raises E1203 and E1208 through `defect`; `internal/kernelDefects.ts` goes); the two `codedError.ts` record what they make and export a guard to the kernel only.
3. `@keel/ctx`: `supervise`, and the kernel-only listener the server registers on each ctx it serves with; `@keel/server` writes the `supervised <id> threw:` record.
4. `@keel/server` start: a coded refusal printed with its own code, message and `see`, exit 1, no E1577 (E1596, E1552, E1555, E1560, E1765; `KEEL_ORIGIN` checked as an origin); E1577's text inside the window in its one record; the site read through `server.mjs.map`.
5. `@keel/check`: `expect` Readable and Decides in place of the parameter-use test; E1458's object literal; E1459; E1460; E1461; E1766; E1765 over the dependency tree; Other spellings; E1552 for an unknown module in `topologyReadProblems` (check) and `hostingDiags` (build); the E1260 rule and dead `isSlot` out of `internal/moduleState.ts`; the E1451 site finder made one (`internal/keelThrows.ts` and `internal/spelledKeelThrows.ts`, about 7 KB); `EXPLANATIONS.ts` (the new codes, E1457's message, `see` never cut) and `PIPELINE_CODES.ts`.
6. `@keel/cli`: R1017 widened, R1018, R1019, R1020 in `review/ESCAPES.ts`.
7. The stdlib's supervisors: std-jobs `runOnce.ts`; std-channels `allowed.ts`, `channelRoute.server.ts` (three calls), `remoteSaves.ts`, `watchStores.ts`, `followAll.ts`, `reread.ts`, each either `supervise` or an `expect` that names what its call throws; std-live `live.ts`'s `read`; std-offline `storageFailed.ts` gone, `load.ts` and `persist.ts` on `supervise`. No `x instanceof Error ? E : undefined` is left in `packages/std-*/src`.
8. Apps, examples, the scaffold's templates and the guide: each hand-written `KeelError` (about 45, most of them `keel.denied`, `keel.notFound` and `keel.fields`) becomes `keelError.<name>.make(…)` or an `s.error`'s `make`; then the keel-server and keel-client skills' two `err({ code, … })` examples, which `docs-check` type-checks against the build.
9. `fix-universal` seed 1337 path 86: E1509's fix yields a new E1503, a main-line bug this lane's property surfaced; fix it in `@keel/check` on this lane.
10. Size budgets re-based by the orchestrator; the ledger's new rows listed, not regenerated here.

### Not held (the whole list after the breaking review)
- An `expect` whose test nearly every value passes; a predicate in another package that is true of everything (R1017 lists the forms it can read).
- A number an `expect` copies that encodes text; a helper a copy calls that reads `message` and returns a number.
- A library that wraps its own code in `supervise` (R1018 lists each call).
- A defect raised for a failure a caller could have handled (R1013).
- A schema-marked value that app code copies into an unmarked field of an error's `data` reaches a response, which carries `data` as its schema encodes it: types carry no mark, so check cannot see the copy. A personal value in `data` whose schema has no mark.
- A request's write to plain module state: nothing refuses it (k.shared Not refused).
- A throw of a function called in a `finally`; a throwing call check has no row for; a `Result` kept in a binding nothing reads.
- Code that replaces a built-in before the kernel loads, the inspector protocol, `node:vm` (k.realm). The realm record of D32 is gone, and with it "a forged identity through the realm record".
- A `message` or an `expect` in code check does not read (a plain npm package).

### Token impact (breaking review)
Characters over four, as `tooling/budgets.mjs` counts, against 3,100: k.attempt 3,098; k.errors 3,089; k.leave 3,099; k.unsafe 3,010; k.serverlog 2,957; k.identity 2,683; k.topology 2,509; k.escapes 2,347; k.expect 2,325; k.deploy 2,329; k.fixes 2,146; k.ctx 2,123; k.supervise 1,871; k.defects 1,608; k.resume 1,562; k.shared 1,552; k.realm 1,369; k.explain 862; std.channels 3,023; std.jobs 1,472; std.outbox 1,363; std.live 1,301. No limit is raised. `keel docs --for E1451` stays within 400 by naming the code in no new line. Skills: keel 1,330 of 1,330, keel-server 2,896 of 2,900.


## Re-review: closing the edges
A re-review of D41 to D56 passed the wall test again and found nothing wrong at the root. Each finding below was reproduced; D57 to D71 are the fixes, built on this lane. Where they differ from an earlier decision or section of this RFC they replace it.

### Decisions (re-review)
- D57 (item 1): k.expect Carries judges what is made, not how a value got there. Each value an `expect` returns other than `undefined` is a `KeelError` whose `data` is closed: a number, a boolean, a literal, `null` or `undefined`, or a union, intersection, array, tuple or object made only of those. Open `string`, `bigint`, a template literal type, `symbol`, `object`, `unknown`, `any`, a type parameter and a type check cannot resolve are E1460. In a `make` or `causedBy` written in the `expect`, each property value or element is judged by its own type, so a literal written there is closed. A returned value that is no such call is judged by its type's `data`, except a `const` declared outside the `expect`. The wall test's `conflict` chain needs that exception. The type pass judges it. With the type pass off (`check(files, { types: false })`, which only the kernel's structure lint calls) no data is judged. An open-text need has no form: carry a code, and leave the text to the log inside the `KEEL_LOG_THROWN` window.
- D58: std.db's `db.failed` carries `{ driver, op, class, errcode }`, every field closed. `class` is a Postgres code's SQLSTATE class, `sqlite`, `system` or `unknown`; `errcode` is SQLite's number, else `0`. std.postgres' `postgres.database` `sqlstate` is one of the codes Postgres 17 lists for the classes it takes, plus `08007`. An unlisted code of those classes is carried as its class's `<class>000`.
- D59 (director's decision): `postgres.constraint`'s data is `{ kind }`. The constraint's name reaches app code only through `constraintOf(e, names)` (`@keel/std-postgres/server`), as the member of the app's own `const` list `names`, or as `undefined`. std.postgres keeps the name beside the error in a module `WeakMap`, never in `data`, a response or a log line. A copy of the error, or one from another process, names none. The catalog is not read. This is the nearest form to the director's `DatabaseError.constraint(x, names)` sketch. App code meets the constraint as a returned `Result`, not as a thrown value, so the helper takes the error.
- D60 (item 2): Decides' tests also read `Object(x)`, and `.ok` of a `const` bound to `S.parse(x)`. The shapes that select a returned value are a closed list: a branch of `?:` or `if`; `e` in `t && e`; what follows `if (t) return undefined` with no `else` in the same list; a `case` before any `default` of `switch` on the thrown value whose case value does not mention it. E1452 now has two messages: `expect claims every throw: it never returns undefined` (Decides 1) and `expect claims every throw: return the error where instanceof, ===, a guard or .ok holds` (Decides 2). `keel explain E1452` carries the list in 479 of its 480 characters.
- D61 (item 3): a throw while a module of `server.mjs` is evaluated, before `createApp` reads the environment, is its own start: its E1577 record holds the scrubbed text when `KEEL_LOG_THROWN` names an instant after the throw's ctx clock reading and at most 24 hours after it. Any other value, empty among them, prints no text and raises nothing there; E1596 stays `createApp`'s, and an empty value is E1596 at start (k.serverlog Thrown values).
- D62 (item 4): E1766 judges what is done, not how it is spelled. A listing of the global object's own symbol keys (`Object.getOwnPropertySymbols`, `Object.getOwnPropertyDescriptors`, `Reflect.ownKeys`) and a copy that carries them (`{ ...g }`, a JSX spread, `Object.assign` given it after its first argument) are E1766. The global object is one of its four names, an expression the type pass types as `typeof globalThis`, or `Object(e)` or `new Object(e)` of one; without the type pass, a global path resolving to a name, or `Reflect.get` of one by a literal name. String-key listings (`Object.keys`, `getOwnPropertyNames`, `values`, `entries`) are none: every slot is a symbol. A listing of a value review cannot tell from the global object is R1019 (k.realm, k.escapes).
- D63 (D248's second sentence): the `x-keel-user` signer and the test users table stay on the global, as k.realm's two trusted slots. With D62 app and library code cannot name or list them. Code check does not read runs in a server process or a test, where it can read `KEEL_SECRET` and sign any header itself, so the slots give it nothing more. A browser's `modules` holds no signer. For the operator to confirm or reverse.
- D64 (minors, supervise): a returned value whose inspection throws (a `Proxy` whose traps throw) is a throw of `fn`: reported once, `err(failed)`. A `failed` that is no `KeelError` is the defect E1458, thrown before `fn` runs, as `err` throws it. `supervise` sets no time: each supervisor bounds its own work on `ctx.clock`, and k.supervise's table gives each bound (k.supervise API, The stdlib's supervisors).
- D65 (minor, std.channels): a save's read of a stored snapshot, which the process's streams share, not settled within 5,000 ms on `ctx.clock` is a failed read. `member` after the save is then a denial, and a remote save's watch is a drop, so no stream's checks stall on a slow storage. One timer per read is cancelled when the read settles. There is no timer per delivery (std.channels).
- D66 (minor, a workspace library): a folder of the project's tree, outside `node_modules/` and no project itself, whose `package.json` marks it `"keel": "library"` under a scoped name is a library in place. `keel check` reads its `src/` and `unsafe/` files once: under `node_modules/<name>/` when the project holds it there, else where they lie, as a library's files. So a wrapper library that supervises gets no E1461 (k.library Kind, k.supervise Who writes it).
- D67 (R1018 one hop): `keel review` lists each app call of a library function whose body holds a `supervise` call: a name imported from a library of the reviewed tree, or a namespace member of one, followed through its `exports` entry, `export … from`, `export *` and a local `export { … }`, in up to eight files. Message `<name> supervises its work (<file>)` (k.supervise, k.escapes).
- D68 (minor, E1765): the message keeps the dependency that holds a second copy. Past 89 units each folder takes its next shorter form, the first before the second: from its holder on, then holder and last segment. Then the holders are cut, each getting half the room unless one fits in less (k.realm One copy).
- D69 (minor, one defect form): `defect(message, { code, data, cause })`. The code is the detail's `code`, a literal `E` and four digits. A second argument that is no object literal without a spread, or a third, is E1455 `defect detail is not an object literal`. E1455's fix on a failed `Result` adds `cause: r.error` to the detail. Every call site is moved (k.defects, k.fixes, k.unsafe One path).
- D70 (minor, D248's third sentence): in `races`, a transaction function that throws an `Error` other than a `TypeError` or `RangeError` (a dependency's failure) makes its entry `unchecked` `threw`, and the analysis goes on. A defect, and a thrown value that is no `Error`, pass out of `races`. No ctx parameter. W2702 carries `threw` (std.conflicts).
- D71 (the closer's smaller findings): a port that will not bind is E1560 naming `PORT`, never its number (with `PORT` unset, Keel's 8080) (k.deploy Refusals at start). A coded error whose message already starts with its code is written once at check and build. E1601's fix is offered only where a binding named `ctx` is in scope; elsewhere the message names the `ctx` equivalent and there is no fix (k.ctx Rules).

### Personas (re-review)
- A2 and A3 (product engineer, team lead): D57 and D59 change what an `expect` may carry. Text never crosses, and a constraint is named from the app's own list. D69 leaves one way to write a defect.
- A6 (compliance owner): D57, D58, D61 and D62 close the four ways thrown text or the signer reached app code or a record. Each is a check finding or a log rule, not a promise.
- F2 (stdlib maintainer): D64, D65 and D70 hold the stdlib's supervisors to bounds a third party could write with what is public. D66 and D67 give a workspace wrapper the same reading as a published library.

### Not held (re-review)
- An app that writes `"keel": "library"` on a folder of its own to call `supervise`. D66 reads it as a library, and D67's R1018 is where a person sees it.
- A listing of a value that holds the global object, reached through a call or a file check does not follow. R1019 lists the listing.
- Everything the breaking review's list names, unchanged.

### Conformance owed (re-review)
The conformance-writer re-bases the cases whose spec text changed (D57's closed data, D58, D69's one form) and writes cases for the new bullets of k.ctx (E1601 fix), k.realm (E1765 forms, E1766 listings and R1019), k.serverlog (a throw at module evaluation), k.supervise (a workspace library, R1018 one hop, E1458 on `failed`), k.defects (the one form) and std.conflicts (`threw`).


## Alternatives
- **Leave it as `unsafe`.** Twenty-odd files with one reason, "a bug, never an expected failure a Result would carry", counted as escapes. The count then measures how many packages exist, not how much code steps outside the rules; reviewers learn to skip R1001 for these; a third-party library author meets the same wall and writes the same wrapper. D191 and D192 rule it out.
- **`invariant(cond, message): asserts cond`.** Reads well for a guard but not for `?? fail` or `return fail` in an expression, and a second form beside `defect` would be two ways. `if (!c) return defect(...)` and `x ?? defect(...)` cover both.
- **A typed `Defect` returned as a value.** That is a `Result` by another name; callers would carry a failure they cannot handle.
- **A required code.** Principle 5 wants one, but about half the stdlib's throws have none in their sections (std-conflicts' factory checks, std-jobs' unknown job, std-postgres' array parse, std-money, std-text). Requiring it here means codes and Rules lines in ten std sections; D8 leaves the sweep for its own RFC.
- **`defect` rethrowing a caught value** (`defect(e)`). A platform error is not a bug of the code that caught it, and `isDefect` would then lie. `expect` returning `undefined` hands it on unchanged.
- **A second catch (`caught(fn): { threw, error }`).** Two sanctioned catches, and the raw value would be a `Result` error, unserializable. `expect` keeps the one catch and the error a `KeelError`.
- **Keep E1451 and E1452 lifted in `unsafe(` ranges.** Nothing left needs them, and keeping them leaves a second way to throw beside `defect`.
- **A `moduleScope()` export, or `detached` sanctioned for libraries.** A module root is what `scope` already makes where no owner runs; a name for it would be a second way, and `detached` under an owner is exactly what E1207 refuses (it escapes the caller's request registry from inside the request).
- **Close `.then(onOk, onRejected)` as a catch in E1452 here.** It is one (std-offline `flush.ts` uses it), but it is a separate gap in an existing rule; the orchestrator files it.

Rejected in the third review:
- **Keep `attempt(fn)` catching every throw as `keel.unexpected`.** It swallows a defect raised inside it, nests a returned `Result`, and gives a caller `{ ok: false, error: {} }` with the cause gone: the review's first and fourth cases.
- **A one-argument `attempt` that lets every throw pass.** It compiles and catches nothing, so a ported `catch` becomes a failed branch that never runs, and check is clean.
- **Trust a thrown object shaped like a `KeelError`.** SDKs throw objects with a `code`; a shape is a claim anyone makes.
- **Total versions of every throwing built-in.** Six exports for calls most apps make rarely; `parseJson` earns its place because parsed JSON needs a schema, and `attempt(fn, expect)` covers the rest.
- **Leave throwing built-ins to the run time.** A person's bad text then answers 500, and nothing teaches the author before it ships.
- **A kernel cleanup helper (`ensure(cleanup, work)`), or `using`.** `try`/`finally` is in the language, already accepted by E1452 and already what the review found right; a helper beside it is a second way (principle 1). Its one gain, running the undo for a failed `Result` too, is `if (!r.ok) { undo(); return r }`. `using` runs on success as well, so rollback still needs the flag, and it needs a disposable per resource.
- **A fix that removes the `try` of an unread `catch`, or rewrites a reading `catch` to `attempt`.** The first changes what the caller sees; the second changes what the handler tests. Each ends clean and wrong on a wall-test case.
- **A list of makers E1256 covers.** Each maker a library adds is then a hole until listed. The owner rule covers a maker not yet written.
- **A copy of module state per request** (an async-context store behind each module signal). The same module would behave one way on a page and another on a server, and the write that was a bug would pass in silence.
- **Marks as symbol keys, enumerable or not.** A key is copied by a spread or written by hand; the review forged an action with one.
- **A `WeakSet` private to each copy of a package.** A second copy of `@keel/schema` in a process would not know the first's defects or schemas (D14's reason). The realm's record keeps one set per realm; reaching it on purpose is listed as not held.
- **A `wrap(action, around)` export.** A second maker; wrapping the function before `action` needs none.
- **E1762 by structural reading alone.** Sound for plain data, never for a signature; a schema's `parse` is the same proof with no hand-written checks, so both are accepted and signatures take identity or a class.
- **Scrub thrown text harder.** The scrub replaces values it was told; a thrown text holds values nobody declared. No amount of matching bounds that.
- **A plain hash as the fingerprint.** A short text (an SSN, a token) is found by hashing guesses. A keyed one is not.
- **Log a defect's literal message in production.** Check holds the literal only in code it reads; a kernel package or a plain npm package calls `defect` unchecked, and the run time cannot tell.
- **Match more spellings of `statement_timeout`.** Any reading of text loses to a function body or a concatenation; the value does not.

## Spec diff
Applied in this commit.
- k.errors (`implemented`): Split names `defect`; the API sample gains `attempt(..., expect)` and `defect`; `attempt` and `try`/`finally` bullets; a **Defects** paragraph; Rules E1451's message, E1455, "an `unsafe(` range lifts neither E1451 nor E1452"; six clauses after the last.
- k.reactive (stays `implemented`): API (only a kernel package detaches); Rules E1207 (every file but a kernel package's, ranges included); a **Module roots** paragraph; clause #13 (std path fires, kernel path does not) and #21 (the library range is one E1207) rewritten; two clauses after the last.
- k.check (`implemented`): App code's lifted set drops E1451, E1452 and the library E1207 exception; the clause listing the lifted codes moves `throw e` and `try`/`catch` to "one diagnostic in both places".
- k.escapes (`implemented`): R1013's row; one clause.
- k.parity (stays `proposed`): By kind: no detached scope in a stdlib package or library; module roots and defects.
- k.unsafe (stays): a library's `unsafe(` holds a cast or a platform read, never a throw or catch.
- Map: k.errors, k.check, k.escapes read `implemented`. No new section, no new row.
- `docs/GLOSSARY.md`: **defect**, **module root**.

After the third review, written to `spec/` in this change (every new section `proposed`):
- New: k.attempt (11 clauses), k.defects (8), k.fixes (12), k.identity (8), k.shared (8), std.postgres-errors (6).
- k.errors: Split and API name `attempt(fn, expect)`, `parseJson` and the flag form; the Defects paragraph and the `attempt`, `defect` and E1455 clauses move to k.attempt and k.defects; Rules as a list with the rewritten messages, E1451's `new Promise` executor, E1452's `defect` in `finally`, E1453 under `void`; a **Layers** paragraph. Clause #3 rewritten; #8 names every code of Rules; #15 to #23 are replaced by #15 to #19.
- k.unsafe: Type predicates and the E1762 rule point to k.identity; One path adds E1457 and E1458 and the detail argument; clause #10 rewritten in place.
- k.reactive: Static's message; Module roots points to k.shared. k.store Guards and k.schema Guard: kernel-held identity; k.schema gains `parseJson` and rule `json`.
- k.escapes: R1015's row and clause; R1017 and its clause.
- k.serverlog (`implemented` until covered): **Thrown values**, E1596, six clauses; its earlier clauses that quote thrown text hold of the full-text record.
- std.postgres: Errors, Modes and E2461 point to std.postgres-errors; its two clauses that quoted the defect's message read `data.sqlstate`.
- Areas: state, tools, security, data. `tooling/docs-owners.json`: the six sections' owners. Glossary: **kernel-held identity**, **fix chain**; **defect** updated.

## Conformance diff
By the `conformance-writer`, from the spec text only, under `rfc:0242`.
- `packages/schema/conformance/defect.test.ts`: k.errors#15 (shape, message, code, `isDefect`) and #16 (`attempt` without `expect`; an `async` defect rejects).
- `packages/schema/conformance/attempt-expect.test.ts`: k.errors#17 (`expect`'s `err`, sync and async, `ok`) and #18 (unexpected value thrown as itself, a defect skips `expect`, `expect`'s own throw).
- `packages/check/conformance/errors-defect-rules.test.ts`: k.errors#19 (`try`/`finally`, E1451's message, `defect` no E1451) and #20 (E1455's three forms and three clean ones, no fix). `fixtures-by-code.ts`: an E1455 fixture.
- `packages/check/conformance/`: the existing case for k.check's lifted-codes clause asserts `throw e` and `try`/`catch` as one E1451 and one E1452 inside the range and at the top level (its header quotes the new text).
- `packages/reactive/conformance/module-roots.test.ts`: k.reactive#22 and #23.
- `packages/check/conformance/`: the cases quoting k.reactive#13 (`packages/std-x/src/a.ts` now fires) and #21 (`node_modules/@acme/charts/unsafe/detached.ts` now one E1207) follow the new text.
- `packages/cli/conformance/`: R1013's fixture and clean twin in the k.escapes table test, and k.escapes#10's five forms.

After review, from the new text:
- `packages/schema/conformance/defect-key.test.ts`: k.errors#22 and #23 (wrappers skip `expect`; a second copy, a clone and a worker message). `packages/check/conformance/finally-exit.test.ts`: k.errors#21 (E1452). `packages/check/conformance/callees-by-symbol.test.ts`: k.unsafe#12. The existing defect cases that assert `objectContaining({ name: 'Defect' })` use `isDefect`.
- `packages/reactive/conformance/module-roots.test.ts`: k.reactive#22 (inside `moduleRoot`), #24 and #25 (E1208 and E1203 as defects; the message names `detached: true`); `packages/compiler/conformance/module-root-output.test.ts`: k.reactive#23 (the compiler wraps each top-level call); `packages/check/conformance/reactive-after-await.test.ts`: k.reactive#26.
- structure-lint's two findings carry codes: S0020 (control leaving `finally`) and S0019 (E1762's predicate); `structure-lint-finally-exit.test.ts` matches the code, not the text. k.unsafe#13: E1455 through `call`, `apply`, `Reflect.apply` and `bind`. std.postgres' 22001 case is an `insert` into a `varchar(2)` column; std.postgres-changes' `follow` case needs no server.
- `packages/check/conformance/unsafe-type-predicates.test.ts`: k.unsafe#10 and #11 (E1762, its lift). `packages/cli/conformance/`: k.escapes' R1013 clause as rewritten (eight reported forms, three clean) and R1015's.
- `packages/store/conformance/guards.test.ts`: k.store's last clause; `packages/schema/conformance/is-schema.test.ts`: k.schema's last clause.
- `packages/std-postgres/conformance/`: std.postgres' two last clauses (`postgres.database` per SQLSTATE on Postgres 17 and PGlite; E2461 for `42P01`) and std.postgres-changes' last (a `follow` that cannot listen gets one `lost`).

After the third review, by the `conformance-writer` from the new text only:
- `packages/schema/conformance/attempt-expect.test.ts`: rewritten for k.attempt #1 to #4 and k.errors #3; `attempt.test-d.ts` and its run-time half for #5; new `err-keel-error.test.ts` (#7), `cause.test.ts` (#8), `parse-json.test.ts` (#10), `wrap-sdk.test.ts` (#11).
- `packages/schema/conformance/defect.test.ts` and `defect-key.test.ts`: k.defects #1 to #4 (identity in place of the own key; `data`; `cause`). `secret-statics.test.ts`: k.identity #4. `is-schema.test.ts` and `packages/store/conformance/guards.test.ts`: k.identity #3.
- `packages/check/conformance/errors-defect-rules.test.ts`: k.errors #15 and k.defects #5 to #8. `finally-exit.test.ts`: k.errors #16. New `throw-forms.test.ts` (#17), `result-discard.test.ts` (#18), `catch-messages.test.ts` (#19), `attempt-rules.test.ts` (k.attempt #6, #7, #9), `module-state-rules.test.ts` (k.shared #7, #8). `unsafe-type-predicates.test.ts`: k.unsafe #10 and k.identity #5 to #7. `reactive-after-await.test.ts`: the message.
- `packages/check/conformance/fix-diffs.test.ts` and `fixtures-by-code.ts`: k.fixes #1 to #4. E1451's fixture becomes a `throw` of a `KeelError` in a `Result` function, E1452's the cleanup-and-rethrow shape; the no-fix shapes join `NO_FIX` with E1457, E1458 and E1260; every fix-carrying fixture is compiled after its fix.
- `packages/check/conformance/fix-chains/<chain>/` for `retry`, `rollback`, `sdk`, `json`, `cleanup`, `invalid`, `missing`, `timeout`, `conflict`, `bug`, each with `start/`, `steps.json`, the named edits, `end/` and `probe.test.ts`; `fix-chains.test.ts` walks them (k.fixes #5 to #10 and #12). `explain-examples.test.ts`: #11.
- `packages/router/conformance/identity.test.ts`: k.identity #1. `packages/server/conformance/identity-record.test.ts`: #2. `packages/server/conformance/module-state.test.ts`: k.shared #1 to #5; `packages/runtime-dom/conformance/module-state-page.test.ts`: #6.
- `packages/server/conformance/thrown-log.test.ts`: k.serverlog's six new clauses; the existing k.serverlog cases run with `mode: 'dev'` and read the second record.
- `packages/cli/conformance/`: k.escapes' R1015 clause as rewritten, R1017's, and k.identity #8.
- `packages/std-postgres/conformance/`: `errors-by-sqlstate.test.ts` (std.postgres-errors #1, #2), `pglite-timeout.test.ts` (#3 to #6), and std.postgres' two edited clauses.
- Every case citing k.errors #15 to #23 by number moves its `// Spec:` header to the clause's new section and position.

Settled before the breaking review (D235), by the `conformance-writer` from the new text:
- `packages/check/conformance/`: every case quoting E1451's, E1452's (`try`/`catch`, and the `.then(f, g)` form), the Static E1203 and E1208, E1762's, E1256's static and E1260's message takes the shortened text; each fits 89 units with its longest fixture input (k.check Diagnostics), and what each dropped is in its explanation.
- `packages/router/conformance/identity-copy-create-router.test.ts`, `packages/server/conformance/identity-copy-create-app.test.ts`: k.identity's rewritten third clause, a copy of the route table (a spread, `Object.assign`, a JSON round trip, `structuredClone`, a hand-written `{ kind, contract, contracts }`) given as `routes`, refused with E1515 naming `routes`.
- `packages/server/conformance/thrown-log.test.ts`: k.serverlog's frames bullet (no thrown value and no mark standing for one without full text) and the dev-only page bullet; k.defects Where it goes.
- E1260 leaves `fixtures-by-code.ts`, `explain-examples.test.ts`'s `PER_CODE`, `fix-diffs.test.ts`'s `NO_FIX` and `fix-universal.test.ts`'s no-fix list, and `module-state-rules.test.ts`'s E1260 cases are `test.skip` until RFC 0251's `processSlot` lands, as a code whose rule is not built is held elsewhere.

## Migration
Nothing is released; no migration notes. The sites, by package (the builder):
- `@keel/schema`: `src/defect.ts`, `src/isDefect.ts`, `src/Defect.ts` (type), `src/DefectCode.ts` (type); `attempt.ts` gains the `expect` overload (a defect rethrown before `expect`); `index.ts` exports them. `toUnexpected` unchanged.
- `@keel/check`: `noThrow.ts` message; `noTryCatch.ts` and `noThrow.ts` read lifted ranges (E1451, E1452 leave the lifted list in `isLifted` or its equivalent); `noDetachedScope.ts` exempts the kernel folder list only, and loses the library-range exception; new `defectCode.ts` (E1455); `PIPELINE_CODES.ts`, `EXPLANATIONS.ts` (E1451, E1455, E1207 texts).
- `@keel/cli`: `keel review` R1013 in `review/ESCAPES.ts`; `tooling/structure-lint.mjs` S0014 no longer counts E1451, E1452 or E1207 as escapes in a library range.
- std-channels: `fault.ts` to `defect(text, code)`. std-conflicts: `raise.ts` to `defect`; `isolated.ts` to a nested `scope` with `isolate`, then `dispose()`, in `src/internal/`. std-db: `raise.ts` to `defect` (`dbError`'s codes as `code`, `opFailed`'s text as the message); `settle.ts`, `settleNow.ts`, `Settled.ts` to `attempt(fn, expect)`; `tx` and each cleanup-then-rethrow to `try`/`finally`. std-headless: `keyFault.ts`. std-jobs, std-schedules, std-statecharts, std-workflows: `refuse.ts`. std-live: `outsideScope.ts` to `defect('live() called outside any scope; wrap it in scope(fn)', 'E1203')`. std-offline: `raise.ts`; `detached.ts` to a root made at declaration when `owner()` is undefined, its store made by `root.run(make)` on first use; `afterRejection.ts` to `try`/`finally` with a flag; `recovering.ts` to `attempt(run, () => (lost ? storageLost : undefined))`, then the recovery. std-postgres: `raise.ts`, `unexpected.server.ts` (a defect naming the SQLSTATE), `settle.ts`, `Settled.ts` as std-db. std-statecharts: `detached.ts` to `scope(() => undefined).run(() => compile(id))` under its `owner() === undefined` guard.
- lane-std-formats (when merged): std-i18n `refuse.ts`, std-messages `badSet.ts`, `refused.ts`, std-money `noDecimalForm.ts`, std-tables `tableFault.ts`, std-temporal `notDuration.ts`, std-text `boundFault.ts` to `defect` (a `RangeError` they throw today becomes a defect; no conformance asserts its class).
- lane-std-sessions (when merged): `caught.ts`, `Thrown.ts` to `attempt(run, expect)`; `raise.ts` to `defect` and `try`/`finally`; `detached.ts` to a root at the recorder module's top level, `recorders.run(() => scope(fn, { onError }))`.
- Each `unsafe/` folder left with only `unsafe.ts` goes, with the `check` script and `tsconfig.json` entries; the `keel`, `keel-library`, `keel-package-dev` and `keel-escapes` skills, the `@keel/schema` and `@keel/check` READMEs, a changeset.

After review, the builder:
- `@keel/schema`: the defect mark becomes the own key `Symbol.for('keel.defect')` (no `WeakSet`); `attempt` looks through `cause` and `errors` (8 steps) before `expect`; `isSchema` as a key guard set where schemas are made.
- `@keel/store`: `isStore`, `isTransaction`, key guards set by `store` and `transaction`.
- `@keel/reactive`: `moduleRoot` in `./internal`; `scope` without owner outside a module root and without `detached` raises the E1208 defect; E1203 raised as a defect (`fail` makes defects for E1203 and E1208).
- `@keel/compiler`: `moduleScope` runs every top-level declaration whose initializer holds a call, and every top-level expression statement holding one, in `moduleRoot`, not only the four reactive callees.
- `@keel/check`: E1452's `finally` exit (`noTryCatch.ts` or a `finallyExit.ts` under E1452); E1762 in the type pass (`unprovablePredicate.ts`, lifted in ranges); E1208 and E1203 after `await`; E1451's `Promise.reject`; E1452's `.then(f, g)`, `allSettled`, `any`; E1451, E1452, E1455 and E1207 resolved by symbol with the value-use finding; EXPLANATIONS.
- `@keel/cli`: R1013 by flow; R1015. `tooling/structure-lint.mjs`: E1452's `finally` exit and E1762 over every package's `src/` (E1762 through `check()`'s type pass on each package's tsconfig).
- `packages/testing`: `axeSync`'s predicate back into `unsafe/`; `documentRoute.ts` `isStateOf` into `unsafe/` unless it parses with the matched route's schemas.
- std-channels: `storesIn` with `isStore`; `holds` into `unsafe/`. std-conflicts: `isStore`, `isTransaction` from `@keel/store`. std-offline: `isWrite` with `isSchema` on `output` and each present `params`, `query`, `body`; `outbox` captures `owner()` (E1203 without one) and makes its store by `run` on first use. std-statecharts: `chart` makes its store in the owner it finds, E1203 without. std-postgres: `classify` gives `postgres.database { sqlstate }` and `keel.unreachable` per class, E2461 for the rest; `listenChanges` reports `lost` instead of its two defects. A maker a test file declares at its top level moves into a `detached` scope or a harness: `keelConfig` compiles no test file.

### After the third review, the builder
Order: conformance first (above), then by package.
- `@keel/schema`: `attempt` loses its one-argument overload and `toUnexpected`'s use; it returns a keel `Result` it is given as is; a one-argument call at run time is the defect E1452. `err` bounds its parameter and raises E1458. `KeelError` gains `cause`; `s.error` gains `causedBy` and `in`. `defect` takes the detail; `isDefect`, `isSchema` and the new `isObjectSchema` read the realm record; `DEFECT_KEY.ts` and `SCHEMA_KEY.ts` go. `Secret` loses `of`, `is`, `open`, `innerOf` and `marker` to functions private to the package (seven use sites in `gen.ts`, `internal/seal.ts`, `check.ts`, `secretWalk.ts`, `reveal.ts`, `toJson.ts`), and its constructor raises E1764 without the package's token. `parseJson` on every schema; rule `json`.
- `@keel/store`: `isStore`, `isTransaction` on the record; `STORE_KEY.ts`, `TRANSACTION_KEY.ts` go. `@keel/reactive`: `moduleRoot` marks its scope; `signal.set` and a module root's `run` ask the `moduleWrites` hook when the node's root is a module root.
- `@keel/router`: `loader`, `action`, `guard`, `serverOnly` and `manifest` record what they make (a `WeakMap` to the entry, the schemas and a copy of `decl`); `LOADER_KEY.ts`, `ACTION_KEY.ts`, `GUARD_KEY.ts`, `STUB.ts` and `markedFrozen`'s mark go, and with them the shape tests in `isLoader`, `isAction`, `isGuard`; `bindTable` refuses by identity; `isRouteTable` exported; `unsafe/objectSchemaOf.ts` goes.
- `@keel/server`: `runAction`, `runLoaders` and `notePii` read `input` and `output` from the maker's record; `refuseModuleWrites` covers signals and roots; the log path writes class, code, fingerprint, site and causes (`caught.ts`, `unexpectedOf.ts`, `scrubbedCause` keep the text for the second record only); `KEEL_LOG_THROWN` and E1596 at start.
- `@keel/check`: `noThrow.ts` and `noTryCatch.ts` lose their fixes and gain the two k.fixes names; `catchMessage.ts` texts; the executor rule; `defect` in `finally`; one-argument `attempt` and the untested `expect`; E1453 under `void`; E1455's message and detail forms and its `cause` fix; E1457, E1458, E1260 and E1256's static form; E1762 as the five proofs (`unprovenPredicates.ts` becomes a recognizer of proofs, anything else reported); `EXPLANATIONS.ts` for each, examples compiled by conformance. `tooling/structure-lint.mjs` S0019 and S0020 follow.
- `@keel/cli`: R1015 as narrowed, R1017.
- `@keel/runtime-dom`: `unsafe/propsSchemaOf.ts` goes for `isSchema`. std-sessions: `unsafe/routeTableOf.ts` goes for `isRouteTable`.
- std-postgres: `classify.server.ts` by the table (class `08` no longer by prefix); `unexpected.server.ts` a literal message with `data`; `keel.conflict` with its cause; `pgliteEngine.server.ts` `refuseTimeout` reads the three places after every statement and at open, its text test deleted; the cost measured and written in the README.
- Every package and app: each one-argument `attempt` (std-db 10, std-offline 14, std-postgres 13, std-channels 12, services 9, router 7, std-live 3, reactive 3, server 2, and ones and twos elsewhere) takes an `expect` naming what its call throws, or loses the `attempt` where it only guarded a bug; each interpolated `defect` message becomes a literal with `data`; `carriedParams`, `readWithin`, `readJson` and the `Result<_, unknown>` types take a `KeelError`; module-level mutable state in a `*.server.ts` file becomes a `processSlot` or request state.
- Skills (`keel`, `keel-server`, `keel-library`, `keel-escapes`), the `@keel/schema` and `@keel/check` READMEs and a changeset follow the build; their fenced examples compile against it.

### The count
| | main (d829b060) | lane-std-formats (466b3d5a) | after |
|-|-|-|-|
| kernel casts: ctx `asId`, `narrowAccessor`; forms `asSchemaValue`; runtime-dom `narrow`; store `sourcesFor`; testing `axeSync` (back from its predicate), `evalOnHeap` | 7 | 7 | 7 |
| stdlib casts: std-messages `asEntry`; std-offline `asResult`; std-statecharts `asEvents`, `loosen`; std-tables `asQuerySchema`; std-workflows `asEvents`, `looseChart` | 7 | 7 | 7 |
| defects, catches, detached scopes (rows of the first count) | 19 | 26 | 0 |
| a DOM read: std-tables `focusLost` | 0 | 1 | 1 |
| **total, the three patterns** | **33** | **41** | **14, or 15 with the lane** |
| predicates E1762 reports that no key guard can replace, by reading: testing `documentRoute.ts` `isStateOf<T>`, std-channels `channelRoute.server.ts` `holds<E>` (a type parameter each) | (uncounted) | (uncounted) | +2 |
| the kernel's other 100 or so predicates, read by E1762's first run | (uncounted) | (uncounted) | the builder records each |

So the honest count is 14 for the three patterns, as the first design said; with E1762 it is at least 16 on the main line (17 with the lane), plus whatever E1762's first run finds among the kernel's predicates, each a cast the count never held. std-conflicts' `isStore` and `isTransaction`, std-channels' `storesIn` and std-offline's `isWrite` take the kernel's key guards and stay out of it. `Settled.ts` (both) holds no call and goes with `settle`. lane-std-sessions adds 8 calls; this removes 3 (`caught`, `raise`, `detached`), leaves 5 platform reads, and its `userRealm.ts` `isTable` is E1762 unless it checks its contracts with `isSchema`.

What stays `unsafe` and why: casts over values the code built itself (k.unsafe's own case), predicates whose claim no run-time test proves, and platform reads the ctx has no capability for. None is a throw, a catch or a detached scope.

## Token impact
After review: k.errors about 3,096 (trimmed to fit, no clause changed); k.reactive about 2,360; k.unsafe about 2,565; k.escapes about 1,850; k.store about 2,260; k.schema about 3,030; std.postgres about 3,075 (its error classes written as one list to fit); std.postgres-changes about 820; no new section; the spec map at about 1,634 of 1,660 and `keel docs`' map unchanged in rows. k.errors 1,545 to about 2,740; k.reactive 1,479 to about 1,910; k.check 3,100 to about 3,085 (the removed lifts pay for the rewritten clause); k.escapes 1,587 to about 1,705; k.parity +22; k.unsafe +14. All under 3,100; the map is unchanged. `@keel/schema` gains two small functions; `@keel/check` gains one rule; budgets are re-based by the builder only if they overrun. `keel explain` gains E1455 under 120 tokens.

After the third review (characters over four, as `tooling/budgets.mjs` counts): k.errors 2,999; k.attempt 2,507; k.defects 1,483; k.fixes 2,088; k.identity 2,249; k.shared 1,522; k.serverlog 2,304; k.unsafe 2,503; k.reactive 2,856; k.schema 3,062; k.escapes 1,897; std.postgres 3,020; std.postgres-errors 1,159. Every one is under 3,100; no limit is raised; `spec.map`, `docs.map` and the four areas pass as measured. `keel explain` gains E1457, E1458, E1260, E1596 and E1764, each under 120 tokens.

## For the operator
1. **An `unsafe(` range no longer lifts `throw` or `catch`, in apps too.** Recommended: `defect` and `attempt(fn, expect)` cover every site in the tree, and a lift left in place is a second way to throw. Reverse by keeping E1451 and E1452 lifted in app code only.
2. **No library or stdlib package may detach a scope (E1207 everywhere but the kernel).** Recommended: every stdlib site is a module root or a nested scope, and a library that detaches under an owner escapes the request registry from inside the request. Reverse by keeping RFC 0238's library-range lift.
3. **The defect code is optional (D8).** Recommended now, with a backlog line that gives every stdlib throw a code in its section.
4. **Kernel packages keep their own throws.** They are not held to E1451; converting their 148 throwing files to `defect` would make `isDefect` hold of kernel errors too. Recommended as a later sweep, not a requirement here.
5. **E1762 will raise the count.** Recommended: a predicate that claims a signature is a cast, and the count should say so; the kernel's key guards keep the stdlib's own out of it. Reverse by leaving predicates to review alone (R1015).
6. **std.db keeps defects behind k.persist's rejecting storage contract.** Recommended for now; a `Result`-returning storage contract is a kernel change for its own RFC, with std-schedules' runner `Result` beside it.
7. **`expect` is required, and `attempt(fn)` goes.** Recommended. About 81 calls in package `src/`, about 70 in tests and 6 in the golden apps take an `expect` or lose the `attempt`. Reverse by keeping a one-argument form that passes every throw on, which the Alternatives call the worst of the three.
8. **`Result`'s error type is bounded to `KeelError`, and `err` refuses anything else.** Recommended. Four `err` calls and seven `Result<_, unknown>` or `Result<_, string>` types change.
9. **A `defect` message is a literal.** Recommended. About 40 of the stdlib's 63 calls move their values into `data`; a test that matched a value in a message reads `data`.
10. **A production log holds no thrown text; `KEEL_LOG_THROWN` opens at most 24 hours of it.** Recommended. An operator debugging a new failure sets one value and restarts. Reverse by making the window unbounded, which is the state the review found.
11. **Making a node in a module root during a request is E1256**, so a maker that builds its state lazily builds it at module evaluation on a server. Recommended; the builder audits `outbox` and each lazy maker.
12. **E1260 names `processSlot`, which RFC 0251 adds on `lane-r-boundary`.** Recommended: this RFC's build holds E1260 until RFC 0251 is merged, and the rest does not wait.
13. **Identity lives in the realm's kernel record, one per realm, not in a set private to each package copy.** Recommended: a second copy of a kernel package still knows a defect and a schema. Code that reaches the record on purpose can forge; that is listed as not held.
14. **RFC 0245's two `catch` fixes are withdrawn for k.fixes** (What RFC 0245 takes). Recommended: each ends clean and wrong on a wall-test case.
15. **E1457 is an error, not a warning.** Recommended: the shortest way to a clean check is then the total form.
16. **Six new sections.** The token gates pass with them as measured on this lane; if the owner's correction of `spec.map` and `docs.map` lands lower, the rows of the four areas are what to trim.

After the breaking review (D41 to D56), each a change to what an author writes or an operator reads:
17. **App code cannot call `supervise` (E1461); a library can, and review lists each call.** Recommended: a catch-all in app code is the shortest way past E1452. An app that runs code it does not own keeps that runner in a workspace library. Reverse by allowing it in `*.server.ts` files with R1018 at high.
18. **An `expect` must be readable by check and must claim in a branch a test selects.** An `expect` taken from a parameter or built by a call is refused; so are `(x) => (x ? T : undefined)` and a function that returns an error on every path. Recommended.
19. **An `expect` copies only a number, a boolean or a closed code out of what was thrown.** An SDK's string code is mapped to the error's own enum by a small function. Recommended: a `string` field is where the review's leak went.
20. **A `make` message is a literal, and a `KeelError` is never written by hand; `keelError.denied.make({})` and its five siblings are new exports of `@keel/schema`.** About 45 hand-written kernel errors in the apps, examples, scaffold and guide change. Recommended: one way to make an error, and every error then has a schema. Reverse by keeping the object literal legal and refusing only its non-literal `message`.
21. **`ok(result)` is refused by check (E1459) and at run time, not by `ok`'s TypeScript type.** A type that refuses it also refuses `ok(v)` in every generic function. Recommended.
22. **Two copies of a kernel package in one process are a start error (E1765) in place of a shared record.** A monorepo that resolves `@keel/schema` twice must dedupe; check and build say so before start. Recommended: the shared record was the forgery's door.
23. **`Symbol.for('keel.…')`, and listing the global object's symbol keys, are refused in app and library code (E1766).** Recommended.
24. **A listener for uncaught throws (`unhandledrejection`, `window.onerror`, `process.on('uncaughtException')`) is E1452 in app and library code.** An error-reporting library reads the ctx's `error` events and the server log. Recommended; reverse for libraries only if a reporting library needs the raw event.
25. **A start refusal prints its own code and message in production.** Its message holds names the app declared (a deployable, a module, an environment key), never a value. Recommended.
26. **Inside the `KEEL_LOG_THROWN` window the E1577 record holds the scrubbed text.** Recommended.
27. **Nothing refuses a module-level `let` or `Map` written by a request today, and the spec and skill say so.** E1260 returns to k.shared with the RFC that builds `processSlot`. Recommended over describing a rule that does not run.
28. **The keel skill needs about 450 more tokens for the three wall-test patterns, or a tenth skill for failures.** Not done here: a skill's target is not raised in a lane. Recommended: re-base the keel skill.
29. **A marked value copied into an unmarked `data` field of an error still reaches a response.** Check cannot see a mark through a type. Recommended next step, its own RFC: a `.pii()` brand in the inferred type, so the copy fails to compile.

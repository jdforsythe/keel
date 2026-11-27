# RFC 0242: k.errors and k.reactive: `defect`, `attempt`'s `expect`, module roots; no `unsafe` throws, catches or detached scopes

Status: implemented (ADR-0264) for D1 to D8; D9 to D16 accepted by the orchestrator on 2026-11-26 after review, not built; for the operator to confirm. Under the plan's D191 and D192. Amends k.errors (Split, API, Defects, Rules E1451, E1452, E1455, nine clauses), k.reactive (API, Rules E1203, E1207, E1208, Module roots, Static, clauses #13 and #21 rewritten, #22 to #25), k.check (App code's lifted set), k.escapes (R1013, R1015), k.parity (By kind), k.unsafe (Unsafe, One path, Type predicates, E1762), k.store (Guards), k.schema (Guard), std.postgres (Errors, E2461), std.postgres-changes (`follow`). No new section: `keel docs`' map is at its budget, so each new rule sits in the section that owns its code. New glossary terms: **defect**, **module root**, **key guard**.

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
- structure-lint's two findings carry codes: S0018 (control leaving `finally`) and S0019 (E1762's predicate); `structure-lint-finally-exit.test.ts` matches the code, not the text. k.unsafe#13: E1455 through `call`, `apply`, `Reflect.apply` and `bind`. std.postgres' 22001 case is an `insert` into a `varchar(2)` column; std.postgres-changes' `follow` case needs no server.
- `packages/check/conformance/unsafe-type-predicates.test.ts`: k.unsafe#10 and #11 (E1762, its lift). `packages/cli/conformance/`: k.escapes' R1013 clause as rewritten (eight reported forms, three clean) and R1015's.
- `packages/store/conformance/guards.test.ts`: k.store's last clause; `packages/schema/conformance/is-schema.test.ts`: k.schema's last clause.
- `packages/std-postgres/conformance/`: std.postgres' two last clauses (`postgres.database` per SQLSTATE on Postgres 17 and PGlite; E2461 for `42P01`) and std.postgres-changes' last (a `follow` that cannot listen gets one `lost`).

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

## For the operator
1. **An `unsafe(` range no longer lifts `throw` or `catch`, in apps too.** Recommended: `defect` and `attempt(fn, expect)` cover every site in the tree, and a lift left in place is a second way to throw. Reverse by keeping E1451 and E1452 lifted in app code only.
2. **No library or stdlib package may detach a scope (E1207 everywhere but the kernel).** Recommended: every stdlib site is a module root or a nested scope, and a library that detaches under an owner escapes the request registry from inside the request. Reverse by keeping RFC 0238's library-range lift.
3. **The defect code is optional (D8).** Recommended now, with a backlog line that gives every stdlib throw a code in its section.
4. **Kernel packages keep their own throws.** They are not held to E1451; converting their 148 throwing files to `defect` would make `isDefect` hold of kernel errors too. Recommended as a later sweep, not a requirement here.
5. **E1762 will raise the count.** Recommended: a predicate that claims a signature is a cast, and the count should say so; the kernel's key guards keep the stdlib's own out of it. Reverse by leaving predicates to review alone (R1015).
6. **std.db keeps defects behind k.persist's rejecting storage contract.** Recommended for now; a `Result`-returning storage contract is a kernel change for its own RFC, with std-schedules' runner `Result` beside it.

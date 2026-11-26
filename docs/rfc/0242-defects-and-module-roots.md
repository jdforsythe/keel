# RFC 0242: k.errors and k.reactive: `defect`, `attempt`'s `expect`, module roots; no `unsafe` throws, catches or detached scopes

Status: implemented (ADR-0264), accepted by the orchestrator on 2026-11-26, for the operator to confirm. Under the plan's D191 and D192. Amends k.errors (Split, API, a Defects paragraph, Rules E1451 and E1455, six clauses), k.reactive (API, Rules E1207, a Module roots paragraph, clauses #13 and #21 rewritten, two clauses), k.check (App code: E1451, E1452 and E1207 are lifted nowhere; one clause rewritten), k.escapes (R1013, one clause), k.parity (By kind) and k.unsafe (Unsafe). New glossary terms: **defect**, **module root**.

## Decisions
- D1: `defect(message: string, code?: DefectCode): never` and `isDefect(x: unknown, code?: string): x is Defect`, in `@keel/schema` beside `ok`, `err` and `attempt`. A defect is an `Error` named `Defect`, its message `<code> <message>` when a code is given, its `code` a non-enumerable own property. `DefectCode` is `` `E${number}` ``; E1455 holds a given code to a literal `E` and four digits.
- D2: `attempt(fn, expect?)`. Without `expect`, as today. With it, a thrown or rejected value that is no defect goes to `expect`; a `KeelError` it returns is the `err`, `undefined` throws or rejects with the very value. A defect is never handed to `expect`.
- D3: `try`/`finally` without `catch` is ordinary code (E1452 already reads it so; k.errors now says it): the cleanup-then-rethrow sites use it.
- D4: an `unsafe(` range no longer lifts E1451 or E1452, in an app or a library: a throw is a defect, a catch is `attempt`. E1451's message names `defect`.
- D5: a module root is a scope made while no scope runs. k.reactive states the semantics the runtime and the compiler's module scope already have, and names it the owner of state a library keeps for its module's life, entered later with `run`.
- D6: E1207 is lifted nowhere and judged in every file but a kernel package's own (`packages/<p>/`, `<p>` one of the fifteen kernel folders): no stdlib package or library detaches a scope.
- D7: R1013 (`keel review`, medium): a `defect` call on a `Result`'s `err` branch, for a person to judge whether the failure was expected.
- D8: the code is optional. A section that names a code for a throw passes it; a throw no section codes takes none. Giving every stdlib throw a code is a later sweep, not this RFC.

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
import { owner, scope } from '@keel/reactive'
import { s } from '@keel/schema'
import { store, transaction } from '@keel/store'

const Queue = s.object({ items: s.array(s.string()) })

export function queue(id: string) {
  const make = () => {
    const st = store(Queue, { items: [] }, { id })
    return { st, push: transaction(st, `${id}.push`, s.string(), (q, x) => ({ items: [...q.items, x] })) }
  }
  // Declared at module level: no owner runs, so this scope is a root that lives as long as the module.
  const root = owner() === undefined ? scope(() => undefined) : undefined
  let made = root === undefined ? make() : undefined
  return () => (made ??= root === undefined ? make() : root.run(make))
}
```
Made where `owner()` is undefined, `scope(fn)` is a root; `run` on it later, from a component or a request, makes the store the root's and not the caller's, and it lands in the module registry. A recorder that must outlive the component calling `record` does the same from a root its package makes at top level: `recorders.run(() => scope(fn, { onError }))`, which its `stop()` disposes. `isolated` (std-conflicts) needs no root at all: `scope(() => { isolate(owner()); body() })` nested in whatever runs, then `dispose()`, gives the factory a registry of its own; std-conflicts' entry is server code with no `uses` above it.

What a source can do with this that it could not: nothing new. `run` on a root made at module level reaches the module registry and no `uses` chain; so does a top-level `store` written in any app file today, which any request may `tx`. E1207 still keeps a scope made under an owner nested in it: the request registry and `uses` are escaped only by state declared at module level, which is module state by its declaration.

### Rules
- E1451's message: `throw in app code; return err(...) when expected, defect(...) when a bug`; its fix stays `return err(`.
- E1455: a `defect` call (any alias or `<ns>.defect` of `@keel/schema`) whose second argument is not a string literal `E` and four digits, at the argument, no fix. TypeScript's `` `E${number}` `` lets `E1.5` and a variable through; the code is a stable name `keel docs --for` finds.
- k.check App code: the lifted set loses E1451 and E1452, and a library's file loses its E1207 exception.
- E1207: judged in every project file but a kernel package's own, `packages/<p>/` for the fifteen kernel folders. `noDetachedScope`'s `packages/` test becomes that list.
- R1013 in `keel review`: a `defect` call in a `Result`'s `err` branch (`if (!x.ok)`, `x.ok === false`, the `else` of `if (x.ok)`, the third operand of `x.ok ? a : b`). This is the abuse check can name and not judge: turning an expected failure into an exception. Some are right (std-db turns `attempt`'s `keel.unexpected` from opening SQLite into E2153), so a person or the `keel-escapes` skill reads each. What `keel check` still refuses: a bare `throw`, any `catch` but `attempt`, a non-literal code; what review still sees: every `unsafe(` (R1001) and every defect on an `err` branch.

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

## Migration
Nothing is released; no migration notes. The sites, by package (the builder):
- `@keel/schema`: `src/defect.ts`, `src/isDefect.ts`, `src/Defect.ts` (type), `src/DefectCode.ts` (type); `attempt.ts` gains the `expect` overload (a defect rethrown before `expect`); `index.ts` exports them. `toUnexpected` unchanged.
- `@keel/check`: `noThrow.ts` message; `noTryCatch.ts` and `noThrow.ts` read lifted ranges (E1451, E1452 leave the lifted list in `isLifted` or its equivalent); `noDetachedScope.ts` exempts the kernel folder list only, and loses the library-range exception; new `defectCode.ts` (E1455); `PIPELINE_CODES.ts`, `EXPLANATIONS.ts` (E1451, E1455, E1207 texts).
- `@keel/cli`: `keel review` R1013 in `review/ESCAPES.ts`; `tooling/structure-lint.mjs` S0014 no longer counts E1451, E1452 or E1207 as escapes in a library range.
- std-channels: `fault.ts` to `defect(text, code)`. std-conflicts: `raise.ts` to `defect`; `isolated.ts` to a nested `scope` with `isolate`, then `dispose()`, in `src/internal/`. std-db: `raise.ts` to `defect` (`dbError`'s codes as `code`, `opFailed`'s text as the message); `settle.ts`, `settleNow.ts`, `Settled.ts` to `attempt(fn, expect)`; `tx` and each cleanup-then-rethrow to `try`/`finally`. std-headless: `keyFault.ts`. std-jobs, std-schedules, std-statecharts, std-workflows: `refuse.ts`. std-live: `outsideScope.ts` to `defect('live() called outside any scope; wrap it in scope(fn)', 'E1203')`. std-offline: `raise.ts`; `detached.ts` to a root made at declaration when `owner()` is undefined, its store made by `root.run(make)` on first use; `afterRejection.ts` to `try`/`finally` with a flag; `recovering.ts` to `attempt(run, () => (lost ? storageLost : undefined))`, then the recovery. std-postgres: `raise.ts`, `unexpected.server.ts` (a defect naming the SQLSTATE), `settle.ts`, `Settled.ts` as std-db. std-statecharts: `detached.ts` to `scope(() => undefined).run(() => compile(id))` under its `owner() === undefined` guard.
- lane-std-formats (when merged): std-i18n `refuse.ts`, std-messages `badSet.ts`, `refused.ts`, std-money `noDecimalForm.ts`, std-tables `tableFault.ts`, std-temporal `notDuration.ts`, std-text `boundFault.ts` to `defect` (a `RangeError` they throw today becomes a defect; no conformance asserts its class).
- lane-std-sessions (when merged): `caught.ts`, `Thrown.ts` to `attempt(run, expect)`; `raise.ts` to `defect` and `try`/`finally`; `detached.ts` to a root at the recorder module's top level, `recorders.run(() => scope(fn, { onError }))`.
- Each `unsafe/` folder left with only `unsafe.ts` goes, with the `check` script and `tsconfig.json` entries; the `keel`, `keel-library`, `keel-package-dev` and `keel-escapes` skills, the `@keel/schema` and `@keel/check` READMEs, a changeset.

### The count
| | main (d829b060) | lane-std-formats (466b3d5a) | after |
|-|-|-|-|
| kernel casts: ctx `asId`, `narrowAccessor`; forms `asSchemaValue`; runtime-dom `narrow`; store `sourcesFor`; testing `axeSync`, `evalOnHeap` | 7 | 7 | 7 |
| stdlib casts: std-messages `asEntry`; std-offline `asResult`; std-statecharts `asEvents`, `loosen`; std-tables `asQuerySchema`; std-workflows `asEvents`, `looseChart` | 7 | 7 | 7 |
| defects: std-channels `fault`; std-conflicts, std-db, std-offline, std-postgres `raise`; std-headless `keyFault`; std-jobs, std-schedules, std-statecharts, std-workflows `refuse`; std-live `outsideScope` | 11 | 11 | 0 |
| defects in the lane: std-i18n `refuse`; std-messages `badSet`, `refused`; std-money `noDecimalForm`; std-tables `tableFault`; std-temporal `notDuration`; std-text `boundFault` | 0 | 7 | 0 |
| catches: std-db `settle`, `settleNow`; std-postgres `settle`; std-offline `afterRejection`, `recovering` | 5 | 5 | 0 |
| detached scopes: std-conflicts `isolated`; std-offline, std-statecharts `detached` | 3 | 3 | 0 |
| a DOM read: std-tables `focusLost` (E1252, not in scope here) | 0 | 1 | 1 |
| **total** | **33** | **41** | **14, or 15 with the lane** |

`Settled.ts` (both) holds no call and goes with `settle`. lane-std-sessions adds 8 calls; this removes 3 (`caught`, `raise`, `detached`) and leaves 5 platform reads (`currentValues`, `hasDocument`, `loadGroup.server`, `platformFetch`, `wallClock`), each an E1252, E1601, R1053 or global-`fetch` escape outside these patterns.

What stays `unsafe` and why: the 14 casts are type-system escapes over values the code built itself (k.unsafe's own case), and `focusLost` and the five std-sessions reads are platform reads the ctx has no capability for. None is a throw, a catch or a detached scope. Irreducible among the three patterns: none.

## Token impact
k.errors 1,545 to about 2,740; k.reactive 1,479 to about 1,910; k.check 3,100 to about 3,085 (the removed lifts pay for the rewritten clause); k.escapes 1,587 to about 1,705; k.parity +22; k.unsafe +14. All under 3,100; the map is unchanged. `@keel/schema` gains two small functions; `@keel/check` gains one rule; budgets are re-based by the builder only if they overrun. `keel explain` gains E1455 under 120 tokens.

## For the operator
1. **An `unsafe(` range no longer lifts `throw` or `catch`, in apps too.** Recommended: `defect` and `attempt(fn, expect)` cover every site in the tree, and a lift left in place is a second way to throw. Reverse by keeping E1451 and E1452 lifted in app code only.
2. **No library or stdlib package may detach a scope (E1207 everywhere but the kernel).** Recommended: every stdlib site is a module root or a nested scope, and a library that detaches under an owner escapes the request registry from inside the request. Reverse by keeping RFC 0238's library-range lift.
3. **The defect code is optional (D8).** Recommended now, with a backlog line that gives every stdlib throw a code in its section.
4. **Kernel packages keep their own throws.** They are not held to E1451; converting their 148 throwing files to `defect` would make `isDefect` hold of kernel errors too. Recommended as a later sweep, not a requirement here.

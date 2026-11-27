# k.errors: Results and boundaries
status: implemented

**Split.** Expected failures (invalid input, not found, denied, conflict, network) are values: a `KeelError` in a `Result` (k.attempt). Unexpected failures (bugs, broken invariants, a library's throw nothing claimed) are thrown and reach the nearest `<Boundary>` or the server's owner of the request. Code held to the rules raises one only with `defect` (k.defects), and never for a failure a `Result` type names. Which is which: a failure a caller could meaningfully handle (retry it, take another path, tell a person) is a value, also when it reaches the code as a platform's throw, which `attempt`'s `expect` then names; a defect is a bug or corrupted state.

**API.**
```ts
import { s, ok, err, attempt, defect, type Result } from '@keel/schema'
export const OrderLocked = s.error('orders.locked', s.object({ id: s.id('Order') })) // in *.schema.ts
function close(o: Order): Result<Order, s.infer<typeof OrderLocked>> {
  return o.locked ? err(OrderLocked.make({ id: o.id })) : ok({ ...o, open: false })
}
const r = close(order)
if (r.ok) use(r.value); else show(r.error.code)
const prefs = Prefs.parseJson(text)
const saved = await attempt(() => pg.query(text), (x) => (isUnique(x) ? Taken.make({}) : undefined))
```
- `Result<T, E>`'s only constructors are `ok` and `err`; no `map` or `unwrap`: narrow on `r.ok`. `s.result(T, E)` is its schema (codec for loaders, actions, services).
- `KeelError<C, D>` is a serializable `{ code: C, message: string, data: D, cause? }` (k.attempt). `code` is a dotted string literal; app codes start with the module id (E1155). `s.error(code, data)` declares one; `.make(data, message?)` builds one (message defaults to the code).
- Kernel codes: `keel.unexpected`, `keel.notFound`, `keel.denied`, `keel.fields` (k.forms), `keel.payloadTooLarge`, `keel.conflict`, `keel.unreachable` and `keel.busy` (k.server), `schema.invalid` (`SchemaError`, data `{ issues: { path, rule }[] }`), `api.*` (k.services). KeelError codes are data, E-codes diagnostics; they never share a namespace.
- `attempt(fn, expect)` is the only sanctioned catch, and `expect` names the thrown values that are expected failures; every other throw, a defect among them, goes on unchanged (k.attempt).
- `try`/`finally` without `catch` is no E1452: the `finally` runs and the throw goes on unchanged. It is how code cleans up after a throw it does not handle, with a flag where the cleanup is for a failure only: `let done = false; try { work(); done = true } finally { if (!done) undo() }`. Control leaving the `finally`, and a `defect` call in it, are E1452.

**Boundaries.**
```tsx
<Boundary fallback={(e, reset) => <Retry error={e} onRetry={reset} />}>
  <OrderPanel id={id} />
</Boundary>
```
`Boundary` (from `@keel/runtime-dom`) catches throws from render, `computed`, `effect`, and event handlers (including rejections of promises they return) in its subtree. The nearest boundary wins. On catch the subtree's scope is disposed and `fallback` renders with a `CaughtError`: `KeelError<'keel.unexpected'>` for any throw, or `schema.invalid` (`data.issues` too) for a host element's value or `emit` detail that fails its schema (k.host-element, k.host-code); `data.at` of either is the element id where the throw surfaced; `reset()` re-renders the children in a fresh scope. Every route is a boundary whose fallback is its `errorElement`; the app root has a default one, for a `mount` tree and for each island `resume` resumes: it catches what any Boundary catches, reports the error to the ctx (k.ctx `error`) and renders `<pre data-k-error="<at>">` holding `keel.unexpected` (`mode: 'dev'`: the message) in place of that tree or island (a throw while `resume` claims an island is a mismatch, k.runtime E1253). A throw at no element of its own (the root component's own `effect`, `computed` or render) has `data.at` the `data-k` at the root's place (the `mount` element, the island's parent), else `""`. A handler's throw has `data.at` an id the compiler wrote: the id `on` registered it under, else the `data-k` of its element or of the nearest ancestor with a non-empty one (the compiler stamps a bound template element's id, and a bound k.ui base element's literal `id`), else `""`; an `id` set at runtime never is, and the `attr` op never sets `data-k`. A `resource` fetcher failure is its `error` state, not a throw (k.reactive).

**Rules.** In app code and a library's files, `unsafe(` ranges included (k.check App code), each callee found as k.unsafe One path says; fixes: k.fixes.
- E1451 `throw`, a call of `Promise.reject`, or a `new Promise` executor that declares a second parameter or is no function literal, message `throw in app code: return err(E.make(data)) for a failure a caller handles, defect('text') for a bug`. A `throw` of a `catch` clause's own binding, in that clause and outside a function nested in it, is part of that catch: E1452 reports it and E1451 does not.
- E1452 a catch in any form. `try`/`catch`: `catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect), any other throw reaches its owner with no catch`. `.catch()`, a `.then()` given a second argument, `Promise.allSettled` and `Promise.any`: `<form> in app code: await it; an expected failure is attempt(fn, expect)`. A `return`, `break` or `continue` whose target lies outside the `finally` block holding it, at the statement: `control leaves finally and drops its throw`. A `defect` call in a `finally` block: `defect in finally drops the throw in flight`. The last two also in this repository's every package's `src/` and `unsafe/` (`tooling/structure-lint.mjs`, S0020). `attempt` with one argument and an `expect` that tests nothing: k.attempt.
- E1453 a `Result` or `Promise<Result>` discarded as an expression statement, bare or under `void`, inside a function given to `attempt` too, message `Result discarded: narrow on r.ok and handle r.error`.
- E1454 two `s.error` declarations with the same code.
- E1455 a `defect` call whose message, code or detail is not the literal k.defects asks for.
- E1457 and E1458: k.attempt.

**Layers.** What holds of a failure, in three layers.
- Check refuses: every throw but `defect`; every catch but `attempt(fn, expect)`, and each way a `finally` drops a throw (E1452); a discarded `Result` (E1453); a defect whose message could carry a value (E1455); a bare throwing built-in (E1457); a failure value that is no `KeelError` (E1458); a visible write to module state in server code (E1256, E1260, k.shared); a type predicate its body does not prove (E1762, k.identity); a reactive maker after an `await` (E1203, E1208, k.reactive). A fix is offered only where k.fixes says it is right.
- The run time holds, whatever check saw: every throw reaches an owner that reports it once, by code, site and fingerprint and never by its text (k.serverlog Thrown values); a response holds `keel.unexpected` with empty data; `attempt` passes a defect on; `err` refuses what is no `KeelError`; a write to module state while a request is served is the defect E1256 (k.shared); a value no maker made is refused where it is bound (E1515, k.identity); a maker with no owner is the defect E1203 or E1208.
- Not held: an `expect` that tests its parameter and claims too much (R1017 lists the widest); a defect raised for a failure a caller could have handled (R1013 lists each); a personal value put in `data` whose schema carries no mark; a throw of a function called in a `finally`, which replaces the throw in flight; a throwing call check has no row for, which is a defect at run time; a `Result` kept in a binding, array or property nothing reads; plain module state written through a helper check cannot follow (k.shared); code that reaches the realm's kernel record to forge an identity (k.identity).

**Conformance.**
- `ok(v)` is `{ ok: true, value: v }`; `err(e)` is `{ ok: false, error: e }`.
- `s.result(T, E)` round-trips every generated ok and err value through its JSON codec.
- `attempt(fn, expect)` returns `ok(value)` when `fn` returns a value, and with `expect` returning `undefined` for every value it throws or rejects with what `fn` threw.
- A throw during a child's render renders the nearest enclosing Boundary's fallback; content outside that boundary is unchanged and no outer fallback renders.
- After a catch, no effect created in the failed subtree runs again.
- `reset()` re-renders the children; if they throw again the fallback renders again with the new error.
- A throwing transaction leaves `snapshot()` and `log()` equal to their values before the call.
- Each code of Rules has a fixture that triggers it and a clean counterpart.
- After `resume`, an island whose handler throws reports one `keel.unexpected` with that element's id as `data.at` to an observer and renders the root fallback, holding only `keel.unexpected`, in place of the island; the page's other islands keep handling events; under `mount` the same throw reports the same error.
- After `resume`, an `effect` created in an island's component that throws on a later `signal.set` reports one `keel.unexpected` with `data.at` `""` (no stamped parent) and renders the root fallback in place of the island, also for an island re-rendered on the client after a mismatch; the other islands keep handling events.
- A handler registered with `on(element, …)` on an element whose `id` is set at runtime throws with `data.at` the `data-k` of its nearest ancestor that has one, else `""`; `attr(el, "data-k", …)` sets nothing.
- In a compiled module, a throwing `onClick` on a k.ui base element with a literal `id` (a `.tsx` tag or a `.ts` call `Button({ id: "…" })`) reports that id as `data.at`; with `id={expr}` and no stamped ancestor it reports `""`; on a plain element it reports the element's compiler id.
- With `mode: 'dev'`, the root fallback `resume` renders in place of an island whose handler throws holds the error's message; without `mode` it holds only `keel.unexpected`.
- The same component and the same click report the same `data.at` under `mount` and after `resume`, for a handler's throw, for a binding's throw (the element the binding writes) and for the component's own `effect` throw (`""`), when the handler's write makes the computed they read throw.
- In `modules/m/a.ts`, `try { f() } finally { g() }` is no E1452 and `try { f() } catch { g() } finally { h() }` is one, message `catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect), any other throw reaches its owner with no catch`.
- In `modules/m/a.ts`, `function f() { try { return defect('bug') } finally { return 7 } }`, `for (;;) { try { g() } finally { break } }` and `for (const x of xs) { try { g(x) } finally { continue } }` are one E1452 each, message `control leaves finally and drops its throw`, at the `return`, `break` or `continue`; `try { g() } finally { for (;;) { break } }` and `try { g() } finally { h() }` are none.
- In `modules/m/a.ts`, `throw new Error('x')` is one E1451, message `throw in app code: return err(E.make(data)) for a failure a caller handles, defect('text') for a bug`, `new Promise((res, rej) => rej(x))` and `new Promise((_res, rej) => { on(rej) })` are one each at the second parameter, and `new Promise(start)` with `start` a name is one at `start`; `defect('x')` (imported from `@keel/schema`), `new Promise((res) => res(1))` and `new Promise<Result<number, E>>((res) => res(err(T)))` are none.
- In `modules/m/a.ts` with `rr` typed `() => Result<number, E>`: `rr()`, `void rr()`, `void (await prr())` with `prr` its `async` twin, and the statement `rr()` inside `attempt(() => { rr(); return 1 }, expect)` are one E1453 each, message `Result discarded: narrow on r.ok and handle r.error`, with no fix; `return rr()` and `const r = rr(); if (!r.ok) return r` are none.
- `p.catch(g)`, `p.then(f, g)`, `Promise.allSettled(ps)` and `Promise.any(ps)` in `modules/m/a.ts` are one E1452 each whose message starts with the form (`.catch()`, `.then() given a second argument`, `Promise.allSettled`, `Promise.any`) and ends ` in app code: await it; an expected failure is attempt(fn, expect)`.

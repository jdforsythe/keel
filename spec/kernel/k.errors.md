# k.errors: Results and boundaries
status: implemented

**Split.** Expected failures (invalid input, not found, denied, conflict, network) are values: `Result`. Unexpected failures (bugs, broken invariants, throwing libraries) are exceptions caught by the nearest `<Boundary>`. Code held to the rules raises one only with `defect` (Defects), and never for a failure a `Result` type names.

**API.**
```ts
import { s, ok, err, attempt, defect, type Result } from '@keel/schema'
export const OrderLocked = s.error('orders.locked', s.object({ id: s.id('Order') })) // in *.schema.ts
function close(o: Order): Result<Order, s.infer<typeof OrderLocked>> {
  return o.locked ? err(OrderLocked.make({ id: o.id })) : ok({ ...o, open: false })
}
const r = close(order)
if (r.ok) use(r.value); else show(r.error.code)
const parsed = await attempt(() => lib.parse(text))
const saved = await attempt(() => pg.query(text), (x) => (isUnique(x) ? Taken.make({}) : undefined))
const row = rows[i] ?? defect(`at: no row ${i} of ${rows.length}`)
```
- `Result<T, E>`'s only constructors are `ok` and `err`; no `map` or `unwrap`: narrow on `r.ok`. `s.result(T, E)` is its schema (codec for loaders, actions, services).
- `KeelError<C, D>` is a serializable `{ code: C, message: string, data: D }`. `code` is a dotted string literal; app codes start with the module id (E1155). `s.error(code, data)` declares one; `.make(data, message?)` builds one (message defaults to the code).
- Kernel codes: `keel.unexpected`, `keel.notFound`, `keel.denied`, `keel.fields` (k.forms), `keel.payloadTooLarge`, `keel.conflict`, `keel.unreachable` and `keel.busy` (k.server), `schema.invalid` (`SchemaError`, data `{ issues: { path, rule }[] }`), `api.*` (k.services). KeelError codes are data, E-codes diagnostics; they never share a namespace.
- `attempt(fn, expect?)` is the only sanctioned catch: it runs `fn` (sync or async; the result is a `Result`, or a promise of one, as `fn`'s is). Without `expect` it returns `err` with `keel.unexpected` if `fn` throws or rejects, and never throws. With `expect`, a value `fn` throws or rejects with that is no defect goes to `expect(thrown)`: a `KeelError` it returns is the `err`; for `undefined` the call throws or rejects with that very value. A defect is thrown on unchanged and `expect` never sees it; a throw of `expect` itself is thrown in place of the first.
- `try`/`finally` without `catch` is no E1452: the `finally` runs and the throw goes on unchanged. It is how code cleans up after a throw it does not handle.

**Defects.** A defect is a failure no caller is meant to handle: a bug in the calling code (a declaration or argument the spec refuses), a broken invariant, stored state that fails its own shape, or a fault under a contract whose failure is a throw or a rejection (a storage driver, k.persist). `defect(message, code?)` (`@keel/schema`) throws one and returns `never`: an `Error` whose `name` is `Defect`, whose `message` is `message`, or `<code> <message>` with `code`, and whose `code`, when given, is an own property that is not enumerable. `code` is the diagnostic code (`E` and four digits) the section naming the throw lists. `isDefect(x, code?)` is true only of a value `defect` threw, with `code` only of one with that code; an `Error` named `Defect` some other way is none. Where a section says code in an app or library throws or rejects, it raises a defect; one raised in an `async` function rejects. A defect goes where any throw goes, with nothing added: the nearest `Boundary` (`keel.unexpected`), the server's answer and log record (k.server; its message scrubbed as k.privacy Server log says), a failed test, a failed `simulate` run; `attempt` without `expect` makes it `keel.unexpected`, `data.cause` `Defect: <its message>`. Its message is the code's own text, naming what is wrong, never a value a person gave, since it reaches logs and, in `dev`, the page. A test asserts one with `toThrow` on its message, or with `isDefect` of what it caught.

**Boundaries.**
```tsx
<Boundary fallback={(e, reset) => <Retry error={e} onRetry={reset} />}>
  <OrderPanel id={id} />
</Boundary>
```
`Boundary` (from `@keel/runtime-dom`) catches throws from render, `computed`, `effect`, and event handlers (including rejections of promises they return) in its subtree. The nearest boundary wins. On catch the subtree's scope is disposed and `fallback` renders with a `CaughtError`: `KeelError<'keel.unexpected'>` for any throw, or `schema.invalid` (`data.issues` too) for a host element's value or `emit` detail that fails its schema (k.host-element, k.host-code); `data.at` of either is the element id where the throw surfaced; `reset()` re-renders the children in a fresh scope. Every route is a boundary whose fallback is its `errorElement`; the app root has a default one, for a `mount` tree and for each island `resume` resumes: it catches what any Boundary catches, reports the error to the ctx (k.ctx `error`) and renders `<pre data-k-error="<at>">` holding `keel.unexpected` (`mode: 'dev'`: the message) in place of that tree or island (a throw while `resume` claims an island is a mismatch, k.runtime E1253). A throw at no element of its own (the root component's own `effect`, `computed` or render) has `data.at` the `data-k` at the root's place (the `mount` element, the island's parent), else `""`. A handler's throw has `data.at` an id the compiler wrote: the id `on` registered it under, else the `data-k` of its element or of the nearest ancestor with a non-empty one (the compiler stamps a bound template element's id, and a bound k.ui base element's literal `id`), else `""`; an `id` set at runtime never is, and the `attr` op never sets `data-k`. A `resource` fetcher failure is its `error` state, not a throw (k.reactive).

**Rules.** E1451 `throw` in app code, message `throw in app code; return err(...) when expected, defect(...) when a bug` (fix: `return err(...)`) · E1452 `try`/`catch` or `.catch()` in app code (fix: `attempt`) · E1453 a `Result` or `Promise<Result>` discarded as an expression statement · E1454 two `s.error` declarations with the same code · E1455 a call of `defect` (`@keel/schema`, any alias, or `<ns>.defect`) whose second argument is not a string literal of `E` and four digits, at that argument, message `defect code is not a literal E and four digits` (no fix). An `unsafe(` range lifts neither E1451 nor E1452 (k.check App code).

**Conformance.**
- `ok(v)` is `{ ok: true, value: v }`; `err(e)` is `{ ok: false, error: e }`.
- `s.result(T, E)` round-trips every generated ok and err value through its JSON codec.
- `attempt` returns `ok(value)` when `fn` returns, and `err` with code `keel.unexpected` when `fn` throws or its promise rejects; it never throws.
- A throw during a child's render renders the nearest enclosing Boundary's fallback; content outside that boundary is unchanged and no outer fallback renders.
- After a catch, no effect created in the failed subtree runs again.
- `reset()` re-renders the children; if they throw again the fallback renders again with the new error.
- A throwing transaction leaves `snapshot()` and `log()` equal to their values before the call.
- Each of E1451-E1454 has a fixture that triggers it and a clean counterpart.
- After `resume`, an island whose handler throws reports one `keel.unexpected` with that element's id as `data.at` to an observer and renders the root fallback, holding only `keel.unexpected`, in place of the island; the page's other islands keep handling events; under `mount` the same throw reports the same error.
- After `resume`, an `effect` created in an island's component that throws on a later `signal.set` reports one `keel.unexpected` with `data.at` `""` (no stamped parent) and renders the root fallback in place of the island, also for an island re-rendered on the client after a mismatch; the other islands keep handling events.
- A handler registered with `on(element, …)` on an element whose `id` is set at runtime throws with `data.at` the `data-k` of its nearest ancestor that has one, else `""`; `attr(el, "data-k", …)` sets nothing.
- In a compiled module, a throwing `onClick` on a k.ui base element with a literal `id` (a `.tsx` tag or a `.ts` call `Button({ id: "…" })`) reports that id as `data.at`; with `id={expr}` and no stamped ancestor it reports `""`; on a plain element it reports the element's compiler id.
- With `mode: 'dev'`, the root fallback `resume` renders in place of an island whose handler throws holds the error's message; without `mode` it holds only `keel.unexpected`.
- The same component and the same click report the same `data.at` under `mount` and after `resume`, for a handler's throw, for a binding's throw (the element the binding writes) and for the component's own `effect` throw (`""`), when the handler's write makes the computed they read throw.
- `defect('no row 3')` throws a value `v` with `v instanceof Error`, `v.name` `Defect`, `v.message` `no row 3`, no own `code` property, and `isDefect(v)` true; `defect('bad key', 'E2801')` throws one with `message` `E2801 bad key`, own `code` `E2801`, `Object.keys(v)` not holding `code`, `isDefect(v, 'E2801')` true and `isDefect(v, 'E2802')` false; `isDefect(new Error('x'))`, `isDefect(Object.assign(new Error('x'), { name: 'Defect' }))` and `isDefect('x')` are false.
- `attempt(() => defect('bad key', 'E2801'))` is `err` with code `keel.unexpected` and `data.cause` `Defect: E2801 bad key`; an `async` function that calls `defect('x')` returns a promise that rejects with a value `isDefect` accepts.
- With `t` the object `{ code: '23505' }`, `Taken` the KeelError `{ code: 'shop.taken', message: 'shop.taken', data: {} }` and `expect` the function `(x) => (x === t ? Taken : undefined)`: `attempt(() => { throw t }, expect)` is `err(Taken)`, `attempt(async () => { throw t }, expect)` resolves to `err(Taken)`, `attempt(() => 1, expect)` is `ok(1)` and `attempt(async () => 1, expect)` resolves to `ok(1)`.
- With that `expect` and `u` the value `new Error('other')`: `attempt(() => { throw u }, expect)` throws `u` itself and `attempt(async () => { throw u }, expect)` rejects with `u` itself; `attempt(() => defect('x'), spy)` throws that defect and never calls `spy`; `attempt(() => { throw t }, () => { throw w })` throws `w` itself.
- In `modules/m/a.ts`, `try { f() } finally { g() }` is no E1452 and `try { f() } catch { g() } finally { h() }` is one; `defect('x')` (imported from `@keel/schema`) is no E1451 and `throw new Error('x')` is one, message `throw in app code; return err(...) when expected, defect(...) when a bug`.
- In `modules/m/a.ts`, `defect('x', 'E28')`, `defect('x', code)` with `const code = 'E2801'` above it, and `k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` are one E1455 each at the second argument, with no fix; `defect('x')`, `defect('x', 'E2801')` and `` defect(`x ${n}`, 'E2801') `` are none.

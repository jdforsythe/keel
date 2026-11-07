# k.errors: Results and boundaries
status: proposed

**Split.** Expected failures (invalid input, not found, denied, conflict, network) are values: `Result`. Unexpected failures (bugs, broken invariants, throwing libraries) are exceptions caught by the nearest `<Boundary>`. No third way.

**API.**
```ts
import { s, ok, err, attempt, type Result } from '@keel/schema'
export const OrderLocked = s.error('orders.locked', s.object({ id: s.id('Order') })) // in *.schema.ts
function close(o: Order): Result<Order, s.infer<typeof OrderLocked>> {
  return o.locked ? err(OrderLocked.make({ id: o.id })) : ok({ ...o, open: false })
}
const r = close(order)
if (r.ok) use(r.value); else show(r.error.code)
const parsed = await attempt(() => lib.parse(text)) // Result<T, KeelError<'keel.unexpected'>>
```
- `Result<T, E>` is `{ ok: true, value: T } | { ok: false, error: E }`. `ok` and `err` are its only constructors; there are no `map`/`unwrap` helpers: narrow on `r.ok`. `s.result(T, E)` is its schema (codec for loaders, actions, services).
- `KeelError<C, D>` is a plain serializable object `{ code: C, message: string, data: D }`. `code` is a dotted string literal; app codes start with the module id (E1155). `s.error(code, data)` declares one; `.make(data, message?)` builds one (message defaults to the code).
- Kernel codes: `keel.unexpected`, `keel.notFound`, `keel.denied`, `keel.fields` (k.forms), `keel.payloadTooLarge` (k.server), `schema.invalid` (`SchemaError`, data `{ issues: { path, rule }[] }`), `api.*` (k.services). KeelError codes are data; E-codes are diagnostics; they never share a namespace.
- `attempt(fn)` is the only sanctioned catch: it runs `fn` (sync or async) and returns `err` with `keel.unexpected` if it throws or rejects. It never throws.

**Boundaries.**
```tsx
<Boundary fallback={(e, reset) => <Retry error={e} onRetry={reset} />}>
  <OrderPanel id={id} />
</Boundary>
```
`Boundary` (from `@keel/runtime-dom`) catches throws from render, `computed`, `effect`, and event handlers (including rejections of promises they return) anywhere in its subtree. The nearest boundary wins. On catch the subtree's scope is disposed and `fallback` renders with a `KeelError<'keel.unexpected'>` whose `data.at` is the element id where the throw surfaced; `reset()` re-renders the children in a fresh scope. Every route is a boundary whose fallback is its `errorElement`; the app root has a default one. A `resource` fetcher failure is its `error` state, not a throw (k.reactive). A transaction that throws leaves state and log unchanged.

**Rules.** E1451 `throw` in app code (fix: `return err(...)`) · E1452 `try`/`catch` or `.catch()` in app code (fix: `attempt`) · E1453 a `Result` or `Promise<Result>` discarded as an expression statement · E1454 two `s.error` declarations with the same code.

**Conformance.**
- `ok(v)` is `{ ok: true, value: v }`; `err(e)` is `{ ok: false, error: e }`.
- `s.result(T, E)` round-trips every generated ok and err value through its JSON codec.
- `attempt` returns `ok(value)` when `fn` returns, and `err` with code `keel.unexpected` when `fn` throws or its promise rejects; it never throws.
- A throw during a child's render renders the nearest enclosing Boundary's fallback; content outside that boundary is unchanged and no outer fallback renders.
- After a catch, no effect created in the failed subtree runs again.
- `reset()` re-renders the children; if they throw again the fallback renders again with the new error.
- A throwing transaction leaves `snapshot()` and `log()` equal to their values before the call.
- Each of E1451-E1454 has a fixture that triggers it and a clean counterpart.

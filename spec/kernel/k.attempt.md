# k.attempt: Failures in types
status: implemented

**Kinds.** Code meets a failure in one of two forms. An expected failure is a `KeelError` value in a `Result`: a code, typed data, an optional cause. Everything thrown is unexpected: a defect (k.defects), or a throw of the platform or of a plain npm package, which stays unexpected until an `expect` claims it. A failure keeps its identity from where it is made to the owner that reports it: no step turns a throw into a value without naming its code, none nests one `Result` in another, and none turns a code or data into text.

**Values.**
- `KeelError<C, D>` is `{ code: C, message: string, data: D, cause?: KeelError<string, unknown> }`, plain JSON. `Result<T, E>` requires `E extends KeelError<string, unknown>`.
- `err(e)` takes a `KeelError` and nothing else. Any other value (an `Error`, a string, an object without a string `code`, a string `message` and an own `data`) is E1458 at check and, at run time, the defect E1458.
- `X.make(data, message?)` builds one of the error `X = s.error(code, data)`. `X.causedBy(cause, data, message?)` builds one whose `cause` is the `KeelError` `cause`. `X.in(e)` gives the first error with `X`'s code on `e`'s cause chain, `e` first, at most 8 steps, typed as `X`'s, else `undefined`. So a wrapped failure is still the failure it wraps: `Database.in(r.error)?.data.sqlstate === '40P01'` holds three callers above the query, however often the error was wrapped.
- `message` is the developer's text and defaults to the code. What a person or a log is shown is the code and the data, whose schema carries the `.pii()` and `s.secret` marks (k.privacy).

**`attempt(fn, expect)`** (`@keel/schema`) is the one catch. It runs `fn` and settles by what `fn` does; when `fn` returns a promise it settles the same way in a promise.

| `fn` | `attempt(fn, expect)` |
| --- | --- |
| returns `v`, not a keel `Result` | `ok(v)` |
| returns a keel `Result`, one `ok` or `err` made (k.reactive) | that `Result` itself |
| raises a defect, or a value a defect is reachable from through `cause` and `errors` in at most 8 steps | throws it on unchanged; `expect` is not called |
| throws any other value `x` | `expect(x)`: a `KeelError` it returns is the `err`; for `undefined`, `x` itself is thrown on |

- A thrown value is expected only when `expect` says so. A thrown object shaped like a `KeelError` gets no other treatment: a shape claims nothing.
- A throw of `expect` itself is thrown in place of the first.
- `expect` is required: `attempt(fn)` does not compile and is E1452. A call that claimed every throw would turn a bug into a value, and one that claimed none would be no catch.
- `expect` tests what was thrown. One written as a function with no parameter, a `_`-named one or one its body never uses is E1452, `expect claims every throw: test the thrown value`. One that claims by `instanceof Error` alone is R1017 in `keel review` (k.escapes).
- Type: with `fn` returning `V | Result<U, F>` (either part may be absent) and `expect` returning `E | undefined`, the call is `Result<V | U, E | F>`, in a `Promise` when `fn` returns one.

**Wrapping a throwing library.** The failures a library throws become values at one place, the call that wraps it:
```ts
// pay.schema.ts
export const CardDeclined = s.error('pay.declined', s.object({ reason: s.enum(['funds', 'expired', 'other']) }))
// charge.server.ts
const reasonOf = (x: Error): 'funds' | 'expired' | 'other' =>
  Reflect.get(x, 'code') === 'insufficient_funds' ? 'funds' : Reflect.get(x, 'code') === 'expired_card' ? 'expired' : 'other'
export const charge = (p: Charge): Promise<Result<Receipt, s.infer<typeof CardDeclined>>> =>
  attempt(
    () => sdk.charges.create(p),
    (x) => (x instanceof Error && x.name === 'CardError' ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  )
```
A decline is `err` with code `pay.declined`; the SDK's message, which may name the buyer, goes nowhere, since the data's schema has no place for it. Any other throw of the SDK goes on as thrown, to the owner that reports it (k.serverlog Thrown values).

**Throwing built-ins.** These throw on bad input, and an author meets them weekly. Called bare in app code or a library's file, with an argument that is no literal, each is E1457; inside a function given to `attempt` it is none.

| Built-in | Throws | Write |
| --- | --- | --- |
| `JSON.parse(text)` | `SyntaxError` | `S.parseJson(text)`: `Result<s.infer<typeof S>, SchemaError>`, the text read and then parsed as `S.parse` does; a text that is no JSON fails rule `json` at `[]`. `s.json.parseJson(text)` takes any JSON |
| `new URL(text, base?)` | `TypeError` | `URL.parse(text, base)`, and test for `null` |
| `decodeURIComponent`, `decodeURI` | `URIError` | `attempt(fn, expect)` |
| `atob` | `DOMException` | `attempt(fn, expect)` |
| `BigInt(text)` of a string | `SyntaxError` | `attempt(fn, expect)` |

`structuredClone` of a value holding a function or a symbol, destructuring a value that is not iterable and a property read of `null` are decided by types; where a cast hid the type, the throw is a defect.

**A function that throws.** The rule against `throw` (k.errors) names the choice and offers no fix where the choice changes a type (k.fixes). A failure a caller can act on (retry, take another path, tell a person) is declared with `s.error` and returned: the return type becomes `Result<T, E>` (`Promise<Result<void, E>>` for a `Promise<void>`), and each caller then returns it on (`if (!r.ok) return r`) or reads `r.error`, since a discarded `Result` is E1453; the chain ends at an owner that takes a `Result` (a loader, an action, a `Handler`, k.server). A failure no caller can act on is `defect('text')`, and the signature stays.

**Rules.** E1452 (k.errors) also: `attempt` called with one argument, message `attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined`; an `expect` that does not test its parameter · E1457 a bare call of a throwing built-in above, at the callee, message `JSON.parse throws on bad text: use S.parseJson(text)`, `new URL throws on a bad address: use URL.parse(text, base) and test for null`, or `<name> throws on bad input: call it inside attempt(fn, expect)` · E1458 `err` given a value whose type is no `KeelError`, at the argument, message `err takes a KeelError: declare it with s.error(code, data) and pass X.make(data)`. None carries a fix. Each finds its callee as k.unsafe One path says.

**Conformance.**
- With `T` a `KeelError` and `expect` the function `(x) => (x === 0 ? T : undefined)`: `attempt(() => 1, expect)` is `ok(1)`, `attempt(() => ok(1), expect)` deep-equals `ok(1)`, `attempt(() => err(T), expect)` deep-equals `err(T)`, each `async` form resolves to the same, and `attempt(() => ({ ok: true, value: 1 }), expect)` is `ok` of that plain object.
- With `t` the object `{ code: '23505' }`, `Taken` the KeelError `{ code: 'shop.taken', message: 'shop.taken', data: {} }` and `expect` the function `(x) => (x === t ? Taken : undefined)`: `attempt(() => { throw t }, expect)` is `err(Taken)` and `attempt(async () => { throw t }, expect)` resolves to `err(Taken)`.
- With that `expect`, `u` the value `new Error('other')` and `k` the object `{ code: 'a.b', message: 'm', data: null }`: `attempt(() => { throw u }, expect)` throws `u` itself, `attempt(async () => { throw u }, expect)` rejects with `u` itself, `attempt(() => { throw k }, expect)` throws `k` itself, `attempt(() => defect('x'), spy)` throws that defect and never calls `spy`, and `attempt(() => { throw t }, () => { throw w })` throws `w` itself.
- With `d` a defect, `attempt(() => { throw new Error('w', { cause: d }) }, spy)` and `attempt(() => Promise.any([Promise.reject(d)]), spy)` throw or reject with the wrapping value itself and never call `spy`.
- `attempt(() => 1)` does not compile, and called untyped with one argument it throws a value `isDefect(v, 'E1452')` accepts; the type of `attempt(() => (c ? 1 : err(T)), expect)` is `Result<number, typeof T | E>` for `expect` returning `E | undefined`.
- In `modules/m/a.ts`, `attempt(f)` is one E1452, message `attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined`; `attempt(f, () => T)`, `attempt(f, (_x) => T)` and `attempt(f, (x) => T)` are one E1452 each at the function, message `expect claims every throw: test the thrown value`; `attempt(f, (x) => (x instanceof RangeError ? T : undefined))` is none; no E1452 here carries a fix.
- In `modules/m/a.ts`, `err(new Error('x'))`, `err('x')` and `err({ code: 'a.b' })` are one E1458 each at the argument; `err(T)` is none; called untyped, `err('x')` throws a value `isDefect(v, 'E1458')` accepts.
- With `A = s.error('m.a', s.object({ n: s.int() }))` and `B = s.error('m.b', s.object({}))`: `B.causedBy(A.make({ n: 1 }), {})` has `cause` deep-equal to `A.make({ n: 1 })` and round-trips JSON; `A.in` of it is that cause, `A.in(B.make({}))` is `undefined`, and `A.in` of an error whose only `m.a` is 9 steps down is `undefined`.
- In `modules/m/a.ts`, `JSON.parse(t)`, `new URL(t)`, `decodeURIComponent(t)`, `decodeURI(t)`, `atob(t)` and `BigInt(t)` with `t` a `string` are one E1457 each at the callee with the message its row names; `JSON.parse('{}')`, `BigInt(n)` with `n` a `number`, `URL.parse(t)` and `attempt(() => JSON.parse(t), (x) => (x instanceof SyntaxError ? T : undefined))` are none.
- With `S = s.object({ n: s.int() })`: `S.parseJson('{"n":1}')` is `ok({ n: 1 })`, `S.parseJson('{')` is `err` `schema.invalid` whose one issue is `{ path: [], rule: 'json' }`, `S.parseJson('{"n":"x"}')` is `err` with the issues `S.parse({ n: 'x' })` gives, and none of them throws.
- With `sdk.charges.create` rejecting with `Object.assign(new Error('card declined for jane@x.com'), { name: 'CardError', code: 'insufficient_funds' })`, the `charge` of Wrapping a throwing library resolves to `err` with code `pay.declined` and data `{ reason: 'funds' }`, and its JSON holds no `jane`; rejecting with `w`, a `TypeError`, it rejects with `w` itself.

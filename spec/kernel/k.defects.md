# k.defects: Defects
status: implemented

**Defect.** A defect is a failure no caller is meant to handle: a bug in the calling code, a broken invariant, stored state that fails its own shape, or a fault under a contract whose callers handle every rejection alike (a storage driver, k.persist). Code held to the rules raises one only with `defect` (`@keel/schema`), which throws and returns `never`, so it stands where a value is expected (`x ?? defect('no row')`). Where a section says app or library code throws or rejects, it raises a defect; an `async` function's rejects.

**API.**
```ts
defect(message)
defect(message, { data: { rows: rows.length }, cause: r.error })
defect(message, 'E2801', { data: { id, key } })
```
- `message` is a string literal or a template with no substitution: the code's own words, never a value (E1455). So a message cannot carry what a person gave, and equal defects have equal messages.
- `code`, when given, is a literal `E` and four digits, the section's that names the throw.
- The detail is an object literal in the call. `data` is a plain JSON object of the values that explain the defect; `cause` is the failure that led here: a `Result`'s error or a thrown value.
- The thrown value is an `Error` named `Defect`. Its `message` is `message`, or `<code> <message>` with a code. `code` and `data`, when given, are own non-enumerable properties; `cause` is the platform's.
- `isDefect(x, code?)` is true of a value `defect` made, with `code` of one made with that code. The identity is the kernel's (k.identity): an `Error` named `Defect` by hand, or one given a `code`, is none. A copy made by `structuredClone`, `postMessage` or JSON is none; its receiver raises `defect` again where it still is one.

**Where it goes.** Where any throw goes, with nothing added: the nearest `Boundary` (`keel.unexpected`, k.errors), the server's answer and log record (k.serverlog Thrown values), a failed test, a failed `simulate` run. `attempt` passes it on unseen by `expect` (k.attempt). Supervised work's defect is reported as a defect, once, and then its supervisor's failure path runs (k.supervise): it is never turned into a value in silence, and it never ends the process. The message and the data are for a developer. Under `mode: 'dev'` a page shows a defect's code, class and text (`Defect: E2801 bad key`); in production no response body holds the class, the fingerprint or the text, and no log record holds the message or the data (k.serverlog Thrown values).

**On a failed `Result`.** A defect raised where a `Result` is known not ok turns an expected failure into a bug. Some are right (a driver whose callers handle every rejection alike), so `keel review` lists each (R1013, k.escapes) and check asks one thing: the error is passed as `cause`, so the owner's record names its code. `if (!r.ok) defect('store did not open', 'E2153', { cause: r.error })`.

**In `finally`.** A `defect` call in a `finally` block, outside a function nested in it, is E1452: it would replace the throw in flight (k.errors).

**Tests.** A test asserts a defect with `isDefect(caught, code?)` or `toThrow` on its message, never by its `name`; its values with `caught.data`.

**Rules.** E1455 a call of `defect` whose first argument is not a string literal or a template without substitutions, at that argument, message `defect message is not a literal: pass values as data, defect('text', { data })`; whose code argument is not a string literal of `E` and four digits, at that argument, message `defect code is not a literal E and four digits`; or whose detail is not an object literal, at it, message `defect detail is not an object literal`. Also a `defect` call with no `cause` where a `Result` named `r` is known not ok, at the call, message `defect on a failed Result: pass { cause: r.error }`, with the fix k.fixes names. The second argument is the detail when it is an object literal, else the code; a third is the detail. No other fix. Through `call`, `apply`, `bind` and `Reflect.apply`: k.unsafe One path.

**Conformance.**
- `defect('no row')` throws a value `v` with `v instanceof Error`, `v.name` `Defect`, `v.message` `no row`, no own `code` or `data` property, and `isDefect(v)` true; `defect('bad key', 'E2801', { data: { key: 'a b' } })` throws one with `message` `E2801 bad key`, own `code` `E2801`, own `data` deep-equal to `{ key: 'a b' }`, `Object.keys(v)` empty, `isDefect(v, 'E2801')` true and `isDefect(v, 'E2802')` false.
- `isDefect(new Error('x'))`, `isDefect(Object.assign(new Error('x'), { name: 'Defect', code: 'E2801' }))`, `isDefect('x')` and `isDefect` of an object given every own key of a defect, symbol keys among them, by `Reflect.ownKeys` and `Object.defineProperty`, are false.
- `defect('x', { cause: c })` throws a value whose `cause` is `c` itself, for `c` a `KeelError` and for `c` an `Error`; an `async` function that calls `defect('x')` returns a promise that rejects with a value `isDefect` accepts.
- For `v` a value made by `defect('x', 'E2801')`, `structuredClone(v)` and the value a worker receives by `postMessage(v)` are not `isDefect`; a second copy of `@keel/schema` does not load beside the first (k.realm).
- In `modules/m/a.ts`, `` defect(`no row ${n}`) ``, `defect(text)` with `const text = 'x'` above it and `defect('a' + b)` are one E1455 each at the first argument, message `defect message is not a literal: pass values as data, defect('text', { data })`, with no fix; `defect('x')`, `` defect(`x`) ``, `defect('x', { data: { n } })` and `defect('x', 'E2801', { cause: e })` are none.
- In `modules/m/a.ts`, `defect('x', 'E28')`, `defect('x', code)` with `const code = 'E2801'` above it, and `k.defect('x', 'e2801')` under `import * as k from '@keel/schema'` are one E1455 each at the second argument, message `defect code is not a literal E and four digits`; `defect('x', 'E2801', detail)` with `detail` a name is one at `detail`, message `defect detail is not an object literal`.
- In `modules/m/a.ts`, `try { f() } finally { defect('x') }` is one E1452 at the call, message `defect in finally drops the throw in flight`; `try { f() } finally { g(() => defect('x')) }` is none.
- In `modules/m/a.ts`, `if (!r.ok) defect('x')` with `r` a `Result` is one E1455 at the call, message `defect on a failed Result: pass { cause: r.error }`, with a fix that adds `{ cause: r.error }` as the detail; `if (!r.ok) defect('x', { cause: r.error })` is none.

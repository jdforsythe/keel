# k.expect: What `expect` claims and an error carries
status: conformance-covered

**Purpose.** A thrown value becomes a value at `attempt`'s `expect` (k.attempt), and that value then travels to callers, a response and a log. Two things can go wrong there while every type holds: an `expect` can claim every throw while it seems to test, and it can copy the thrown value's text into the error. This section says what an `expect` does with its parameter, what an error may be built from, and where code that must take every throw goes (k.supervise).

**Made errors.** In app code and a library's files a `KeelError` is made by `X.make` or `X.causedBy` of an `s.error` (k.attempt) and in no other way: an object literal where a `KeelError` is expected is E1458. The kernel's codes an author returns have their schemas in `keelError` (`@keel/schema`): `keelError.denied`, `keelError.notFound`, `keelError.unreachable` and `keelError.busy`, each with data `{}`; `keelError.conflict`, whose data may name the `transaction` refused and the `head` it met, as an outbox reads a 409 (std.offline); and `keelError.fields`, whose data maps a field path to its message (k.forms). `keel.unexpected` and `keel.payloadTooLarge` are the kernel's to make.
```ts
return bearer === undefined && user === '' ? err(keelError.denied.make({})) : ok(null)
```

**Message.** The `message` argument of `make` and `causedBy` is a string literal or a template with no substitution (E1460): the code's own words. A value goes in `data`, whose schema says what it is.

**Marked values.** A `.pii()` or `s.secret` value keeps its protection inside an error. The message holds none, being a literal. In `data` a value under a mark of the schema `s.error` declared is treated by that mark at every sink (k.privacy Sinks), and a `Secret` never serializes. Types carry no mark, so check cannot tell that a string came from a marked field. A marked value put at an unmarked node of `data` is found only by value, where a sink reads text for the values its scope declared (k.privacy Copies, std.sessions): the log's full-text record and a session's recorded error. Not held: such a value in a response, which carries `data` as its schema encodes it.

**Readable.** The `expect` of an `attempt` call is a function check can read: an arrow function or function expression written as the argument, or a name that resolves by symbol to a function declaration, or to a `const` bound to an arrow function or function expression, in a file of the project or of the library the call is in. Any other argument is E1452 at the argument. A function read by name is judged as if written in the call and reported at the argument.

**Decides.** In an `expect` with parameter `x`, an expression *reads the thrown value* when it is `x`, a property of one that does (`x.p`, `x['p']`, `Reflect.get(x, 'p')`), `typeof` of one, or a `const` of the function whose initializer does. A *test* is one of:
- `v instanceof C`, `v` reading the thrown value;
- `a === b` or `a !== b` where one side reads the thrown value and the other holds no mention of `x`;
- a call that takes an expression reading the thrown value as an argument and whose return type is `boolean` or a type predicate;
- `S.parse(v).ok`, `v` reading the thrown value;
- `!t`, `t && e`, `e && t` and `t || u` for tests `t` and `u` and any expression `e`.

The `expect` claims by a test or it is E1452:
1. Its return type holds `undefined`.
2. Each value it returns that is not `undefined`, read through `?:`, `&&`, `||`, `??` and parentheses, stands in the branch of a `?:` or an `if` whose condition is a test.

So `(x) => (void x, T)`, `(x) => T.make({}, typeof x)` and a function that returns an error on every path fail 1, and `(x) => (x === x ? T : undefined)` and `(x) => (x ? T : undefined)` fail 2. Check cannot prove a test narrow: `x instanceof Object`, `typeof x !== 'bigint'`, `x !== 1`, an error returned where a test fails (`x instanceof C ? undefined : T`) and a call of a function true of every value each pass and claim nearly every throw. `keel review` lists those (R1017, k.escapes).

**Carries.** What an `expect` returns is `undefined`; an expression that does not read the thrown value; or `X.make(data)` or `X.causedBy(cause, data)` written in it. In that `data`, read through object and array literals, each property value or element that reads the thrown value is a *copy*, and:
- a copy's type is `number`, `boolean` or a union of literal types. A status, a count, a flag and a closed code cross; text does not. A library's open `code: string` crosses as the error's own closed set, by a function that returns a literal union (`reasonOf`, k.attempt) or by `S.parse(v)` narrowed on `ok`, whose `value` is a copy of the type `S` infers;
- a copy holds no read of `message`, `stack`, `cause` or `errors`, and no `String(…)`, `toString()`, `JSON.stringify(…)`, template or `+`.
Anything else is E1460. Not held: a function a copy calls that reads the thrown value's text and returns a number.

**Rules.**
- E1452 (k.errors) also: an `expect` check cannot read, message `expect is not readable here: write the function in the call`; an `expect` that fails Decides, message `expect claims every throw: test the thrown value`. No fix.
- E1458 (k.attempt) also: an object literal whose contextual type is a `KeelError`, at the literal, message `KeelError written by hand: declare it with s.error and pass X.make(data)`. No fix.
- E1460 text that is not the code's own in an error. A `message` argument of `make` or `causedBy` that is no literal, at the argument: `error message is not a literal: pass values as data`. A copy of another type, or one holding a read or call Carries refuses, at the copy: `expect copies thrown text: carry a number, a boolean or a closed code`. A returned expression that reads the thrown value and is no `make` or `causedBy` call, at it: `expect builds its error from the thrown value: return X.make(data)`. No fix.
Each finds its callee as k.unsafe One path says.

**Conformance.**
- In `modules/m/a.ts`, with `E = s.error('m.t', s.object({}))` and `T = E.make({})`: `attempt(f, (x) => (void x, T))`, `attempt(f, (x) => (x === x ? T : undefined))`, `attempt(f, (x) => (x ? T : undefined))`, `attempt(f, (x) => E.make({}, typeof x))`, and `attempt(f, taken)` with `taken` imported from `./taken.ts` holding `export const taken = (_x: unknown) => T` are one E1452 each at the second argument, message `expect claims every throw: test the thrown value`, with no fix.
- There, `attempt(f, (x) => (x instanceof RangeError ? T : undefined))`, `attempt(f, (x) => (typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505' ? T : undefined))`, `attempt(f, (x) => (x !== stop ? undefined : T))` with `stop` a `const` above it, `attempt(f, (x) => (isUnique(x) ? T : undefined))` with `isUnique` typed `(x: unknown) => boolean`, `attempt(f, (x) => { if (x instanceof TypeError) return T; return undefined })`, and `attempt(f, named)` with `const named = (x: unknown) => (x instanceof RangeError ? T : undefined)` in `./named.ts` are no E1452.
- There, `attempt(f, opts.expect)` with `opts` a parameter, `attempt(f, pick())` and `attempt(f, lib.expect)` with `lib` a namespace import of a package that is no library are one E1452 each at the second argument, message `expect is not readable here: write the function in the call`.
- There, with `W = s.error('m.w', s.object({ why: s.string() }))` and `N = s.error('m.n', s.object({ status: s.int(), kind: s.enum(['a', 'b']) }))`: `attempt(f, (x) => (x instanceof Error ? W.make({ why: x.message }) : undefined))`, the same with `why: String(x)`, with `` why: `${x}` `` and with `why: x.name` are one E1460 each at the property's value, message `expect copies thrown text: carry a number, a boolean or a closed code`; `attempt(f, (x) => (x instanceof Error ? build(x) : undefined))` with `build` returning a `KeelError` is one at `build(x)`, message `expect builds its error from the thrown value: return X.make(data)`.
- There, `attempt(f, (x) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined))` with `class HttpError extends Error { status = 0 }` in the file and `kindOf` returning `'a' | 'b'` is no E1460, and resolves to `err` whose data is `{ status: 503, kind: 'a' }` for a thrown `HttpError` with `status` 503 that `kindOf` maps to `'a'`.
- There, `` E.make({}, `user ${email}`) ``, `E.make({}, text)` with `text` a `const` and `E.causedBy(c, {}, 'a' + b)` are one E1460 each at the message argument, message `error message is not a literal: pass values as data`; `E.make({}, 'sign in')` and `` E.make({}, `sign in`) `` are none.
- There, `err({ code: 'keel.denied', message: 'sign in', data: null })` and `const t: KeelError<'m.t', null> = { code: 'm.t', message: 'm.t', data: null }` are one E1458 each at the object literal, message `KeelError written by hand: declare it with s.error and pass X.make(data)`; `err(keelError.denied.make({}))` is none.
- `keelError.denied.make({})` deep-equals `{ code: 'keel.denied', message: 'keel.denied', data: {} }`; `notFound`, `conflict`, `unreachable` and `busy` give their codes the same way; `keelError.fields.make({ 'address.city': 'Taken' })` has code `keel.fields` and that data; a guard returning `err(keelError.denied.make({}))` on a node server answers 403, and an action returning that `fields` error answers 422.

# k.reveal: Revealed values
status: conformance-covered

**Purpose.** What `reveal` returns is plain data (k.privacy Secrets). E1112 reads one file by syntax and reports a revealed value that reaches a log, storage, a file, store state or a throw through bindings, literals, operators, members, methods, and the standard conversions and encodings; a call to anything else ends it.

**Sinks.** An argument of: `tx` or `store` (`@keel/store`); `set` or `commit` on `ctx.storage`; a `console` method; `process.stdout.write` or `process.stderr.write`; `writeFile`, `appendFile` or `write` (or `Sync`) from `node:fs` or `node:fs/promises`; a global whose name ends in `Error`, called or constructed; `Promise.reject`. Also the value thrown. A sink counts under any local name or `.bind()`. `ctx.storage` is a `.storage` member, a local destructured or assigned from one, or a parameter named `storage`.

**Flow.** A value carries one when it is:
- a call of `reveal` (the `@keel/schema` import, `<namespace>.reveal`, or a local bound to either);
- a local any value given to it carries: initializer, assignment, `for...of` head, member write (`o.k = v`), or argument of its `push`, `unshift`, `set`, `add`, `append` or of `Object.assign`. A read after a `name = value` statement in an enclosing block sees only that value and later ones;
- a spread, object or array literal, template, or operator other than a test with one inside; `?:`; `await`; the right side of `&&`;
- a member of one other than `length` and `size`; of an object literal or a local, only the field it names (a destructured key alike);
- a method called on one other than `includes`, `startsWith`, `endsWith`, `indexOf` and `has`; `concat`, `replace`, `replaceAll`, `padStart` or `padEnd` given one;
- `String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Object.assign`, `Object.values`, `Object.entries`, `btoa`, `encodeURI`, `encodeURIComponent` or `Buffer.from` of one.

Any other call, a parameter and an import end it (a hash passes; a helper is not read).

**Rules.** E1112 a value `reveal` returns reaching a sink, in app code (no fix): one finding per sink, at the first carrying argument.

**Conformance.**
- In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none.
- Each sink above, and each carrier above wrapped 1 to 4 deep, is one E1112; the same under one local call is none.
- `reveal(p.k).length`, `.startsWith('a')`, `reveal(p.k) && y`, `o.b` of `{ a: reveal(p.k), b: 1 }`, a `let` reassigned to a hash, and `set` on a `new Map()` named `storage` are none.

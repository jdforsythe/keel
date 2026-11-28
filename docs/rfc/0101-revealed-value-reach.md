# RFC 0101: revealed-value reach (E1112 sinks, flow and the `[secret]` log scrub)

Status: implemented (ADR-0124)

## Decisions
- D1: E1112 stays a one-file syntax rule, and it reaches every miss a reader of that one file can see. New sinks: `process.stdout.write`, `process.stderr.write`, the `node:fs` writes, `Promise.reject` and the value of a `throw`. A sink counts under any local name or `.bind()`. New flow steps: `for...of`, a member write, `push`-style mutation, `Object.assign`, an alias of `reveal`, a renamed `ctx.storage`, and the closed list of conversions and encodings in D2. Helpers, callbacks, imports and a payload field's schema need a second function, a second file or types, so they stay Known limits. The rule is one sentence for an app author: a revealed value that reaches a log, storage, a file, store state or a throw, through bindings, literals, operators, members, methods and the standard conversions and encodings, is reported, and a call to anything else ends it (defaults 4, 6).
- D2: the unknown-call rule flips for one closed list of standard functions whose result holds the argument: `String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Object.assign`, `Object.values`, `Object.entries`, `btoa`, `encodeURI`, `encodeURIComponent` and `Buffer.from`. An encoding can be reversed, so it carries the value; a hash cannot be reversed, and it still passes. Any call off the list still ends the flow (default 4: what lands in a log or a file is redacted; a base64 secret is the secret).
- D3: results that cannot hold the value end the flow: a `length` or `size`, a method from the closed list `includes`, `startsWith`, `endsWith`, `indexOf`, `has`, a comparison, and the left side of `&&`. A member of an object literal or a local reads only the field it names. `ctx.storage` is matched by where it came from, so an app object named `storage` is no sink. A `name = value` statement in an enclosing block replaces what a later read sees. A revealed value in a payload field that is `s.secret` is still reported: telling it apart needs the transaction's schema, often in another file, and passing the `Secret` itself is the better form (defaults 2, 6).
- D4: `throw reveal(k)` gets both answers. E1112 reports the thrown value, and the server replaces the revealed value of each `Secret` in the decoded action input with `[secret]` in every `diag` record of the request, as it replaces `.pii()` values with `[pii]`. Today the thrown string is the `keel.unexpected` cause, written verbatim to the log line in dev and production (Problem). The threat model says secrets never persist and logs are redacted (defaults 4, 6). The runtime half reaches what no syntax rule can: a throw through a helper or an import.
- D5: E1112's sinks and flow move to a new section, k.reveal (706 tokens). k.privacy keeps a one-line E1112 entry pointing there and drops from 1,464 to 1,361 tokens with the runtime sentence and its conformance case added. `spec/00-map.md` gains the row and pays for it with four trims, staying at 1,200 (default 2: one section owns the rule).
- D6: `@keel/check` measured 51,901 to 53,459 B gzip on the prototype; re-base `51kb` to `53kb` (54,272), 813 B of room (default 7). `@keel/server` grows about 100 B of its 221 B of room, so no re-base; re-base to `20.5kb` if the lane measures past the limit (default 7).

No new code. E1112 keeps its code, message and explain text; `see` becomes `k.reveal`.

## Problem
Measured on `jdforsythe/test-impl` at `9a1cc697`, reading `packages/check/src/rules/revealedValue.ts` and `packages/check/src/internal/givenValues.ts`.

**Misses.** The rule matches a fixed set of sink callees and follows a value through a fixed set of expression forms. Each of these has no finding:
- `process.stdout.write(v)` and `process.stderr.write(v)`: `sinkOf` knows `console.*` (path length 2) and globals ending in `Error` (length 1) only.
- `'x'.concat(v)`: a method carries only through its receiver (`next(e.callee.object)`), never an argument.
- `for (const v of [reveal(k)])`: `givenValues` reads declarator initializers and assignments, not a `for...of` head.
- `const open = reveal; open(k)`: `isReveal` matches the import name or `<namespace>.reveal` only.
- `const log = console.log.bind(console)`: `globalRefs` resolves `console.log` through a `const`, but a `.bind()` call is no alias.
- `throw reveal(k)`: a `throw` is no sink, and `throw new Error(v)` is reported only because `Error` is.
- `o.k = reveal(x)` and `arr.push(reveal(x))`, later passed to a sink: a member write and a mutating method give the local nothing.
- `const st = ctx.storage` and `const { storage: s } = ctx`: the `storage` sink is matched by the receiver's name, so a new name escapes it.
- `new String(v)` and ``String.raw`${v}` ``: `KEEPS` is read for a `CallExpression` only.
- `structuredClone(v)`, `btoa(v)`, `encodeURIComponent(v)`, `Buffer.from(v).toString('base64')`: any call off `KEEPS` ends the flow, so a reversible encoding passes like a hash.
- `writeFileSync(f, v)` and the other `node:fs` writes: not sinks.
- A helper (`const enc = (x) => btoa(x)`), a callback parameter and an import end the flow by design.

**What `throw reveal(k)` does today.** `caught` (`packages/server/src/internal/caught.ts`) rethrows into `attempt`, and `toUnexpected` (`packages/schema/src/internal/toUnexpected.ts`) makes the cause: an `Error` gives `name: message`, a string is the cause as is, any other value is `JSON.stringify`'d. `runAction` builds the diag `action <id> threw: <cause>` after `scrubbedCause(ran.error, rq.pii)`, and `createApp.ts:204-205` scrubs each diag's message and frames with `rq.pii`. `rq.pii` holds `piiValues` of the encoded input, where a `Secret` encodes as `"[secret]"`, so the revealed value is in no scrub set. The log line holds the secret verbatim in dev and production. The production response drops it (`publicError` gives `"unexpected"`); the dev response and dev panel show the clipped message. `throw { token: reveal(k) }` logs the JSON with the value. `throw new Error(reveal(k))` is E1112 today, but the same through a helper in another file logs the value too.

**False positives.** Each of these is reported today and cannot write the value anywhere:
- `reveal(x).length`: a member of a carrying value carries.
- `reveal(x).startsWith('sk_')`, `.includes(':')`, `.endsWith('=')`: a method on a carrying value carries.
- `const ok = reveal(x) && y`: `&&` carries both sides, and its result is `y` or a falsy value.
- `let d = reveal(x); d = hash(d)`: every value given to a local counts, in any order.
- `o.name` of `{ token: reveal(x), name: 'n' }`, and `const { name } = ...` of the same literal: a member or destructured key reads the whole object.
- `const storage = new Map(); storage.set('k', v)`: any receiver named `storage` is a sink.
- `tx(login, { k: reveal(p.k) })` where `k` is `s.secret`: the store wraps it again and `snapshot()` folds it out. The rule does not read the payload schema.

## Proposal

### D1. One file, by syntax; where the line is
The rule reads the file it reports on and nothing else: no types, no other file, no body of a function the value is passed into. Inside that file it follows every form an author reads as "the same value". The line is the call: a value passed into a function the rule does not know is gone, unless the function is on D2's list. That is what makes it predictable. An author can tell from the call site whether a finding fires without opening another file.

New sinks, each matched by `globalRefs`, an import binding, or the receiver's origin:
- `process.stdout.write`, `process.stderr.write`: resolved paths, as `console.*` is.
- `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`, `write`, `writeSync`: a named import from `node:fs`, `fs`, `node:fs/promises` or `fs/promises`, or a member of a default or namespace import of one (`fs.writeFileSync`, `fs.promises.writeFile`).
- `Promise.reject`: a resolved path.
- `throw`: the thrown expression, reported with sink `throw`. `throw new Error(v)` stays one finding, at `Error`, since a `new` of anything off D2's list does not carry.
- A callee that is a local whose value is a sink, or `.bind()` of a sink, is that sink. `globalRefs` already resolves `const log = console.log` and `const { log } = console`.
- `ctx.storage` by origin: a `.storage` member; a local destructured from key `storage` at any depth (`const { storage: s } = ctx`, `({ storage }) =>`); a local whose value is one of those (`const st = ctx.storage`); or a parameter or local with no value, named `storage`.

New flow steps:
- A `for...of` head binding is given the iterated expression.
- A member write `o.k = v` (any depth, any key) gives `o` the field `k` with `v`. A computed key gives an unnamed field, read by any member.
- `push`, `unshift`, `set`, `add` and `append` called on a local give it each argument; `Object.assign(o, ...)` gives `o` each source.
- A local whose value is `reveal` (or `<namespace>.reveal`) is `reveal`.
- `concat`, `replace`, `replaceAll`, `padStart` and `padEnd` carry an argument as well as their receiver.

Not followed, by the one-file line (Known limits): a parameter, including a callback's (`arr.forEach((v) => ...)`), a same-file helper's body, an import, a class field or `this.x`, a stream's `.write`, and a sink called through `.call`, `.apply` or `Reflect.apply`.

### D2. Conversions and encodings carry
`KEEPS` becomes the closed list above, and any argument of a listed call carries. `new String(v)` and the `String.raw` tag count. `Buffer.from(v).toString('base64')` carries through `Buffer.from` and then the method on its result. `createHash('sha256').update(v).digest('hex')` still passes: `update` is a method of a value that carries nothing, off the `concat` list, so its argument ends there. `scryptSync(v, salt, 64)` passes as any call does. The list is part of the spec, so adding an entry is a spec change with a conformance case. Rejected as a rule: "every call carries unless it is a known hash", since the set of hashes and ciphers an app can import is open and the documented form would depend on the list.

### D3. Results that cannot hold the value
- `length`, `size`: a member with one of these names, read off a value that is not an object literal or a local with named fields, ends the flow.
- `includes`, `startsWith`, `endsWith`, `indexOf`, `has`: a method with one of these names ends it. Each returns a boolean or a position.
- `&&` carries its right side only. Its result is the right side, or a falsy left side (`""`, `0`, `null`), which holds no secret.
- Field reads: a member of an object literal, or of a local given an object literal or field writes, carries only when that field carries (a spread or a computed key counts as every field). A destructured key reads the same way. So `o.name` passes and `o.token` and `o` are reported.
- Reassignment: a read after a `name = value` expression statement that stands in a block enclosing the read sees that value and later ones. An assignment inside a branch or a loop body the read is not in kills nothing, so `if (on) d = hash(d)` is still reported. Field writes and mutations are never killed.
- `ctx.storage` by origin (D1) removes the `new Map()` named `storage`.
- Kept: a revealed value into an `s.secret` payload field. Reading the schema needs the transaction, usually imported, and a rule that fires or not depending on another file is the unpredictable kind D1 rules out. The fix the explain text names, passing the `Secret`, is the one an author should write anyway.

### D4. `throw`, and the log line
Check half: D1's `throw` sink. Runtime half: `@keel/schema/internal` gains `secretValues(value)`, each `Secret` under a decoded value revealed and given as a string (a number as `String()`), the surface the server reads next to `secretPathOf`. `runAction` adds `secretValues(decoded.value)` to a request set `rq.secrets`. `scrubbedCause` and the diag write at `createApp.ts:204-205` replace each of them with `[secret]` in every written form `scrubbed` already matches (as is, `encodeURIComponent`, JSON escaping, base64), after the `[pii]` pass. The dev response and dev panel take the scrubbed cause as they do now.

The runtime half covers the throw that syntax cannot see: a helper in another file that builds an `Error` from its argument, a `JSON.stringify` of a payload a library throws. It does not cover `console`, a file or storage, which the server never sees, and it covers only secrets in the request's own action input. That is where a `Secret` comes from today: no ctx accessor yields one (RFC 0100 Questions 2), and job inputs, channel messages and outbox bodies refuse one.

### D5. Spec placement
k.privacy has 36 tokens of room and E1112's text grows by about 600. A new section holds it whole: purpose, sinks, flow, rule, conformance. k.privacy's Rules line names E1112 and points there, the server's `[secret]` scrub joins the Server log sink, and its conformance case joins k.privacy Conformance. The map row costs 15 tokens and four trims pay for it (Spec diff).

### Prototype
A scratch rule (`proto.ts`, a drop-in for `revealedValue.ts` over the same imports) ran once over 80 listed cases and over every carrier triple of the existing property (11 x 11 x 3 = 363 wrappings of `reveal(p.k)` and of `hash(reveal(p.k))`). All 363 triples give one finding over `reveal` and none over the hash. "Before" is the current rule on the same text.

| Case | Before | After | Why |
| --- | --- | --- | --- |
| The existing cases: 30 of the first `describe`'s 31 (the `copy` case read by hand), each console method | as specified | same | unchanged verdicts |
| `process.stdout.write(v)`, `process.stderr.write(v)` | 0 | 1 | new sinks |
| `ctx.storage.set('k', 'x'.concat(v))` | 0 | 1 | `concat` carries an argument |
| `for (const x of [v]) ctx.storage.set('k', x)` | 0 | 1 | `for...of` head |
| `const open = reveal; console.log(open(p.k))` | 0 | 1 | alias of `reveal` |
| `const log = console.log; log(v)`, `console['log'](v)` | 1 | 1 | `globalRefs` already |
| `const log = console.log.bind(console); log(v)` | 0 | 1 | `.bind()` of a sink |
| `throw v`, `throw { t: v }`, `Promise.reject(v)` | 0 | 1 | new sinks |
| `o.k = v` then `JSON.stringify(o)` to storage | 0 | 1 | member write |
| `a.push(v)` then `console.log(a)` | 0 | 1 | mutation |
| `const st = ctx.storage`, `const { storage: s } = ctx` | 0 | 1 | storage by origin |
| `({ storage }) => storage.set(...)` | 1 | 1 | parameter named `storage` |
| `new String(v)`, ``String.raw`${v}` ``, `structuredClone({ k: v })` | 0 | 1 | conversion list |
| `writeFileSync`, `fs.writeFileSync`, `writeFile` (`node:fs/promises`), `appendFileSync` | 0 | 1 | `node:fs` writes |
| `btoa(v)`, `Buffer.from(v).toString('base64')`, `encodeURIComponent(v)` | 0 | 1 | encoding list |
| `const enc = (x) => btoa(x); enc(v)` | 0 | 0 | limit: helper body |
| `[v].forEach((x) => ctx.storage.set('k', x))` | 0 | 0 | limit: callback parameter |
| `wrap(v)` imported | 0 | 0 | limit: import |
| `createWriteStream(f).write(v)` | 0 | 0 | limit: stream |
| `new TextEncoder().encode(v)` | 0 | 0 | limit: method argument off the list |
| `createHash('sha256').update(v).digest('hex')`, `scryptSync(v, 's', 64)` | 0 | 0 | a hash passes |
| `v.length`, `.startsWith('sk_')`, `.includes(':')`, `.endsWith('=')` | 1 | 0 | cannot hold the value |
| `const ok = v && p.on` | 1 | 0 | `&&` right side |
| `v \|\| 'none'` | 1 | 1 | `\|\|` keeps the left side |
| `let d = v; d = hash(d)` | 1 | 0 | reassignment |
| `let d = v; if (p.on) d = hash(d)` | 1 | 1 | a branch kills nothing |
| `o.name`, `const { name } =` of `{ token: v, name: 'n' }` | 1 | 0 | field reads |
| `o.token` of the same | 1 | 1 | the field holds it |
| `o.token = v` then `o.name` | 0 | 0 | field write, other field |
| `const storage = new Map(); storage.set('k', v)` | 1 | 0 | storage by origin |
| `tx(login, { k: v })`, `k` an `s.secret` field | 1 | 1 | kept (D3) |

`v` is `reveal(p.k)`. The prototype is a scratch file outside the repo; the check lane writes the rule from this RFC.

## Alternatives
- Keep the rule as is and document the misses. Rejected: `throw reveal(k)` and `btoa(v)` are ordinary code that writes a secret into a log, and default 6 prefers a guard to a document.
- Follow values into same-file helpers. Rejected: whether a finding fires would depend on the body of a function the author may not be looking at, and the explanation stops being one sentence. The runtime scrub covers the throw case.
- Read types (`types: true`) to follow parameters and payload schemas. Rejected for now: `keel check` runs without types by default, and a rule that fires differently by mode is two rules (Questions 4).
- Flip the unknown-call rule entirely: every call carries unless it is a known hash. Rejected (D2).
- Runtime only: scrub `[secret]` and drop the `throw` sink. Rejected: secrets not from the action input are missed, and `console` and file writes never reach the server.
- Check only: no runtime scrub. Rejected: a throw through a helper or an import still writes the value into a log line (default 4).
- A runtime registry of every value `reveal` returns. Rejected again for RFC 0100's reasons: one request's `reveal` would decide another's log (PRINCIPLES 2), and short values collide. The scrub set here is the request's own input.
- Fit E1112 into k.privacy by trimming other sentences. Rejected: about 560 tokens would have to come out of Secrets, Personal data and Sinks, which five conformance suites quote.

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on scratch copies of `spec/` at `9a1cc697`.

### k.privacy (1,464 to 1,361)
**Rules**, the text " · E1112 a value `reveal` returns reaching an argument of `tx` or `store` (`@keel/store`), `set` or `commit` on a `storage`, a `console` method or an `Error` constructor, in app code (no fix). It is followed by lexical scope through same-file bindings (each value given), members, spreads, literals, templates, operators, `await`, `String()`, `JSON.stringify()` and methods called on it; any other call, a parameter and an import end it (a hash passes; a helper is not read).", replacement text:

> · E1112 a revealed value reaching a log, storage, a file, store state or a throw (k.reveal).

**Sinks**, the Server log bullet, appended after "is replaced by `[pii]` in the message and in each of its `frames`.":

> The revealed value of each `Secret` in the decoded action input is replaced by `[secret]` the same way.

**Conformance**, the E1112 bullet removed (it moves to k.reveal unchanged), and appended:

> - An action throwing the revealed value of a `Secret` input, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production.

Before 5,855 chars (1,464); after 5,442 chars (1,361).

### k.reveal (new, 706)
New file `spec/kernel/k.reveal.md`, 2,823 chars:

```md
# k.reveal: Revealed values
status: proposed

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
```

### spec/00-map.md (1,200 to 1,200)
Adding the row and the owner costs 60 chars (4,799 to 4,859, 1,215 tokens). Four trims pay 61:
- Line 3, "Budget: this file <= 1,200 tokens; each section <= 1,500. Retrieve with `pnpm spec <id>`." becomes "Budget: this file <= 1,200 tokens; a section <= 1,500." The code ranges line names `pnpm spec --for`, and CLAUDE.md names `pnpm spec <topic>`. That is two trims in one line.
- k.topology one line, "placement, routes, runners, peers, `keel dev`" becomes "placement, routes, runners, peers".
- k.deploy one line, "`server.mjs`, `storage`, deploy files" becomes "`server.mjs`, `storage`" (the section title says deploy files).

Additions:
- Code ranges, "| E110x | k.schema, k.privacy |" becomes "| E110x | k.schema, k.privacy, k.reveal |".
- Kernel, after the k.privacy row: `| k.reveal | Revealed values | proposed | E1112 |`.

Before 4,799 chars (1,200); after 4,798 chars (1,200).

### Unchanged
k.server (1,497): the Server log sink lives in k.privacy, and k.server points there. k.check, k.schema, k.store, k.persist, std.db. std.db On disk cites E1112 and k.privacy, which still names it.

## Conformance diff
Written by the `conformance-writer` from k.reveal and the k.privacy sentences above, without the implementation. This RFC allows these changes under `packages/*/conformance/**`.

**`packages/check/conformance/privacy-e1112.test.ts`**, headers, new text:
1. `// Spec: k.reveal, Rules "E1112 a value `reveal` returns reaching a sink, in app code (no fix): one finding per sink, at the first carrying argument."`
2. `// Spec: k.reveal, Flow "A value carries one when it is:" (each item) and "Any other call, a parameter and an import end it (a hash passes; a helper is not read)."`
3. `// Spec: k.reveal, Conformance "In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none."`
4. New: `// Spec: k.reveal, Sinks (each sentence) and Conformance "Each sink above, and each carrier above wrapped 1 to 4 deep, is one E1112; the same under one local call is none."`
5. New: `// Spec: k.reveal, Conformance "`reveal(p.k).length`, `.startsWith('a')`, `reveal(p.k) && y`, `o.b` of `{ a: reveal(p.k), b: 1 }`, a `let` reassigned to a hash, and `set` on a `new Map()` named `storage` are none."`

Changed cases:
- "reports `tx(t, { v: reveal(p.k) })` once": `see` is `"k.reveal"`.
- The 30 other cases of the first `describe` and both carrier properties keep their verdicts: the prototype gives each the count the current rule gives, the `copy` case by reading (it is the first case with another store name).

New cases, each one action body in `modules/app/x.server.ts` under the file's `HEAD`, one E1112 at the line named:
- Sinks: `process.stdout.write(reveal(p.k))`; `process.stderr.write(reveal(p.k))`; `throw reveal(p.k)`; `throw { t: reveal(p.k) }`; `return Promise.reject(reveal(p.k))`; `writeFileSync('f', reveal(p.k))` with `import { writeFileSync } from 'node:fs'`; `fs.writeFileSync('f', reveal(p.k))` with `import fs from 'node:fs'`; `await writeFile('f', reveal(p.k))` with `import { writeFile } from 'node:fs/promises'`; `appendFileSync('f', reveal(p.k))` from `node:fs`. A property (seed 1337) over `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`, `write`, `writeSync` and the two module names.
- Sink names: `const log = console.log.bind(console)` then `log(reveal(p.k))` (line 1); `const st = ctx.storage` then `st.set('k', reveal(p.k))` (line 1); `const { storage: s } = ctx` then `s.set('k', reveal(p.k))` (line 1); `const save = async ({ storage }) => storage.set('k', reveal(p.k))` (line 0).
- `throw new Error('x' + reveal(p.k))` stays exactly one finding.
- Flow: `ctx.storage.set('k', 'x'.concat(reveal(p.k)))`; `for (const v of [reveal(p.k)]) ctx.storage.set('k', v)`; `const open = reveal` then `console.log(open(p.k))` (line 1); `const o = {}`, `o.k = reveal(p.k)`, `ctx.storage.set('k', JSON.stringify(o))` (line 2); `const a = []`, `a.push(reveal(p.k))`, `console.log(a)` (line 2); `const o = { token: reveal(p.k), name: 'n' }` then `tx(t, { v: o.token })` (line 1); `let d = reveal(p.k)`, `if (p.on) d = hash(d)`, `tx(t, { v: d })` (line 2); `tx(t, { v: reveal(p.k) || 'none' })`.
- Conversions: `tx(t, { v: X })` for X each of `new String(reveal(p.k))`, ``String.raw`${reveal(p.k)}` ``, `structuredClone({ k: reveal(p.k) })`, `btoa(reveal(p.k))`, `encodeURI(reveal(p.k))`, `encodeURIComponent(reveal(p.k))`, `Buffer.from(reveal(p.k)).toString('base64')`, `Array.from(reveal(p.k))`, `Object.values({ k: reveal(p.k) })`, `Object.entries({ k: reveal(p.k) })`, `Object.assign({}, { k: reveal(p.k) })`.
- The carrier property gains the carriers `concat` (`'x'.concat(e)`), `btoa` (`btoa(e)`), `push` (pushes `const q${n} = []` and `q${n}.push(e)`, gives `q${n}`) and `field` (`({ a: e, b: 1 }).a`). The hash property runs over the same list.

New cases, none:
- `tx(t, { v: reveal(p.k).length })`; `.size`; `.startsWith('sk_')`; `.includes(':')`; `.endsWith('=')`; `.indexOf('x')`; `.has('x')`.
- `const ok = reveal(p.k) && p.on` then `tx(t, { v: ok })`.
- `let d = reveal(p.k)`, `d = hash(d)`, `tx(t, { v: d })`.
- `const o = { token: reveal(p.k), name: 'n' }` then `tx(t, { v: o.name })`; `const { name } = { token: reveal(p.k), name: 'n' }` then `tx(t, { v: name })`; `const o = { name: 'n' }`, `o.token = reveal(p.k)`, `tx(t, { v: o.name })`.
- `const storage = new Map()` then `storage.set('k', reveal(p.k))`.
- `tx(t, { v: createHash('sha256').update(reveal(p.k)).digest('hex') })` with `import { createHash } from 'node:crypto'`; `tx(t, { v: scryptSync(reveal(p.k), 's', 64).toString('hex') })` with `scryptSync` from `node:crypto`.
- Known limits as none: `const enc = (x) => btoa(x)` then `tx(t, { v: enc(reveal(p.k)) })`; `[reveal(p.k)].forEach((v) => ctx.storage.set('k', v))`.

**`packages/server/conformance/privacy-diag-scrub.test.ts`**, a new case under header `// Spec: k.privacy, Sinks "The revealed value of each `Secret` in the decoded action input is replaced by `[secret]` the same way." Conformance "An action throwing the revealed value of a `Secret` input, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production."`: an action with input `s.object({ k: s.secret(s.string()) })`, posted `k: 'tok-7f3a9c'`, throwing `reveal(input.k)` in one run and `new Error('bad ' + reveal(input.k))` in another, in each mode. The written log holds `[secret]` and not `tok-7f3a9c`, nor its base64 or `encodeURIComponent` form. The test file is under `conformance/`, which E1112 skips as a test path.

`fixtures-by-code.ts` and `fix-diffs.test.ts` are unchanged: E1112's fixture and `NO_FIX` entry stand.

Suites that go red between the spec commit and the lanes: `privacy-e1112.test.ts` (the `see` assertion and the new cases), and `privacy-diag-scrub.test.ts` (the new case). No other suite reads E1112's text. `explain-and-fixture-per-code.test.ts` reads codes from every Rules paragraph and de-duplicates, so E1112 in both k.privacy and k.reveal is one code.

## Lanes and build order
1. Orchestrator: the spec diff above, one commit (k.privacy, new k.reveal, the map).
2. `conformance-writer`: the conformance diff, in the `rfc:0101` PR.
3. Check lane, one agent, `packages/check` only: `rules/revealedValue.ts` (sinks, flow, `see`), a rule-local walk for field writes, mutations, `for...of`, destructured keys and reassignment kills next to `givenValues` (whose E1603 behavior is unchanged), `test/revealedValue.test.ts` for each list entry, the README Compliance line, and the budget re-base.
4. Server lane, one agent, `packages/server` and `packages/schema/src/internal` only: `secretValues`, `rq.secrets`, the `[secret]` pass in `scrubbedCause` and at the diag write, unit tests. Disjoint from lane 3; they run in parallel.
5. Orchestrator: `docs/THREAT-MODEL.md` (below), the `keel-compliance` and `keel-storage` skill lines, backlog 0613 and 0614 closed, the Questions filed, and the ledger on a quiet tree.

Threat model, **Secrets** bullet: the sentence "E1112 reports a revealed value reaching `tx`, `store`, a `storage` write, `console` or an `Error` in the same file." becomes "E1112 reports a revealed value reaching a log, storage, a file, store state or a throw in the same file (k.reveal), and the server writes `[secret]` in place of a request's own secret input in its log." The sentence listing what is not detected becomes "These are not detected: a value carried through a helper's parameter, a callback or an import, std.jobs' `enqueue`, a response, and a credential the app parses as `s.string`, which is plain data from the start."

## Migration
- Apps, std packages, scaffold templates and evals: nothing fires. No `reveal` exists outside `packages/schema` and `packages/check` tests.
- An app outside the repo that throws, prints, writes to a file or encodes a revealed value gets E1112 at each sink. It moves to a derived value, or writes the value from a file under `unsafe/`. One that stored `reveal(x).length` or a boolean test of it loses a finding.
- Docs: `packages/check/README.md` (Compliance line), the two skills, the threat model.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.privacy | 1,464 | 1,361 |
| k.reveal | none | 706 |
| `spec/00-map.md` | 1,200 | 1,200 |

`keel explain E1112` is unchanged, one row under 120 tokens.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild, minified ESM, `packages: "external"`, platform node, gzip), swapping the prototype rule into `packages/check/src/index.ts`.

| Entry | Limit | Before | After |
| --- | --- | --- | --- |
| `@keel/check` | 51kb (52,224) | 51,901 | 53,459: re-base to 53kb (54,272) |
| `@keel/server` | 20.25kb (20,736) | 20,515 | about 20,615, unchanged |
| `@keel/schema` | 5.5kb (5,632) | unchanged | unchanged (`secretValues` is in `./internal`) |

The prototype is untuned, so 1,558 B is an upper estimate for the rule. The 813 B left above it is room for the lane's own tests of size, not for another rule.

## Risks
- The method lists match by name. An app object with an `add`, `set` or `concat` method is treated like a `Set` or a string, and one with a `has` or `includes` method ends the flow. Both are visible at the call.
- `length` and `size` end the flow off a value of unknown shape. `reveal(cfg).length` where `cfg` is an object holding a `length` field passes.
- The reassignment step reads statement order. A closure that runs after a reassignment, declared before it, still sees the earlier value and is reported. That errs toward a finding.
- Field reads keep only the first destructuring key; a nested pattern reads the outer field, which errs toward a finding.
- More sinks mean more correct code reported: a setup script that writes an API key to a file now needs `unsafe/` (Questions 2).
- `@keel/check` sits 813 B under its new limit.

## Known limits
- Not followed, by the one-file line: a parameter, a callback's parameter included (`forEach`, `map`, `then`), a same-file helper's body, an import, a class field, `this.x`, a getter, and a closure reading a `let` assigned in another function. These pass.
- Sinks not matched: a stream's `.write` (`createWriteStream(f).write(v)`), a sink called through `.call`, `.apply` or `Reflect.apply`, a computed `console[m]` whose key does not fold to a constant, `Buffer` imported from `node:buffer` (`globalRefs` resolves the global only), and `TextEncoder.prototype.encode`.
- A revealed value into an `s.secret` payload field is reported (D3).
- The `[secret]` scrub covers the request's own action input. A `Secret` parsed elsewhere in the process is not in the set, and `console` and file writes never pass through the server.
- std.jobs `enqueue` and std.workflows events are no sinks (RFC 0100 Questions 3).

## Questions
1. A new kernel section for one rule. The defaults do not say when a rule earns its own section. Recommendation: accept k.reveal, since k.privacy has no room and E1112's text is now 706 tokens, about half a section. A rule section owns its sinks and flow lists, so each later entry is one spec line and one conformance case.
2. An escape for correct code. A setup script that writes a key to a file, or a CLI that prints a fresh token once, now gets E1112. The only escape is a file under `unsafe/`, which the `unsafe` count records. A suppression comment would weaken privacy (escalation). Recommendation: no new escape; `unsafe/` stays the one way.
3. The `[secret]` scrub's reach. Recommendation: the request's action input only, as proposed. If a ctx accessor for app secrets lands (RFC 0100 Questions 2), its values join `rq.secrets` in that RFC.
4. A types mode. With `types: true` the rule could read a payload schema and follow a parameter into a helper. Recommendation: a `tasks/FUTURE.md` line, built only if an app needs it, since a rule that fires differently by mode is harder to predict than either mode alone.

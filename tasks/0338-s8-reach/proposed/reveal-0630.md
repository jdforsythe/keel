# 0630: E1112 reach, the probes the RFC 0101 review left open

Measured on `jdforsythe/test-impl` at `7a93f9cd`, reading `packages/check/src/rules/revealedValue.ts` and `packages/check/src/internal/givenAt.ts`, plus one probe run (`check(files, { types: false })`, one `modules/app/x.server.ts` action body each). Probe results today are given as `now`.

## 1. Decisions

| Probe | now | Decision | Reason |
| --- | --- | --- | --- |
| `let a; [a] = [reveal(p.k)]; console.log(a)` (and `({ a } = {...})`) | 0 | ADD | A destructuring declaration is followed; the assignment is the same `bind` over an assignment-target pattern. A pattern assignment statement also hides earlier values, as `a = v` does. |
| `let x; for (x of [reveal(p.k)]) console.log(x)` (found while probing) | 0 | ADD (no text change) | The section already says "`for...of` head"; only a head with a declaration is read today. Bug against the current text. |
| `q.splice(0, 0, v)`, `q.fill(v)` | 0 | ADD | Two more names in the existing mutating list beside `push` and `unshift`. `fill` also joins the methods whose result holds an argument (it returns the receiver: `Array(2).fill(v)`). |
| `this.x = v; console.log(this.x)` | 0 | KEEP | `this` is no local: its binding depends on how the function is called, and its fields are written and read in different methods. Following it needs a second scope mechanism; the section states it as a limit in one new sentence. |
| `new Map([[k, v]])` | 0 | ADD | A conversion whose result holds the argument: a new entry in the closed list. `new Map().set(k, v)` and `new Set().add(v)` join the argument-carrying methods so the look-alike chain agrees. |
| `new Set([v])` | 0 | ADD | As `new Map`. |
| `Object.fromEntries(...)` | 0 | ADD | Inverse of `Object.entries`, already on the list. `Array.of` joins it as the look-alike of `Array.from` and `[v]`. |
| `[v].forEach((x) => console.log(x))` | 0 | KEEP | A parameter ends the flow; the section follows no value into a callback anywhere. Following a closed list of array methods would leave `then`, `reduce` and app higher-order functions as look-alikes that differ. Stated in one new sentence. |
| `console.log.call(console, v)` | 0 | ADD | `.bind()` of a sink is covered; `.call`, `.apply`, bound arguments of `.bind`, and `Reflect.apply` pass the same arguments after the `this` value. |
| `console.log.apply(console, [v])` | 0 | ADD | As `.call`; the list is the carrying argument. |
| FP: `const { a } = { a: reveal(p.k) }; a.length` | 1 | FIX (no text change) | The text already ends a flow at `length` of a carrying local. The rule replaces the outer member key with the destructured key (`x.key ?? key` in `carries`), so `.length` is lost. `const [a] = [v]; a.length` is 0 today; the object pattern should match it and `o.a.length`. |

Today's behaviour, also probed, kept as is and not part of this change: `console.log([v].map((x) => hash(x)))` is 1 (a method on a carrying receiver carries; the callback's result is not read), and one level of field precision only (`o.a.n` of `{ a: { s: v, n: 1 } }` is 1, and the destructured `a.n` alike).

## 2. Spec diff: `spec/kernel/k.reveal.md`

**Sinks.** Replace:
> A sink counts under any local name or `.bind()`.

with:
> A sink counts under any local name or `.bind()`. Its `.call`, `.apply` or `.bind`, or `Reflect.apply` of it, passes it each argument after the `this` value.

**Flow**, second item. Replace:
> - a local any value given to it carries: initializer, assignment, `for...of` head, member write (`o.k = v`), or argument of its `push`, `unshift`, `set`, `add`, `append` or of `Object.assign`. A read after a `name = value` statement in an enclosing block sees only that value and later ones;

with:
> - a local any value given to it carries: initializer, assignment (a destructuring one alike), `for...of` head, member write (`o.k = v`), or argument of its `push`, `unshift`, `splice`, `fill`, `set`, `add`, `append` or of `Object.assign`. A read after a statement assigning `name`, alone or in a pattern, in an enclosing block sees only that value and later ones;

**Flow**, fifth item. Replace:
> - a method called on one other than `includes`, `startsWith`, `endsWith`, `indexOf` and `has`; `concat`, `replace`, `replaceAll`, `padStart` or `padEnd` given one;

with:
> - a method called on one other than `includes`, `startsWith`, `endsWith`, `indexOf` and `has`; `concat`, `replace`, `replaceAll`, `padStart`, `padEnd`, `fill`, `set` or `add` given one;

**Flow**, sixth item. Replace:
> - `String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Object.assign`, `Object.values`, `Object.entries`, `btoa`, `encodeURI`, `encodeURIComponent` or `Buffer.from` of one.

with:
> - `String`, `new String`, `String.raw`, `JSON.stringify`, `structuredClone`, `Array.from`, `Array.of`, `Object.assign`, `Object.values`, `Object.entries`, `Object.fromEntries`, `new Map`, `new Set`, `btoa`, `encodeURI`, `encodeURIComponent` or `Buffer.from` of one.

**New sentence**, appended to the paragraph "Any other call, a parameter and an import end it (a hash passes; a helper is not read)." (that sentence itself unchanged):
> A callback's parameter and a field of `this` hold nothing.

**Conformance**, four bullets appended after the last existing bullet:
> - `[a] = [reveal(p.k)]` or `({ a } = { a: reveal(p.k) })` then `console.log(a)`, and `q.splice(0, 0, reveal(p.k))` or `q.fill(reveal(p.k))` then `console.log(q)`, are each one E1112; `[a] = [hash(a)]` after `let a = reveal(p.k)`, and `q.length` after the `fill`, are none.
> - `new Map([['k', reveal(p.k)]])`, `new Set([reveal(p.k)])`, `Object.fromEntries([['k', reveal(p.k)]])`, `Array.of(reveal(p.k))` and `new Map().set('k', reveal(p.k))` in `tx` are each one E1112; `.size` and `.has('k')` of each are none.
> - `console.log.call(console, reveal(p.k))`, `console.log.apply(console, [reveal(p.k)])`, `console.log.bind(console, reveal(p.k))` and `Reflect.apply(console.log, console, [reveal(p.k)])` are each one E1112; `console.log.call(reveal(p.k))` and `hash.call(null, reveal(p.k))` are none.
> - `console.log(a.length)` after `const { a } = { a: reveal(p.k) }`, `[reveal(p.k)].forEach((x) => console.log(x))`, and `this.x = reveal(p.k)` then `console.log(this.x)` are none.

**Size.** The whole file after the change: 4,125 chars, ceil(4125/4) = **1,032 tokens** (709 today; limit 1,500). Measured by applying the diff to a scratch copy.

**`spec/kernel/k.privacy.md`:** no change. Its E1112 entry ("a revealed value reaching a log, storage, a file, store state or a throw (k.reveal)") stays true. It stays at 1,374.

The Purpose sentence stays: collections and `fromEntries` are conversions, and `.call`/`.apply` are sinks under another form.

## 3. Conformance headers that quote a changed sentence

No verbatim-quoted sentence changes. `packages/check/conformance/privacy-e1112.test.ts`:
- line 1 (Rules), line 3 and line 5 (Conformance bullets 1 and 3): unchanged sentences.
- line 2 quotes "A value carries one when it is:" (each item) and "Any other call, a parameter and an import end it (a hash passes; a helper is not read)." Both quoted sentences are unchanged; the items it cites by reference change, and the new sentence "A callback's parameter and a field of `this` hold nothing." should be added to that line.
- line 4 cites Sinks "(each sentence)" by reference; the new Sinks sentence falls under it. The writer may add it verbatim.
- The writer adds one `// Spec: k.reveal, Conformance "..."` line per new bullet (verbatim from section 2).

`packages/std-credentials/conformance/token-e1112.test.ts` quotes std.tokens only: unchanged.

The existing test "E1112 does not report a value reaching a sink through a callback's parameter (known limit)" stays true.

## 4. Conformance cases wanted

Harness as in `privacy-e1112.test.ts`: `check([MANIFEST, file], { types: false })` filtered to E1112, `file` at `modules/app/x.server.ts` whose source is the existing `HEAD` (imports `reveal` from `@keel/schema`, `tx`, `store` from `@keel/store`; `const hash = (x) => x.length`; `const t = {}` ...) then `export async function act(ctx, p) {`, the body lines, `}`. "Body line N" is 0-based, as `expectOne(lines, N)` takes it. Each positive is exactly one E1112 on that line with no fix; each negative is zero E1112.

Suggested file: `packages/check/conformance/E1112-reach.test.ts` (or new `describe` blocks in `privacy-e1112.test.ts`; the writer picks), one `describe` per group.

### A. Destructuring assignment, `for...of` head, `splice`, `fill` (bullet 4 of the new four, first)
Positives:
- A1 `["let a", "[a] = [reveal(p.k)]", "console.log(a)"]`: body line 2.
- A2 `["let a", "({ a } = { a: reveal(p.k) })", "console.log(a)"]`: body line 2.
- A3 `["let a", "let b", "[a, ...b] = [1, reveal(p.k)]", "console.log(b)"]`: body line 3.
- A4 `["let x", "for (x of [reveal(p.k)]) console.log(x)"]`: body line 1 (the `for...of` head in the current text).
- A5 `["const q = []", "q.splice(0, 0, reveal(p.k))", "console.log(q)"]`: body line 2.
- A6 `["const q = [0]", "q.fill(reveal(p.k))", "console.log(q)"]`: body line 2.
- A7 `["console.log(Array(2).fill(reveal(p.k)))"]`: body line 0.
- A8 `["let a = reveal(p.k)", "if (p.on) [a] = [hash(a)]", "console.log(a)"]`: body line 2 (an assignment in a branch hides nothing).
Negatives:
- A9 `["let a = reveal(p.k)", "[a] = [hash(a)]", "console.log(a)"]`.
- A10 `["let a = reveal(p.k)", "({ a } = { a: hash(a) })", "console.log(a)"]`.
- A11 `["let b", "({ b } = { a: reveal(p.k), b: 1 })", "console.log(b)"]` (the named field only).
- A12 `["const q = [0]", "q.fill(reveal(p.k))", "console.log(q.length)"]`.
- A13 `["const q = [1, 2]", "q.splice(0, 1)", "console.log(q)"]` (no revealed value given).

### B. Collections and `Object.fromEntries`, `Array.of`
Positives, each `[`tx(t, { v: ${X} })`]` at body line 0, for X in:
`new Map([['k', reveal(p.k)]])`, `new Set([reveal(p.k)])`, `Object.fromEntries([['k', reveal(p.k)]])`, `Array.of(reveal(p.k))`, `new Map().set('k', reveal(p.k))`, `new Set().add(reveal(p.k))`.
- B7 through a local: `["const e = [['k', reveal(p.k)]]", "const m = new Map(e)", "console.log(m)"]`: body line 2.
Negatives, for each X above: `tx(t, { v: X.size })` and `tx(t, { v: X.has('k') })`.
- B8 `["tx(t, { v: new WeakMap([[{}, reveal(p.k)]]) })"]` (off the list).

### C. `.call`, `.apply`, `.bind` arguments, `Reflect.apply`
Positives, body line 0 unless stated:
- C1 `["console.log.call(console, reveal(p.k))"]`.
- C2 `["console.log.apply(console, [reveal(p.k)])"]`.
- C3 `["const l = console.log.bind(console, reveal(p.k))", "l()"]`: body line 0, one finding in all.
- C4 `["Reflect.apply(console.log, console, [reveal(p.k)])"]`.
- C5 `["ctx.storage.set.call(ctx.storage, 'k', reveal(p.k))"]`.
- C6 `["tx.call(null, t, { v: reveal(p.k) })"]`.
- C7 `["const log = console.log", "log.call(null, 'x', reveal(p.k))"]`: body line 1 (a sink under a local name).
- C8 `["console.log.call(", "  console,", "  reveal(p.k),", ")"]`: body line 2 (at the first carrying argument).
Negatives:
- C9 `["console.log.call(reveal(p.k))"]` (the `this` value only).
- C10 `["console.log.bind(reveal(p.k))"]`.
- C11 `["hash.call(null, reveal(p.k))"]`.
- C12 `["Reflect.apply(hash, null, [reveal(p.k)])"]`.
- C13 `["console.log.call(console, hash(reveal(p.k)))"]`.

### D. Destructured `.length`, and the two stated limits
Negatives:
- D1 `["const { a } = { a: reveal(p.k) }", "console.log(a.length)"]`.
- D2 `["const { a } = { a: reveal(p.k) }", "console.log(a.size)"]`.
- D3 `["const { a: { b } } = { a: { b: reveal(p.k) } }", "console.log(b.length)"]`.
- D4 `["[reveal(p.k)].forEach((x) => console.log(x))"]`.
- D5 `["this.x = reveal(p.k)", "console.log(this.x)"]`.
Positives (the look-alikes that still report):
- D6 `["const { a } = { a: reveal(p.k) }", "console.log(a)"]`: body line 1.
- D7 `["const { a } = { a: reveal(p.k) }", "console.log(a.trim())"]`: body line 1.
- D8 `["const { a } = { a: reveal(p.k), b: 1 }", "console.log(a.slice(1))"]`: body line 1.

Property, optional: extend the existing `conversions` list with B's six forms, and `CARRIERS` with `{ name: "fill", wrap: (e) => \`Array(1).fill(${e})\` }` and `{ name: "set", wrap: (e) => \`new Set([${e}])\` }`; the hash-wrapped run must stay at zero.

## 5. Implementation outline (phase 2)

`packages/check/src/internal/givenAt.ts`:
- `ADDS` gains `splice`, `fill`.
- `AssignmentExpression`: a left `ArrayPattern` or `ObjectPattern` binds as a declaration does. The oxc assignment-target pattern types differ from `BindingPattern` (properties may be `AssignmentTargetProperty`, elements may be a `MemberExpression` or an `AssignmentTargetWithDefault`), so `bind` grows a branch or a sibling `bindTarget`; a member target inside a pattern goes to `put` with the whole value.
- `ForOfStatement`: a left that is not a `VariableDeclaration` binds (identifier or pattern) or puts (member) the same way.
- `block`: an expression statement whose assignment target is a pattern adds a kill for each identifier the pattern writes (defaults and rest included, member targets not).
- Update the doc comment.

`packages/check/src/rules/revealedValue.ts`:
- `carries`, `Identifier` case: when the given value has a string `key` and the read has a `key`, answer `!COUNTS.has(key) && once(x.v, x.key, d)` (the destructured field, then the outer member), instead of `once(x.v, x.key ?? key, d)`.
- `KEEPS` gains `Array.of`, `Object.fromEntries`, `Map`, `Set`; the `new` test widens from `path === "String"` to a small set `String`, `Map`, `Set`.
- `JOINS` gains `fill`, `set`, `add`.
- `call` visitor: before `sinkOf(n.callee)`, if the callee is a non-computed member named `call`, `apply` or `bind`, the sink is `sinkOf(callee.object)` and the arguments are `n.arguments.slice(1)` (`apply`: the second only); if `g.resolve(callee)` is `Reflect.apply`, the sink is `sinkOf(arguments[0])` and the argument is `arguments[2]`. The existing `sinkOf` branch for calling a `.bind()` result stays, so `const l = console.log.bind(console, v); l()` reports once, at `v`.
- Update the doc comment.

`packages/check/test/revealedValue.test.ts`: existing cases that stay true were checked by reading (`const called = console.log.call(console); called(v)` stays no sink; `storage.set` on a `new Map()` stays no sink). Unit tests for the kill over a pattern and the `Reflect.apply` spread case.

**Bundle.** `@keel/check` measures **53,942 B** gzip today (esbuild, same options as `tooling/budgets.mjs`), budget `53kb` = 54,272 B: **330 B of room**. Expected growth: about 150 to 250 B gzip (four list entries, the `call`/`apply`/`Reflect.apply` branch, the pattern bind and kill). It fits, narrowly; if it measures past, re-base to `53.5kb` (54,784).

## 6. For the user to decide

1. **No app code is newly reported.** `grep -rn "reveal(" apps modules` finds nothing; every `reveal(` in the repo is under `packages/`, which `isAppPath` excludes. Every ADD is a new finding only in code that writes a revealed value through one of these forms.
2. **Beyond the probed list**, added to close look-alikes, each reversible: `Array.of`; `fill`, `set`, `add` as argument-carrying methods (so `new Map().set(k, v)` agrees with `new Map([[k, v]])`; any `x.set(k, v)` result then carries, which reads true for `Map`, `Set` and arrays and is a harmless false positive for the `undefined` that `URLSearchParams.set` returns); `.bind`'s bound arguments and `Reflect.apply` (RFC 0101 listed `Reflect.apply` with `.call` and `.apply` as one limit). Dropping any of them is one word in the spec and one case.
3. **A pattern assignment hides earlier values**, as `a = v` does. Without it, `[a] = [hash(a)]` would report where `a = hash(a)` does not.
4. **Kept limits:** a callback's parameter and `this.x`. Recommendation: keep both; a types mode (RFC 0101 Question 4, `tasks/FUTURE.md`) is where a parameter would be followed.
5. **Budget:** 330 B of room before this change; a re-base to `53.5kb` may be needed in phase 2.

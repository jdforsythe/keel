# k.prove: Proving invariants
status: proposed

**Purpose.** `explore` (k.model) proves a store's invariants by enumerating its states, so it needs a finite space. `prove` proves them for every state and payload the schemas allow, finite or not, by induction with an SMT solver, for functions written in the fragment below.

**API** (`@keel/testing/prove`, Node).
```ts
test('board invariants are inductive', () => prove([addList(b), addTodo(b), toggleTodo(b), editTodo(b)]))
```
`prove(transactions, { rlimit? })` takes transactions of one store, each once. It resolves `{ proven, z3 }` (the names proven; the Z3 version as `major.minor.build`, `5.3.3`) when the store's `initial` passes `check` and, for each transaction `t`, every state `s` that parses with the store's schema and satisfies every `invariant` of the store, with every payload `p` that parses with `t.schema`, yields a state that parses and satisfies every invariant. So every state reachable through those transactions, undo included, satisfies the invariants: the `proven` rung (k.ledger). An empty or mixed list, a repeated transaction, or an `rlimit` that is not a positive integer rejects E1710 (k.model). Otherwise it rejects with:
- E1715 a function outside the fragment, naming the construct and its offset in the function's source, or a schema without a sort (Sorts), naming its path; there is no claim, and `explore` remains. The message is `<tx>: <construct> at offset <n> is outside the fragment; explore remains` (`<store> invariant <i>` in place of `<tx>` for an invariant), or `<tx>: no sort for <kind> at state.<path>; explore remains` (`payload.<path>` in a payload).
- E1716 a counterexample: the state (or `initial`) and the payload, as JSON on the next line. The state may be unreachable; then the invariant is true but not inductive: strengthen it, or `explore`. The JSON is `{"transaction","state","payload"}` (`{"state"}` for `initial`); a string is the model's literal, else `a`, `b`, ... in order of first appearance.
- E1717 no verdict within `rlimit` (default 10,000,000 Z3 resource units, a count rather than time, so a verdict repeats).
- E1718 the optional peer dependency `z3-solver` is not installed (fix adds it to `devDependencies`).

**Fragment.** Each transaction and invariant function is read from its source (`fn.toString()`, parsed with oxc) and translated whole:
- Parameters, `const`, `return`, `if`/`else`, `?:`, `&&`, `||`, `!`, `===`, `!==`, `<`, `<=`, `>`, `>=`, `+` and `-`, `*` by a numeric literal, literals. Options both `undefined`, or both `null`, are `===` whatever their sorts.
- Objects: literals, spread, property reads; `s.record` maps read as `m[k]` and written as `{ ...m, [k]: v }`. A spread's absent optional field leaves the value before it.
- Arrays: literals with spread, `.length`, index reads (`undefined` past the length; `m[k]` likewise for a missing key), and `.map`, `.some`, `.every`, `.find` with an arrow of the fragment; `new Set(a.map(f))` read only by `.has(x)` and by `.size === a.length` (the values of `f` over `a` are distinct). A `Set` of objects or arrays is E1715.
Anything else is E1715: calls to other functions, identifiers other than parameters and bindings, loops, reassignment.

**Sorts** come from the schemas: booleans; literals and enums as finite sorts; `s.int` as integers within its bounds, state and payload values also within ±(2^53 − 1); a non-integer `s.number` compared and copied only; strings and ids compared for equality (string lengths unchecked); objects as records of their declared fields; `optional` and `nullable` as an option (`optional` outside an object field as its inner sort); arrays as a length and an index map; records as a key set and a map; `.pii` marks change no sort. A union, format type, `s.json()` or `s.secret` has none. A post-state integer is checked against its `min` and `max` only: one without a bound may reach 2^53, past the safe range, and its transaction is still `proven`.

**Obligations.** The goal also holds what each function needs to run as written: an option it reads through is present, each `+`, `-` and `*` result is within ±2^53, a map key it reads is present or no `Object.prototype` name, a key it writes is not `__proto__`, `constructor` or `prototype`; a string under a length rule takes only a value of that rule, else E1715. A key an object literal writes holds no `undefined`.

**Solver.** Z3 through `z3-solver` (MIT), loaded on first use, single-threaded, `smt.random_seed` 0. A verdict holds for the installed Z3 version, which the evidence records.

**Conformance.**
- A store `{ n: s.int({ min: 0 }) }` with invariant `n >= 0`, `inc` (`n + 1`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`.
- A transaction calling an imported helper rejects E1715 naming the call.
- Appending `p` to an array under `!a.some(x => x.id === p.id)` proves `new Set(a.map(x => x.id)).size === a.length`; without the guard it rejects E1716 with a state holding `p.id`.
- An invariant true in every reachable state but not inductive rejects E1716 with a state no transaction reaches.
- A store whose `initial` breaks an invariant rejects E1716 with that state and no payload.
- Two runs give byte-equal verdicts and counterexamples.
- `rlimit: 1` rejects E1717 where the default proves.
- Without `z3-solver`, `prove` rejects E1718.

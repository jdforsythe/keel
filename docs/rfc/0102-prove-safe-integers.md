# RFC 0102: `prove` holds every post-state integer within the safe range

Status: accepted (user decision 2026-11-16: the safe-integer limit becomes an obligation). For backlog 0606. Each further decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0125 records it.

## Decisions
- D1: the obligation. Every `s.int` the post-state holds, at any depth, is within ±(2^53 − 1), the range `s.int` parses. The goal checks the post-state with the rule the pre-state is assumed under. The limit sentence in k.prove Sorts goes and one sentence replaces it. `n + 1` on a field with no bound and no guard rejects E1716 with the state at the edge (user decision; default 6: the limit was a sentence, the check is in the prover).
- D2: one rule, no new pass. The check is the goal's existing "the post-state parses" term with the integer range switched on. A copied integer passes by assumption, so the rule bites on an arithmetic result or a literal written to the state. Intermediate `+`, `-` and `*` results keep ±2^53 (Obligations, unchanged). A non-integer `s.number` gets no rule: the fragment has no arithmetic on one (defaults 2, 3).
- D3: the counterexample names its fix. E1716 keeps its code and its JSON. When only an integer range breaks, the first line is `<tx> leaves the safe integer range from this state; bound the schema or guard it`. A counterexample of the schema, an invariant or another obligation is reported first, under the line it has today (default 6; Questions 2).
- D4: a state or payload array holds at most 2^32 − 1 items, the engine's own limit. A length written to an integer field then proves, and `items.length + 1`, which rejects today with a 64-item state, proves too (Questions 1).
- D5: k.prove's first Conformance bullet takes a bounded counter (`max: 9`, `inc` as `n < 9 ? n + 1 : n`), and a second bullet holds the unbounded `inc` as the rejecting case. k.prove goes from 1,348 to 1,443 tokens of 1,500.
- D6: `@keel/testing/prove` measured 7,825 to 7,973 B gzip on the prototype; re-base `7.75kb` (7,936) to `8kb` (8,192), 219 B of room (default 7).

No new code and no new API. golden-1 changes nothing: its board schemas hold no integer, and its six transactions prove before and after.

## Problem
Measured on `jdforsythe/test-impl` at `dfff457f`, reading `packages/testing/src/prove/prove.ts`, `internal/sortTable.ts` and `internal/translator.ts`.

**Proven today, thrown when run.** `step` assumes `wf(S, "s", true)` for the pre-state, the bounds and ±(2^53 − 1), and proves `wf(S, "post", false)` for the post-state, the bounds only. `s.int` refuses an integer outside the safe range (`packages/schema/src/internal/leafRule.ts:23`, `Number.isSafeInteger`), and the store parses every transaction's result and throws when it does not parse (`packages/store/src/store.ts:142-143`, `transaction <name> returned invalid state`). So `inc` on `{ n: s.int({ min: 0 }) }` is `proven`, and from a state at 9007199254740991 running it throws `transaction <name> returned invalid state: int at n` (run here). k.prove's API paragraph says a proven transaction "yields a state that parses"; the last sentence of Sorts takes that back for an integer with no bound. Each of these resolves `proven` today:
- `{ n: state.n + 1 }` on `{ n: s.int({ min: 0 }) }`
- `{ n: state.n - 1 }` on `{ n: s.int() }`
- `{ a: state.a.map((v) => v + 1) }` on `{ a: s.array(s.int({ min: 0 })) }`
- `state.n === undefined ? { n: 0 } : { n: state.n + 1 }` on an optional `n`
- `{ n: 9007199254740992 }` on `{ n: s.int() }`

**The induction.** The step assumes a range of the pre-state that it never shows of the post-state. The assumption holds at run time because the store throws on the write, and that throw is the failure `proven` says cannot happen.

**Lengths.** An array's length has a lower bound of 0 in the model and no upper bound. `{ items: [...state.items, p.v], count: state.items.length + 1 }` rejects E1716 today on the ±2^53 rule for `+`, with a state whose array is longer than 2^53 items and prints as its first 64 (`readModel`'s cap). No engine holds that array. With the post-state range checked and nothing else changed, `count: state.items.length` rejects the same way (measured).

**What the author is told.** `keel explain E1716` prints `E1716 is not a known code`: k.prove names its codes under API, and k.check's explain clause reads a section's Rules paragraph or `reportedCodes()`. The message's first line is the only text, and it reads `breaks the schema or an invariant from this state; it may be unreachable` for every counterexample, an arithmetic one included.

## Proposal

### D1. The obligation
One sentence replaces the limit: a post-state integer is held within ±(2^53 − 1) too, as `s.int` parses it. It covers every `s.int` the post-state holds: an object field, an optional or nullable field when present, an array item, a record value, at any depth.

The rule is stated on the state. A copied integer comes from the pre-state or the payload, which are assumed in range, so it passes with no work. What can fail is an arithmetic result written to the state, or an integer literal past the range. Stating the rule on the state keeps it to one sentence, and it is the sentence the API paragraph already claims: the post-state parses.

The edge is 2^53 − 1 for the state and 2^53 for an intermediate result, as today. `n + 1 - 1` proves on an unbounded `n`: the sum reaches 2^53, which JavaScript holds exactly, and the state gets 2^53 − 1. `n + 1 > 5 ? 0 : n` proves for the same reason. An integer result written into an `s.number` field (`r: state.n + 1`) proves: `s.number` takes any finite number, and the ±2^53 rule holds the sum exact.

The induction is consistent. `initial` passes `check`, which parses with `s.int`, so the base case is in range. The step assumes the range of the pre-state and proves it of the post-state. Every reachable state is in range by the proof, and the store's throw is never reached.

### D2. Where it is checked
`wf(t, e, safe)` in `sortTable.ts` builds the term "this value parses". `step` calls it three times: for the pre-state and the payload with the range, for the post-state without. The post-state call takes the range. There is no second pass, no new traversal and no change to the fragment.

### D3. The counterexample
For `inc` on a store `count` with `{ n: s.int({ min: 0 }) }` the prototype rejects with code E1716, `data` equal to the JSON line, and this message:

```
count.inc leaves the safe integer range from this state; bound the schema or guard it
{"transaction":"count.inc","state":{"n":9007199254740991},"payload":{}}
```

That state is the only one that fails: `n` is assumed at most 2^53 − 1, and `n + 1` leaves the range only there. Two runs give the same bytes. The lower edge mirrors it: `n - 1` on `{ n: s.int({ max: 0 }) }` gives `{"n":-9007199254740991}`.

The goal splits in two. `rest` is the post-state's bounds, the invariants and every obligation but the arithmetic ranges. The integer ranges are the post-state's ±(2^53 − 1) and each `+`, `-`, `*` result's ±2^53. The solver checks the whole goal as today, once per array bound. On a counterexample it checks `rest` alone within the same bound. A counterexample of `rest` is reported under today's line. When `rest` cannot break there, only an integer range did, and the first counterexample is reported under the safe-range line. A proof runs no extra check; a rejection runs one more.

Both integer rules share the line because they share the fix. `n * 2` and `n + p.by` on unbounded integers reject today on the ±2^53 rule under the schema-or-invariant line; with the split they get the safe-range line.

### D4. Array lengths
`wf` asserts `0 <= length` for an array. For the pre-state and the payload it also asserts `length <= 4294967295`: no JavaScript array is longer. The post-state gets no such check (Known limits). A length is then far inside the safe range, so `count: state.items.length` and `state.items.length + 1` prove.

### What an author writes
The smallest fix for `inc` is two edits, a bound in the schema and a guard in the transaction:

```ts
const Count = s.object({ n: s.int({ min: 0, max: 9 }) });
const inc = transaction(count, "count.inc", s.object({}), (state) => ({ n: state.n < 9 ? state.n + 1 : state.n }));
```

- A `max` alone does not prove `n + 1`. It moves the counterexample from the edge of the safe range to the bound: `{"n":9}` under the schema-or-invariant line, before and after this RFC. The guard is the author's answer to that state.
- A guard alone proves: `state.n < 9007199254740991 ? state.n + 1 : state.n` with no `max`. The field then has no bound that means anything in the app, which is why the line names the schema first.
- The guard's bound is a numeric literal inside the function. `Number.MAX_SAFE_INTEGER` and a `const` declared outside the function are E1715 (`the identifier Number`), since the fragment knows parameters and bindings only (Questions 4).
- Bounded inputs need no guard: `{ total: p.a + p.b }` with both payload fields `s.int({ min: 0, max: 1000 })` proves on an unbounded `total`.
- A decrement needs the same on the other side: a `min`, and `n > 0 ? n - 1 : n`.

### Prototype
A scratch copy of `packages/testing/src/prove` with D1, D3 and D4 ran every `prove` test file through a vitest alias of `@keel/testing/prove`, one file at a time, and then a list of new cases. "Before" is the current code on the same fixture; a dash means the case ran on the prototype only.

| Case | Before | After |
| --- | --- | --- |
| `n + 1` on `{ n: s.int({ min: 0 }) }` | proven | E1716 `{"n":9007199254740991}`, safe-range line |
| `n - 1` on `{ n: s.int() }` | proven | E1716 `{"n":-9007199254740991}`, safe-range line |
| `a.map((v) => v + 1)` on `s.array(s.int({ min: 0 }))` | proven | E1716 `{"a":[9007199254740991]}`, safe-range line |
| optional `n`: `n === undefined ? 0 : n + 1` | proven | E1716 `{"n":9007199254740991}`, safe-range line |
| `{ n: 9007199254740992 }` on `{ n: s.int() }` | proven | E1716 `{"n":0}`, safe-range line |
| nullable `n`, `n + 1`; `n + 1` in an array of objects | - | E1716 with 9007199254740991 in the state, safe-range line |
| record value `v + 1`, key an enum | - | E1716 `{"c":{}}`, payload `{"k":"a"}`, safe-range line |
| `n * 2` on `{ n: s.int({ min: 0 }) }` | E1716 `{"n":4503599627370497}`, schema line | same state, safe-range line |
| `n + p.by`, both `s.int({ min: 0 })` | E1716, payload `{"by":9007199254740991}`, schema line | E1716, same payload, safe-range line |
| `n + 1` on `{ n: s.int({ min: 0, max: 1_000_000 }) }` | E1716 `{"n":1000000}`, schema line | same |
| `n < 1_000_000 ? n + 1 : n` on that store | proven | proven |
| `n < 9007199254740991 ? n + 1 : n`, no `max` | proven | proven |
| `n < Number.MAX_SAFE_INTEGER ? n + 1 : n` | E1715 `the identifier Number` | same |
| guard against a `const` outside the function | E1715 `the identifier MAXN` | same |
| `n > 0 ? n - 1 : n` on `{ n: s.int({ min: 0 }) }` | proven | proven |
| a payload integer copied to the state | proven | proven |
| `r: n + 1` into an `s.number` field | proven | proven |
| `n + 1 - 1` on an unbounded `n` | proven | proven |
| `n + 1 > 5 ? 0 : n` on `{ n: s.int() }` | - | proven |
| `total: p.a + p.b`, payload fields `0..1000`, `total` unbounded | - | proven |
| `count: items.length` | proven | proven (E1716 with a 64-item state under D1 without D4) |
| `count: items.length + 1` with an append | E1716 with a 64-item state | proven |
| invariant `n <= 5` broken and an unbounded `m + 1` in one transaction | - | E1716 `{"n":5,"m":0}`, schema line |
| bounded counter (`max: 9`, guarded `inc`, guarded `dec`) | - | proven; `rlimit: 1` is E1717; `[inc, bad]` is E1716 `{"n":0}` |

The six golden-1 board transactions, each alone, medians of five runs in one process:

| Transaction | Before | After |
| --- | --- | --- |
| `api.addList` | proven, 74 ms | proven, 78 ms |
| `api.addTodo` | proven, 70 ms | proven, 81 ms |
| `api.toggleTodo` | proven, 76 ms | proven, 68 ms |
| `api.editTodo` | proven, 62 ms | proven, 80 ms |
| `api.hideList` | proven, 61 ms | proven, 59 ms |
| `api.showList` | proven, 64 ms | proven, 57 ms |

`Board`, `Todo` and `TodoList` hold ids, strings, an enum and booleans. No `s.int` is in reach of a proof in golden-1, so no verdict there can change.

## Alternatives
- Keep the limit sentence. Rejected by the user's decision: `proven` would cover a transaction that throws in the store.
- A warning in the result (`{ proven, z3, warnings }`). Rejected: a resolved `prove` is the `proven` rung, and a field no test reads lowers nothing.
- Require a `max` on every `s.int` of a proven store, as E1715. Rejected: a `max` does not make `n + 1` hold (the write still needs its guard), and a field that is only copied or compared needs none.
- Check only arithmetic results that reach the state. Rejected: the verdicts are the same, since a copy is in range by assumption, and it costs a second traversal and a longer sentence.
- Tighten the intermediate rule to ±(2^53 − 1) and leave the post-state alone. Rejected: a literal 2^53 written to the state has no arithmetic and would pass, and `n + 1 - 1` would reject though it runs exactly.
- One first line for every counterexample, with no second check. Not taken: it measures 7,845 B and needs no re-base, and the author reads `breaks the schema or an invariant` over a state at 9007199254740991 with no word about a bound (Questions 2).
- An explain row in place of the message line. Not available: `keel explain E1716` has no row today (Questions 3).

## Spec diff
Tokens are `ceil(chars / 4)`, as `tooling/budgets.mjs` counts. One file, `spec/kernel/k.prove.md`, four edits.

1. API, the E1716 bullet. Appended after "... in order of first appearance.":

```md
 When only an integer range breaks (Sorts, Obligations), the first line is `<tx> leaves the safe integer range from this state; bound the schema or guard it`.
```

2. Sorts, the array clause. Old:

```md
arrays as a length and an index map;
```

New:

```md
arrays as a length and an index map, a state or payload array holding at most 2^32 − 1 items;
```

3. Sorts, the last sentence. Old:

```md
A post-state integer is checked against its `min` and `max` only: one without a bound may reach 2^53, past the safe range, and its transaction is still `proven`.
```

New:

```md
A post-state integer is held within ±(2^53 − 1) too, as `s.int` parses it: `n + 1` with no bound and no guard is a counterexample at 2^53 − 1.
```

4. Conformance, the first bullet. Old:

```md
- A store `{ n: s.int({ min: 0 }) }` with invariant `n >= 0`, `inc` (`n + 1`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`.
```

New, two bullets:

```md
- A store `{ n: s.int({ min: 0, max: 9 }) }` with invariant `n >= 0`, `inc` (`n < 9 ? n + 1 : n`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`.
- With no `max`, `inc` as `n + 1` rejects E1716 with state `{ n: 9007199254740991 }` and the safe-range line, and `n: a.length + 1` over a state array `a` proves.
```

Before 5,392 chars (1,348); after 5,771 chars (1,443).

Unchanged: the first Sorts clause "`s.int` as integers within its bounds, state and payload values also within ±(2^53 − 1)", which `prove-counter.test.ts` quotes; the Obligations paragraph, which `prove-obligations.test.ts` quotes whole; the two E1716 sentences `prove-e1716.test.ts` quotes. `spec/00-map.md`, k.model and k.ledger are untouched.

## Conformance diff
Written by the `conformance-writer` from the k.prove text above, without the implementation. This RFC allows these changes under `packages/*/conformance/**`.

**`packages/testing/conformance/prove-counter.test.ts`**, headers:
1. Changed: `// Spec: k.prove, Conformance "A store `{ n: s.int({ min: 0, max: 9 }) }` with invariant `n >= 0`, `inc` (`n < 9 ? n + 1 : n`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`."`
2. Kept: `// Spec: k.prove, Sorts "`s.int` as integers within its bounds, state and payload values also within ±(2^53 − 1)"`
3. New: `// Spec: k.prove, Sorts "A post-state integer is held within ±(2^53 − 1) too, as `s.int` parses it: `n + 1` with no bound and no guard is a counterexample at 2^53 − 1."`
4. New: `// Spec: k.prove, Conformance "With no `max`, `inc` as `n + 1` rejects E1716 with state `{ n: 9007199254740991 }` and the safe-range line, and `n: a.length + 1` over a state array `a` proves."`
5. New: `// Spec: k.prove, Sorts "a state or payload array holding at most 2^32 − 1 items"`

Changed cases (two of the file's five fail on the prototype as written today):
- The `counter` fixture: the store is `{ n: s.int({ min: 0, max: 9 }) }` and `inc` is `state.n < 9 ? state.n + 1 : state.n`; `dec` and `bad` stand. "inc and dec proves" keeps its assertion. "with dec as n - 1" keeps `prove([inc, bad])` and its assertion; the prototype gives `{"n":0}`.
- The `lower` property (`n - by`) and both `int sort bound` cases are unchanged and green on the prototype.

New cases:
- `n + 1` on `{ n: s.int({ min: 0 }) }`: E1716, the JSON line's state is `{ n: 9007199254740991 }`, and the first line is the safe-range line with the transaction's name.
- `n - 1` on `{ n: s.int({ max: 0 }) }`: E1716 with `n` at -9007199254740991.
- A property (seed 1337) over where the integer sits: an object field, an optional field (`n === undefined ? 0 : n + 1`), a nullable field, an array item (`a.map((v) => v + 1)`), a field of an array's objects. Each is E1716 with 9007199254740991 in the state. A record value (`v + 1` under an enum key) is E1716 with the safe-range line; its state prints `{}`, so the case asserts the code and the line.
- `{ n: 9007199254740992 }` on `{ n: s.int() }`: E1716 with the safe-range line.
- These prove: `n < 9007199254740991 ? n + 1 : n` with no `max`; `n + 1 <= 9 ? n + 1 : n` with `max: 9`; `total: p.a + p.b` with both payload fields `s.int({ min: 0, max: 1000 })` on an unbounded `total`; `r: n + 1` into an `s.number` field; `n + 1 - 1`; `n + 1 > 5 ? 0 : n` on `{ n: s.int() }`.
- `n + 1` unguarded on `{ n: s.int({ min: 0, max: 9 }) }`: E1716 with state `{ n: 9 }`, and the first line is not the safe-range line.
- Lengths, on `{ items: s.array(s.string()), count: s.int({ min: 0 }) }`: `{ ...state, count: state.items.length }` proves, and `{ items: [...state.items, p.v], count: state.items.length + 1 }` proves.

**`packages/testing/conformance/prove-e1716.test.ts`**, a third header: `// Spec: k.prove, Rules "When only an integer range breaks (Sorts, Obligations), the first line is `<tx> leaves the safe integer range from this state; bound the schema or guard it`."` (the file names the E1716 paragraph Rules already). New cases:
- The first line is exactly `<tx> leaves the safe integer range from this state; bound the schema or guard it` for the unbounded `inc`, for `n * 2` on `{ n: s.int({ min: 0 }) }` and for `n + p.by` with both `s.int({ min: 0 })` (an Obligations range), and `data` deep-equals the JSON line.
- A transaction that breaks an invariant and an integer range (`{ n: s.int({ min: 0, max: 9 }), m: s.int() }`, invariant `n <= 5`, `{ n: n < 9 ? n + 1 : n, m: m + 1 }`): E1716, the first line is not the safe-range line, and the state's `n` is 5.
- The four existing cases are green on the prototype.

**`packages/testing/conformance/prove-e1717.test.ts`**: the `counter` fixture takes `max: 9` and the guarded `inc`. Today's first case fails on the prototype because the default no longer proves. With the bounded fixture the default proves and `rlimit: 1` is E1717 (`<id>.inc: no verdict within rlimit 1`, measured). Headers stand.

**`packages/testing/conformance/prove-result.test.ts`**: stores `a` and `b` take `max: 9`, and `inc` and `other` take the guard. Today's first case fails on the prototype for the same reason. The four E1710 cases never reach the solver and stand.

**`packages/testing/conformance/prove-deterministic.test.ts`**: the unbounded `inc` joins the transactions whose two runs are compared, so the safe-range counterexample is held byte-equal. The existing case is green on the prototype.

Unchanged and green on the prototype: `prove-e1715` (9 cases), `prove-e1718` (1), `prove-initial` (1), `prove-not-inductive` (2), `prove-obligations` (10), `prove-options` (11), `prove-unique-ids` (3). `prove-e1718`, `prove-initial` and the `broken` store of `prove-e1716` hold an unbounded `n + 1` and reject before the step (no solver, or `initial`), so their verdicts stand; the writer may leave them.

`packages/cli/conformance/ledger-prove-rung.test.ts` and `ledger-prove-awaited.test.ts` are unchanged. They were read, not run against the prototype, since they spawn the `keel` binary over a temp project. Their proving store is `{ on: s.boolean() }`. Their failing store is `{ n: s.int({ min: 0 }) }` with `n - 1`, which rejects at `{ n: 0 }` with no range in play.

Suites that go red between the conformance commit and the verify lane: the new cases of `prove-counter` and `prove-e1716`, and the new entry of `prove-deterministic`. The changed fixtures prove on today's code as well: a guarded `inc` under a `max` proves today (measured with `max: 1_000_000`).

## Lanes and build order
1. Orchestrator: the spec diff above, one commit.
2. `conformance-writer`: the conformance diff, in the `rfc:0102` PR.
3. Verify lane, one agent, `packages/testing` only:
   - `src/prove/internal/sortTable.ts`: `wf`'s third parameter becomes a level: 0 the bounds, 1 with the integer range, 2 with the array cap. The pre-state and payload take 2, the goal takes 1, `rest` takes 0.
   - `src/prove/internal/translator.ts`: the ±2^53 need of `+`, `-` and `*` goes to its own list, a sixth parameter, so `step` can keep it out of `rest`.
   - `src/prove/prove.ts`: `rest` and `goal`; one function for a check at a bound that returns the verdict or the counterexample; the second check on a counterexample; the two first lines. The safe-range line is used only when the second check answers `unsat`; without a verdict the first counterexample goes out under today's line.
   - `test/prove.pairs.test.ts`, "a sum inside a callback is held for every item": `within` rejects on the prototype (`xs` is `s.array(s.int())`). It becomes `(x > 0 && x < 100 ? x : 0) + 1`, which proves, and `past` becomes `(x > 0 ? x : 0) + 1`, which is E1716 with `xs: [9007199254740991]` (both measured).
   - `test/prove.board.test.ts`, the planted `addTodo`: the pinned counterexample's payload `priority` is `low` where it was `normal`. The array cap changes the query text, so Z3 picks another model; the verdict and the rest of the JSON stand.
   - New unit tests: each depth of D1 in `test/prove.sorts.test.ts`; in `test/prove.sound.test.ts`, each new counterexample run against the real store (`tx(inc)` from a state at 9007199254740991 throws `returned invalid state`), so the proof and the run agree.
   - `README.md`, the `@keel/testing/prove` entry (Migration, Docs).
   - A changeset, `.changeset/prove-safe-integers.md` (below).
   - Verify with one file at a time (`pnpm --filter @keel/testing exec vitest run <file>`) and `pnpm --filter @keel/testing check`. `prove.fragment` (8 cases), `prove.property` (1), `prove.refused` (13), `prove.sorts` (7) and `prove.sound` (20) are green on the prototype as they stand. No mutation run: the user holds those.
4. Orchestrator: `tooling/budgets.json` (`@keel/testing/prove` to `8kb`, the measured number and the reason in the commit), the `keel-storage` skill line, the eval spec slice, `docs/HANDOFF.md` (the known limit goes), backlog 0606 closed, the lines Questions 3 and 4 name, and the ledger on a quiet tree.

No golden-1 lane: nothing in `apps/golden-1` changes.

Changeset text:

```md
---
"@keel/testing": patch
---

`prove` holds every integer of the post-state within ±(2^53 − 1), the range `s.int` parses. A transaction that writes `n + 1` into a field with no bound and no guard rejects E1716 with the state at the edge (`{"n":9007199254740991}`) under the line `<tx> leaves the safe integer range from this state; bound the schema or guard it`. Give the field a `max` and guard the write (`n < 9 ? n + 1 : n`). `n * 2` and `n + p.by` on unbounded integers get the same line. A state or payload array holds at most 2^32 − 1 items, so a length written to an integer field proves.
```

## Migration
- In the repository no verdict changes outside `packages/testing`'s own fixtures. `apps/golden-1/test/board.prove.test.ts` proves its six transactions unchanged. The integers in golden-1 (`BoardView.schema.ts`, `Digest.schema.ts`, `EditorData.schema.ts`) belong to stores no `prove` names.
- `evals/tasks/golden-1-api`: `TASK.md` items 13 and 15 and `pass.ts` (a match on `E1716` for the planted `addTodo`) stand. `spec-slice.txt`, the k.prove E1716 line, gains one clause: `an integer written to state stays within ±(2^53 − 1): give the field a max and guard n + 1`.
- `packages/scaffold` has no `prove` template, and `docs/guide` does not mention `prove`.
- Docs: `packages/testing/README.md`, where "integers within their bounds and ±(2^53 − 1)" gains "the post-state's too, a state or payload array at most 2^32 − 1 items", and the E1716 entry gains the second first line. `.claude/skills/keel-storage/SKILL.md`, the Proofs line, where "E1716 counterexample" becomes "E1716 counterexample (a state at 9007199254740991: give the field a `max` and guard the write, `n < 9 ? n + 1 : n`)". `keel-correctness`, `keel-architecture`, `docs/ARCHITECTURE.md`, ADR-0108 and `apps/golden-1/README.md` say nothing the change makes false.
- An app outside the repository whose proof covers a transaction that changes an unbounded integer by arithmetic gets E1716 from that test. Its rung falls from `proven` to what its other tests hold, and `keel ledger --diff` reports E1706 until the proof passes again. The steps: give the field a `max` (and a `min` where it falls), guard the write against the same literal, run the test.
- A store on durable storage: a new `max` narrows the state schema, and k.compat reads as reporting that under `keel check --base` (E1563, "the current state schema must accept the base one"); this was not run here. Such an app can take the guard alone, against the literal `9007199254740991`, which proves with the schema as it stands (measured).

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.prove | 1,348 | 1,443 |

Per edit: the E1716 line +158 chars, the array clause +57, the Sorts sentence -19, the two bullets +183. `keel explain E1716` is unchanged: it has no row.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild 0.28.2, minified ESM, `packages: "external"`, platform node, gzip) on `src/prove/index.ts` and on scratch copies of it.

| Entry `@keel/testing/prove`, limit 7.75kb (7,936) | gzip B |
| --- | --- |
| Today | 7,825 |
| D1 alone: the post-state call takes the range | 7,822 |
| D1 with `wf`'s flag removed | 7,801 |
| D1 and D4: the array cap | 7,845 |
| D1, D3 and D4: the proposal | 7,973: re-base to 8kb (8,192) |

The prototype is untuned: its goal repeats the post-state's bounds once inside `rest` and once beside it. 219 B of room is left for the lane.

Proof time, on the same machine:

| Run | Before | After |
| --- | --- | --- |
| `apps/golden-1/test/board.prove.test.ts`, the test's time over three runs | 631, 659, 690 ms | 667, 673, 696 ms |
| The six board transactions, sum of per-transaction medians | 407 ms | 423 ms |
| `test/prove.sound.test.ts`, tests, one run | 834 ms | 1,160 ms |
| `test/prove.pairs.test.ts`, tests, one run | 1,340 ms | 1,900 ms |
| `conformance/prove-obligations.test.ts`, tests, one run | 301 ms | 403 ms |

On the board a proof costs within 4% of what it did. The last three files are made of rejecting cases, and each rejection runs the second check of D3.

## Risks
- "Schema first" holds within one array bound. The search stops at the first bound with a counterexample, so an integer counterexample over empty arrays is reported before an invariant counterexample that needs one item.
- The array cap changes the text of every query over an array, so Z3 may pick another model. Verdicts stand; a test that pins a whole counterexample may need its expected value again. One such test is in the repository (`test/prove.board.test.ts`).
- A rejection takes a second check. If it ends without a verdict, the first counterexample goes out under the schema-or-invariant line though only an integer range may have broken.
- An author can guard against `9007199254740991` and leave the schema open. That proves, and nothing reports the missing bound.
- An app outside the repository loses `proven` on affected transactions until it bounds them (Migration).
- k.prove has 57 tokens of room after the change, and the entry 219 B.

## Known limits
- The safe-range line does not name the field. For one integer the state shows it at the edge; for `n + p.by` the payload does.
- A record prints as `{}` in a counterexample, so a range counterexample inside an `s.record` shows the key in the payload and no value.
- The post-state's arrays get no cap. `[...a, x]` on an array of 2^32 − 1 items throws `RangeError` in the engine, and `prove` does not hold that; memory ends first.
- The guard's bound is a literal in the function. `Number.MAX_SAFE_INTEGER` and a `const` outside the function are E1715.
- An arithmetic result that never reaches the state keeps the ±2^53 rule, one past the state's edge.
- A non-integer `s.number` is compared and copied only, as before.
- `keel explain E1716` has no row (Questions 3).

## Questions
1. The array cap (D4). The defaults do not settle an assumption about the engine. Without it, D1 makes `count: items.length` reject with a 64-item state no author can read, and `items.length + 1` does that today. It costs 23 B and 14 tokens, and it can change which model a counterexample over arrays shows. Recommendation: accept it. The cap is true of every array a transaction receives, and it removes a false alarm that exists now.
2. The safe-range line and the re-base (D3, D6). The line needs the goal split and a second check on a rejection: 128 B, a re-base from 7.75kb to 8kb, and 34% to 42% more test time in three files of rejecting cases (single runs). The plain alternative keeps one line for every counterexample and fits the budget at 7,845 B. Recommendation: accept the line. It is the only place the author is told to bound the field, since no explain row exists.
3. Explain rows for E1715 to E1718. `keel explain` knows none of the four, because k.prove lists its codes under API and k.check's clause reads Rules. Recommendation: a backlog line for the check lane, four rows in `EXPLANATIONS.ts` and a Rules paragraph in k.prove, with E1716's row carrying the bound and the guard as its fix example. It is kept out of this RFC because it spends `@keel/check`'s budget and k.prove's last 57 tokens.
4. `Number.MAX_SAFE_INTEGER` and `Number.MIN_SAFE_INTEGER` in the fragment, so a guard needs no 16-digit literal. Recommendation: a `tasks/FUTURE.md` line. A schema bound is the better fix, and the entry has 219 B.
5. golden-1. The decision expected golden-1's schemas to change; measured, none does, because the board holds no integer. Recommendation: leave golden-1 as it is. Conformance holds the obligation, and a counter added to the board to exercise it would be a stored-data change to a golden app, which is the user's call.

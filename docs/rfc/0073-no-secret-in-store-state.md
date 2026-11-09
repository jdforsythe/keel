# RFC 0073: store state never holds a secret (E1303)

Status: accepted (ADR-0062, 2026-11-09). The user chose a check rule over a documented limit. The design applies the WORKFLOW RFC defaults 6 (kernel-level enforcement over documentation) and 4 (privacy by default: secrets never persist), and default 2 (one way) for what it leaves alone. Amended the same day after the red-team pass (backlog 0257-0262): `store()` refuses a state schema holding a secret at run time, the `snapshot()` error names E1303, the fix text no longer moves `reveal` to a payload, and names resolve by binding.

## Problem
Backlog 0239, filed by the red-team pass on RFC 0071. The snapshot fold removes secrets from transaction payloads only. A reducer that copies `reveal(p.token)` into a state field writes the plaintext into `state`, into the snapshot `initial`, and from there into `#k-state`, `ctx.storage` and session captures. `packages/store/test/secretFold.test.ts` pins this. Two ways lead there:
1. **A secret in the state schema.** `store(s.object({ token: s.secret(s.string()) }), ...)` holds a `Secret` in state. Nothing static reports it. At run time `snapshot()` throws, because the encoded state carries the marker and fails with `secret-missing`.
2. **`reveal` in a reducer.** A reducer that reveals a payload secret and stores the plaintext in a plain field passes every check. E1105 reports `reveal` only outside `*.server.ts`, and its advice (move the code to a server file) leaves the leak in place.

## Proposal
### E1303 (k.store, `@keel/check`)
One kernel rule, `noSecretInState` in `packages/check/src/rules/`, registered in `KERNEL_RULES`, `see: k.store`. It runs on app files (`isAppPath`) and reports two cases:
- **(a) Schema.** The first argument of a `store(...)` call, where `store` is the `@keel/store` import under any alias, is a schema whose tree holds `s.secret` at any depth. The rule reads the argument statically. It accepts an inline `s.<factory>(...)` chain, an identifier bound to a top-level `const` in the file, and a named import from a relative specifier. An import resolves to a file in `RuleInput.project` and is followed through that file's consts and its own relative imports. At most 8 consts are followed along one path (an import alias costs none), and a binding is read again only when reached through fewer, so cycles end. It walks the call arguments of every `s` chain (`object`, `array`, `record`, `union`, ...), and for a method on any other receiver (`.optional()`, `Base.extend({ ... })`) both the receiver and the arguments, and `s` is the `@keel/schema` import under any alias in each file it reads. Anything it cannot resolve, such as a function parameter, a package import or a computed key, adds nothing. The finding is reported at the first argument, and the message names the field path (`creds.token`), because the secret may sit in another file and a rule reports only on its own file.
- **(b) Reducer.** A reference to `reveal`, imported from `@keel/schema` under any alias or reached as `<namespace>.reveal`, inside the function passed as the last argument of a `transaction(...)` call, where `transaction` is the `@keel/store` import. The finding is reported at the reference, so a call `reveal(p.token)` and a value use `.map(reveal)` are both reported. A reducer is pure and returns state, so a revealed value has nowhere else to go.

Messages are one line under 90 characters:
- (a) `store state schema holds s.secret at <path>; state never holds a secret`
- (b) `transaction <name> uses reveal; state never holds a secret` (`?` when the name is not a string literal)

**Binding, not name.** `store`, `transaction`, `reveal` and a `@keel/schema` namespace count only where a read binds the module-scope import (`globalRefs(...).sameBinding`, the resolver E1601 uses). A parameter or local of the same name shadows it and is not reported. Any `reveal` in a reducer fires, also one whose value is only compared (`hash(reveal(p.pin)) === st.pinHash`): the rule does not follow data flow.

**No fix.** Removing the field leaves the `initial` value and every reducer that writes the field ill-typed, and the field can live in another file, so the edit is not one hunk on the checked file. Removing a `reveal` call leaves a `Secret` where the state type wants a plain value. Both are design changes, so E1303 joins the no-fix list.

**Runtime guard (exact).** `store(schema, ...)` throws at construction when `schema.node` holds a `secret` node anywhere: `E1303: store <id>: state schema holds s.secret at <path>; state never holds a secret`. It throws, because `store()` reports every construction error that way (duplicate id, bad `logLimit`, invalid `initial`), and it runs first, before the id is registered or `initial` is read. The path comes from `secretPathOf(node)` in `@keel/schema/internal`, the walk `hasSecret` now delegates to (object keys only; array items, record values and union members add no segment). The subpath is internal, read only by `@keel/store`, so there is no second public way. A `snapshot()` part that does not survive its codec throws `E1303: store <id>: snapshot <state|log|initial> at <path> does not persist (<rule>)`; with the construction guard a secret no longer reaches it.

**Coverage.** The static rule is partial by design: it is the early, located signal in the editor and CI, and it misses spreads, computed keys, `s['secret']`, destructured or namespaced `s`, default and barrel exports, namespace imports of a schema file, conditionals, `let` bindings, wrappers around `store`, chains past 8 consts, and for (b) named or imported reducers, `reveal` aliases and helpers (backlog 0258, 0259). The runtime guard is exact for (a). For (b) nothing at run time can tell a revealed string from any other: a revealed value copied into a plain `s.string()` field of a payload or state (`tx(setT, { t: reveal(p.token) })` in a server action) is not detectable statically or at run time, and backlog 0257 stays open as a design item.

## Alternatives
- **A documented limit.** Rejected by the user, and by default 6: a guard is possible.
- **A runtime gate in `tx`, failing a commit whose next state holds a value equal to a revealed payload secret.** That needs the store to compare plaintexts on every commit and still misses derived values (a slice, a hash). A static rule stops both sources before the code runs.
- **Only the static rule for (a).** Rejected after the red-team pass: a dozen ordinary schema shapes escape it, and `snapshot()` threw late, with a generic message, inside recorders, the inspector and server renders (backlog 0259, 0260).
- **Extending E1105 to transaction functions in `*.server.ts`.** E1105 is about where a secret is revealed, in k.schema. Mixing the store concern into it would give one code two meanings.
- **A fix that removes the `s.secret` field.** Rejected as unsafe (above).

## Spec diff
- **k.store** (1,499 -> 1,495 printed).
- **Added.** **Secrets**: "`store()` throws E1303 on a state schema holding `s.secret`." **Rules**: "E1303 `s.secret` anywhere in a store's state schema, or a `reveal` call in a transaction function. Partial (static): skips unresolved schemas, chains past 8 consts, `reveal` in helpers." **Conformance**: "E1303 fires on a nested `s.secret` in a state schema and on `reveal` in a transaction function, not on clean twins." and "`store()` throws E1303 on a state schema with a nested `s.secret`, not on its clean twin."
- **Trimmed: citations.** `(rfc:0070)` after `stores()`, `(RFC 0022)` after **Registries**, `(rfc:0028)`, `(rfc:0054)` and `(rfc:0071)` after the **Log meta**, **Log limit** and **Secrets** headings, and `(runtime form of E1301)` after `store.undeclared`.
- **Trimmed: examples.** `(wire data, a log entry)` after "one typed `unknown`", `(e.g. `{ caller }`)` after the meta record, and the API example's inline `s.object({ item: Item })` payload, now `AddItem`, with `state` shortened to `st`.
- **Trimmed: restatements.** `(each transaction's payload schema by name)` and `(its payload schema)`, which the `payloads` and `schema` conformance clauses state; "an effect reading it reruns when one joins or leaves", which the `stores()` effect clause states; ": meta survives exactly when the log does", which the preceding meta sentence states; ", writing no secret" after the **Secrets** fold, which the secret-payload clause states; ", so a snapshot holds at most `logLimit` entries" after the log-limit fold, which the `restore` log-limit clause states; "(transactions are pure)" in E1302's Rules entry, which the Ownership sentence states; and the `undoWhere` rationale "replaying without a middle entry would reorder or invalidate later ones".
- **Kept.** "Transaction functions must be pure: E1302 on any `ctx` or global access.", "Snapshots reach clients (`#k-state`), so ..." and "from a module counter" stay as they were.

## Conformance diff (rfc:0073)
- Added `packages/check/conformance/E1303-secret-in-state.test.ts`, with a case for a method on a state schema (`Base.extend({ token: s.secret(...) })`).
- Added `packages/store/conformance/secret-state-refused.test.ts` (generated wrappers: object, optional field, array, nullable, record).
- Edited `packages/check/conformance/fixtures-by-code.ts` (an E1303 fixture and clean twin) and `packages/check/conformance/fix-diffs.test.ts` (E1303 in the no-fix list).

## Migration
None. No app or module in the repo holds `s.secret` in a state schema or calls `reveal` in a reducer.

## Token impact
k.store stays under 1,500 printed tokens (above). The E1303 `explain` entry is under 120 tokens.

## Size
Measured gzip against `tooling/budgets.json`: `@keel/check` 32,991 B of 32.5 kB (33,280 B), up from 31,663 B before the rule; `@keel/store` 2,693 B of 3 kB; `@keel/schema` 4,402 B of 5 kB.

## Known limits
- A helper function declared outside the reducer that calls `reveal` is not followed, the same name-based limit as E1302.
- A schema not resolved (above) or past 8 consts is not reported statically; `store()` throws E1303 at construction.
- A revealed value copied into a plain field is not detectable (backlog 0257, open).
- A schema built by a plain function call, imported from a package (`@keel/std-*`) or through a namespace import of `@keel/store` is not resolved.
- `store` and `transaction` are matched as named imports of `@keel/store` only, as E1302 matches `transaction`.

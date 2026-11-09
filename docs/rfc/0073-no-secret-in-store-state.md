# RFC 0073: store state never holds a secret (E1303)

Status: accepted (ADR-0062, 2026-11-09). The user chose a check rule over a documented limit. The design applies the WORKFLOW RFC defaults 6 (kernel-level enforcement over documentation) and 4 (privacy by default: secrets never persist), and default 2 (one way) for what it leaves alone.

## Problem
Backlog 0239, filed by the red-team pass on RFC 0071. The snapshot fold removes secrets from transaction payloads only. A reducer that copies `reveal(p.token)` into a state field writes the plaintext into `state`, into the snapshot `initial`, and from there into `#k-state`, `ctx.storage` and session captures. `packages/store/test/secretFold.test.ts` pins this. Two ways lead there:
1. **A secret in the state schema.** `store(s.object({ token: s.secret(s.string()) }), ...)` holds a `Secret` in state. Nothing static reports it. At run time `snapshot()` throws, because the encoded state carries the marker and fails with `secret-missing`.
2. **`reveal` in a reducer.** A reducer that reveals a payload secret and stores the plaintext in a plain field passes every check. E1105 reports `reveal` only outside `*.server.ts`, and its advice (move the code to a server file) leaves the leak in place.

## Proposal
### E1303 (k.store, `@keel/check`)
One kernel rule, `noSecretInState` in `packages/check/src/rules/`, registered in `KERNEL_RULES`, `see: k.store`. It runs on app files (`isAppPath`) and reports two cases:
- **(a) Schema.** The first argument of a `store(...)` call, where `store` is the `@keel/store` import under any alias, is a schema whose tree holds `s.secret` at any depth. The rule reads the argument statically. It accepts an inline `s.<factory>(...)` chain, an identifier bound to a top-level `const` in the file, and a named import from a relative specifier. An import resolves to a file in `RuleInput.project` and is followed through that file's consts and its own relative imports, up to depth 8 and without revisiting a binding. It walks the call arguments of every chain (`object`, `array`, `record`, `union`, `optional`, ...), and `s` is the `@keel/schema` import under any alias in each file it reads. Anything it cannot resolve, such as a function parameter, a package import or a computed key, adds nothing. The finding is reported at the first argument, and the message names the field path (`creds.token`), because the secret may sit in another file and a rule reports only on its own file.
- **(b) Reducer.** A reference to `reveal`, imported from `@keel/schema` under any alias or reached as `<namespace>.reveal`, inside the function passed as the last argument of a `transaction(...)` call, where `transaction` is the `@keel/store` import. The finding is reported at the reference, so a call `reveal(p.token)` and a value use `.map(reveal)` are both reported. A reducer is pure and returns state, so a revealed value has nowhere else to go.

Messages are one line under 90 characters:
- (a) `store state schema holds s.secret at <path>; state never holds a secret`
- (b) `transaction <name> uses reveal; state never holds a secret` (`?` when the name is not a string literal)

**No fix.** Removing the field leaves the `initial` value and every reducer that writes the field ill-typed, and the field can live in another file, so the edit is not one hunk on the checked file. Removing a `reveal` call leaves a `Secret` where the state type wants a plain value. Both are design changes, so E1303 joins the no-fix list.

**Runtime unchanged.** `snapshot()` still throws for a secret in state. E1303 reports the same case at check time and adds case (b). It is not a second way, because the throw stays the unexpected path for code the rule cannot resolve.

## Alternatives
- **A documented limit.** Rejected by the user, and by default 6: a guard is possible.
- **A runtime gate in `tx`, failing a commit whose next state holds a value equal to a revealed payload secret.** That needs the store to compare plaintexts on every commit and still misses derived values (a slice, a hash). A static rule stops both sources before the code runs.
- **Extending E1105 to transaction functions in `*.server.ts`.** E1105 is about where a secret is revealed, in k.schema. Mixing the store concern into it would give one code two meanings.
- **A fix that removes the `s.secret` field.** Rejected as unsafe (above).

## Spec diff
- **k.store** (1,499 -> 1,499 printed). The **Secrets** paragraph adds "State never holds a secret (E1303)." **Rules** adds "E1303 `s.secret` anywhere in a store's state schema, or `reveal` in a transaction function." **Conformance** adds "E1303 fires on a state schema with a nested `s.secret` and on `reveal` in a transaction function, not on their clean twins." Trims are wording only: two parenthetical examples, the module-counter note, the `#k-state` rationale of log meta, the `undoWhere` rationale, and the Ownership sentence that repeated E1302's Rules entry.

## Conformance diff (rfc:0073)
- Added `packages/check/conformance/E1303-secret-in-state.test.ts`.
- Edited `packages/check/conformance/fixtures-by-code.ts` (an E1303 fixture and clean twin) and `packages/check/conformance/fix-diffs.test.ts` (E1303 in the no-fix list).

## Migration
None. No app or module in the repo holds `s.secret` in a state schema or calls `reveal` in a reducer.

## Token impact
k.store stays under 1,500 printed tokens (above). The E1303 `explain` entry is under 120 tokens.

## Known limits
- A helper function declared outside the reducer that calls `reveal` is not followed, the same name-based limit as E1302.
- A schema built by a function call, imported from a package (`@keel/std-*`) or through a namespace import of `@keel/store` is not resolved.
- `store` and `transaction` are matched as named imports of `@keel/store` only, as E1302 matches `transaction`.

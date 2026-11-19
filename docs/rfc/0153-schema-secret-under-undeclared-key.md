# RFC 0153: k.schema: an open object refuses a `Secret` under an undeclared key

Status: accepted (ADR-0175) under the RFC defaults (4: secrets never persist; 6: enforce in the kernel), for the orchestrator to confirm. For backlog 0261.

## Decisions
- D1: `parse` of an open object fails with rule `type` at the path of each `Secret` found under an undeclared key, at any depth. Undeclared data is already scanned for prototype keys (the same walk), so the check costs no second pass.
- D2: no new rule, error or E-code: a store transaction whose result holds such a `Secret` returns a state its schema refuses, which already throws with nothing committed (`packages/store/src/store.ts`, k.errors "A transaction that throws leaves state and log unchanged").

## Problem
Red-team, read at `cfbb9261`. `store()` throws E1303 on a state schema holding `s.secret`, so the store's design is that state never holds a secret. A transaction that copies a whole payload object breaks it: `(st, p) => ({ ...st, ...p })`, or `user: p.user`, where the payload holds an `s.secret` value and the state schema does not declare that key. A non-literal object has no excess-property check, so it compiles; the open state object ignores the undeclared key, so it commits. Live state then holds a `Secret`, `snapshot()` drops it (the encoding prunes undeclared keys), and snapshot, restore and replay give a different state from live state. Repro: `packages/store/test/secretSpread.test.ts` (state `s.object({ name: s.string() })`, payload `{ name, token: s.secret(s.string()) }`, spread reducer: the committed value's keys are `["name", "token"]`, `snapshot().state` is `{ name: "a" }`).

## Proposal
`packages/schema/src/internal/scanExtras.ts`, which already walks undeclared data without recursion for prototype keys, also reports rule `type` at a value `Secret.is` accepts (and does not descend into it). Nothing else changes: a declared `s.secret` is a declared key, `s.json()` already refuses a `Secret`, a closed object already refuses any undeclared key.

Consequences that follow without code: a transaction spreading a secret into state throws and commits nothing; `store(schema, initial)` with a `Secret` under an undeclared key of `initial` throws; `encode` of such a value throws (an invalid value); a payload whose open object carries an extra `Secret` is `schema.invalid` from `tx` instead of being pruned.

## Alternatives
- Strip undeclared keys at commit (state = `parse(encode(next))`): also aligns live state with snapshots, but copies the whole state per commit, losing structural sharing, so every `get(key)` reader reruns on any commit.
- A store-only check after each commit (walk the new state for a `Secret`): a second walk per commit, and a `Secret` in any other open-object value (a loader result, an action input) would still pass.
- A static check (E1303 on a spread of a payload holding `s.secret`): partial by construction (a helper, a non-literal object); can come later on top of D1.

## Spec diff
k.schema, Closed objects: "(open objects ignore them; `encode` drops them)" becomes "(open objects ignore them, but fail rule `type` at a `Secret` anywhere under one; `encode` drops them)".
k.schema, Conformance, appended as the last bullet (appending keeps the ledger's bullet numbers):
```
- An open object with a `Secret` under an undeclared key, at any depth, fails with rule `type` at the `Secret`'s path.
```
k.store is unchanged: the store's behaviour follows from it.

## Conformance diff
By the `conformance-writer`, under `rfc:0153`: in `packages/schema/conformance/` (beside the closed-object suite), a property over generated open-object values: adding an undeclared key holding a `Secret` (built by parsing a raw value with `s.secret(...)`), directly or nested in objects and arrays under it, fails with exactly one issue, rule `type`, at the `Secret`'s path; the same key holding the secret's marker string or a plain value parses. `packages/store/test/secretSpread.test.ts` (a unit test, not conformance) turns its two `test.fails` into `test` in the build commit and drops its third test, which pins today's behaviour.

## Migration
A value that held a `Secret` under an undeclared key of an open object now fails `parse`. Such a secret was already lost by every encoding; none exist in the repo's apps. A loader or action that returns one now throws `keel.unexpected` where it silently dropped the key.

## Token impact
k.schema +43 tokens (see RFC 0152, Known limits, for the section budget).

## Build order
1. This commit: RFC, ADR, spec diff. 2. `conformance-writer`. 3. Build: `scanExtras` (schema bundle +6 B gzip, measured with a prototype; the package is at its budget after RFC 0152's build), flip `secretSpread.test.ts`. A prototype of the build passed the schema suite (528 tests) and the store suite but the pinned-behaviour test.

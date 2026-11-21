# RFC 0173: std.tokens: `idOf` reads a token's id before `check`

Status: proposed (ADR-0192), for the operator to confirm. For RFC 0158's first question to the operator, decided by the orchestrator: `idOf`, not an async `find`.

## Decisions
- D1: `tokens(ctx).idOf(token: Secret<string>): Result<string, KeelError<'credentials.mismatch', {}>>`, a method of the accessor `@keel/std-tokens/server` exports, additive. `check` and `mint` are unchanged.
- D2: `idOf` returns exactly the id `check` reads and passes to `find`, and refuses exactly the values `check` refuses before it calls `find`: a value not in the token form, and under real or shell a sim token. Its error is the constant `check` returns for them.
- D3: `idOf` reads no row, no digest and no clock. Its answer depends on the presented text and the ctx's mode only, so `ok` says the token is well formed and nothing about whether it was minted, matches a row or has expired.
- D4: it takes the `Secret<string>` an API handler gets as `bearer` or `input.token`, never a revealed string, so an app does not `reveal` a presented token to find its row. The id is the token's non-secret part (`mint` already returns it in the clear); the secret part never appears in a result, an error or a log.
- D5: it is a method of `tokens(ctx)`, not a free function, because the sim-token answer depends on the ctx's mode, as `check`'s does.
- D6: std.tokens grows past the 1,500-token section budget. `spec.section` and `docs.section` (`tooling/budgets.json`), which measure the same section text, are re-based to 1,700 rather than trimming clauses that six conformance files quote.
- D7: no migration (D65 of `tasks/0963-to-p1/PLAN.md`): nothing is released, the change is additive, and golden-2's use lands with RFC 0158's build.
- D8: Keel is not an auth library. `idOf` is token plumbing for a row an app keeps in its own database; it signs no one in and holds no session.

## Problem
RFC 0158 moves golden-2's `accounts.tokens` from a server store into the app's database (k.data). `bearerUser` today calls `tokens(ctx).check(token, find)` with `find` reading the store's rows. `check` takes a synchronous `find` (std.tokens API: "Both are synchronous"), and a database read is asynchronous. The row has to be in hand before `check` runs, which needs its key, the token's id, and the id sits inside the `Secret<string>`. Nothing in std.tokens hands it out: an app would `reveal` the token and parse `keel_<id>_<secret>` itself, which puts the secret in app code, copies the token form into every app and drifts from `check`'s own reading (the sim form, the mode rule).

## Proposal
```ts
// modules/accounts/bearerUser.server.ts
const id = tokens(ctx).idOf(bearer)
if (!id.ok) return id                                   // credentials.mismatch
const row = await tokenRow(ctx, id.value)               // the app's read: Token | undefined
const found = tokens(ctx).check(bearer, () => row)      // Result<Token, E>: the digest, the expiry
```
`check` reads the id again, calls `find` once and compares in constant time as before, so a row fetched for one id and presented with another token's secret is `credentials.mismatch`, and a row the read did not find (`undefined`) is `credentials.mismatch` as it is today.

## Alternatives
- An async `find` (`check(token, find: (id) => Promise<R | undefined>)`): `check` becomes asynchronous for every caller, a store-backed one included, and its "synchronous, never throws" contract and the clock read after the compare move across an `await`. Rejected by the orchestrator.
- An overload, `check` async only when `find` returns a promise: two return types for one name, against one way per thing (RFC defaults 2).
- A free `idOf` export with no ctx: cannot apply the mode rule, so it would return an id for a sim token under real that `check` then refuses; two answers for one input.
- The app parses the revealed token: the secret enters app code, and E1112 tracks the revealed value into every helper it passes through.
- Trim std.tokens to fit 1,500 tokens: the free text is the Purpose and one sentence; the rest is quoted by conformance headers, so the cut would retag six files for about 700 characters.

## Spec diff
- std.tokens: status `conformance-covered` becomes `implemented` (three clauses have no test). The API code block gains `const id = tokens(ctx).idOf(input.token)  // Result<string, E>`. After the "Both are synchronous" bullet, a new bullet: "`idOf(token)` is `ok` with the id `check` reads, so the row can be fetched before `check`; a value `check` answers `credentials.mismatch` without calling `find` gets that constant. It reads no row, digest or clock, so `ok` means well formed, not valid. It is synchronous, never throws, and neither returns nor logs the secret."
- std.tokens Conformance, three bullets after the last (13 to 15):
  - "Under real and sim, `idOf` is `ok` with `id` for a minted token, for it with one `secret` character changed, and under sim for it after expiry."
  - "`idOf` of `hunter2`, `''`, a minted token with one hex letter upper-cased, and under real and shell a sim token equals `check`'s `credentials.mismatch` for `hunter2`."
  - "`JSON.stringify` and `util.inspect` of `idOf` of a minted token hold no `secret`; `idOf` calls no `console` method."
- `spec/std/README.md`: the std.tokens row reads `implemented` and lists `idOf`; "token budget 1,500" becomes 1,700.
- `spec/00-map.md` header: "section 1,500" becomes "section 1,700".
- k.docs Budgets: "`docs.section` 1,500" becomes 1,700.
- Outside `spec/`: `tooling/budgets.json` `spec.section` and `docs.section` 1,500 to 1,700; `docs/OUTPUT.md` the two budget figures; `docs/freeze-review.md` the std.tokens row and the summary count; `tooling/ledger/ledger.json` `std.tokens#13` to `#15` at rung `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0173`, from `pnpm spec std.tokens` (the API bullet and Conformance 13 to 15) and `pnpm spec k.ctx` (sim and real ctxs), new file `packages/std-tokens/conformance/token-id-of.test.ts`, its header quoting the four texts:
- Under real and under sim (seed 1337): `idOf(m.value.token)` is `ok` with `m.value.id`; the same token text with its last `secret` character changed, wrapped by `s.secret(s.string())`, is `ok` with the same id. Under sim, a token minted with `ttl` 60,000 is still `ok` with its id after `advance(60000)`, while `check` of it is `credentials.expired`.
- Under real, `idOf` of `hunter2`, of `''`, and of a minted token with one hex letter upper-cased is `credentials.mismatch` and `toEqual` the result of `check(hunter2, find)`; under real and under shell, `idOf` of a token minted under sim is the same.
- With `console.log`, `info`, `warn`, `error` and `debug` spied: `idOf` of a minted token calls none of them, and neither `JSON.stringify` nor `util.inspect` of its result contains the token's 64-character secret part.
- No existing file changes; their quoted texts are untouched.

## Token impact
std.tokens 1,477 to 1,681 tokens (budget re-based 1,500 to 1,700, D6). Map 1,250-token file budget: one figure changed, same length. k.docs and `spec/std/README.md`: one figure each. Three new Conformance clauses.

## Build order
1. This commit: RFC, ADR-0192, spec text, budgets, ledger rows.
2. `conformance-writer`: `token-id-of.test.ts`.
3. Build: `idOf` in `packages/std-tokens/src/server/Tokens.type.ts` and `internal/tokensOf.ts` (the `TOKEN` match `check` uses, shared, returning `MISMATCH`); property tests in `packages/std-tokens/test/` (for any string, `idOf` is `ok` exactly when `check` calls `find`, with the same id); `packages/std-tokens/README.md`; a changeset (minor); the keel-server skill's Bearer paragraph and the keel-compliance skill's token lines name `idOf` for a row kept in a database; the ledger rungs, std.tokens back to `conformance-covered`, its README row and the freeze-review row.
4. RFC 0158's build (W14 step 3) rewrites golden-2's `bearerUser` and `postToken` over `idOf`.

## For the operator
1. **A new public method on `tokens(ctx)`** (the RFC defaults escalate new user-facing API shapes). Recommendation: confirm; it is the smallest shape that keeps `check` synchronous and the token form inside std.tokens.
2. **The section budget is re-based for every section** (D6), since `tooling/budgets.json` has one `spec.section` and one `docs.section` figure. Recommendation: accept; a per-section figure would be a change to `tooling/budgets.mjs`, a gate change, and the pre-P1 trim review can bring the figure down again.

# RFC 0141: tokens stay, password hashing leaves: `@keel/std-credentials` becomes `@keel/std-tokens`

Status: draft, for the orchestrator to accept (ADR-0163).

## Problem
The operator's direction (2026-11-18, binding; backlog 0863 answered, 0870 opened): Keel is not an authentication library and must not mint, store, rotate or verify sign-in credentials. RFC 0139 made identity a seam: an app's `identify` answers `user`, and sign-in, sessions and their storage belong to the library, platform or proxy behind it (k.user, k.mount). golden-2 signs in through such a library.

`@keel/std-credentials` (RFC 0103, ADR-0126) still holds two things:
- **Password hashing** (std.credentials): `credentials(ctx).hash(secret)` and `.verify(secret, stored)` over scrypt, the `Hashed` schema type, the `std: { '@keel/std-credentials': { ln } }` cost, a per-ctx derivation queue with `keel.busy`, and the codes `credentials.length` and `credentials.malformed` for a stored hash. An app that hashes and verifies passwords is building sign-in by hand, which the framework now tells it not to do; shipping the primitive invites it.
- **Opaque tokens** (std.tokens): `credentials(ctx).mint({ ttl })` and `.check(token, find)`, the `Digested` schema type, the token and digest forms, sim forms. These are an app primitive with no sign-in in them: API keys, invite links, one-time links. golden-2 uses them for its API tokens (`modules/accounts/postToken.server.ts` mints, `bearerUser.server.ts` checks a bearer, `ApiToken.schema.ts` stores `Digested`).

Both live under a name that says the package is about credentials. Read in the tree on 2026-11-18: no app, eval, scaffold template or kernel package calls `hash` or `verify`, or imports `Hashed` or `CredentialsConfig`; the only callers are the package's own tests, conformance and README, `packages/check/src/internal/EXPLANATIONS.ts` (the E1112 fix text) and the docs and skills listed under Migration.

## Proposal

### D1. The package is `@keel/std-tokens`
`packages/std-credentials` becomes `packages/std-tokens`, published as `@keel/std-tokens`, with the same three entries:
- `@keel/std-tokens` (client-safe): `Digested` (`tokens.Digested` in the schema type registry), a schema and its type.
- `@keel/std-tokens/server` (Node, `*.server.ts`): `tokens(ctx)`, with `mint({ ttl })` and `check(token, find)` as today; its type is `Tokens`.
- `@keel/std-tokens/tools`: `serverImport` (E2201) and `nodeDeployable` (E2202) for `@keel/std-tokens/server`.

The capability (k.ctx registry) is `tokens`. Token form (`keel_<id>_<secret>`), digest form (`$sha256$…`), sim forms (`keelsim_`, `$sha256-sim$`), the `ttl` range, the expiry rule, constant-time compare and the E1112 behaviour of a revealed token are unchanged.

Why this name: the spec section is already `std.tokens`, so section id and package name agree as every other stdlib pair does (std.X, `@keel/std-X`); "token" names what the package makes and nothing about who signs in. `docs/GLOSSARY.md` has no term for credential or token (checked 2026-11-18), so no glossary term is renamed. k.ui's design tokens (`tokens.ts`, `defineTokens`) share the word; the section title becomes "Opaque tokens" and the accessor takes a `ctx`, so the two do not meet in code. Alternatives rejected: **`@keel/std-keys`** ("key" is a store key, a write key and an idempotence key already, k.sync); **`@keel/std-secrets`** (`s.secret` and `Secret` are kernel, k.privacy; the package would read as their home); **keep `@keel/std-credentials` with hashing removed** (the name keeps telling readers Keel handles credentials, which the direction rules out).

### D2. Password hashing leaves the framework
Removed with no replacement in Keel: `hash`, `verify`, `Hashed` (`credentials.Hashed`), `CredentialsConfig`, the `ln` cost and its std config key (the package declares no std config), the derivation queue and its `keel.busy`, the scrypt stored form, `credentials.length`. A password is the identity source's (k.user): the app's sign-in library hashes, stores and verifies it. `spec/std/std.credentials.md` is deleted. No other feature is cut: `mint`, `check`, `Digested`, E2201, E2202 and the capability stay, renamed only where D1 says.

### D3. Result codes keep their names
`credentials.mismatch`, `credentials.expired`, `credentials.malformed` (reasons `format`, `parameters`, `sim`) and `credentials.ttl` stay as they are. Six of std.tokens' ten Conformance bullets name them, and existing bullets are not reworded; the ledger keeps their items. A token is a credential the app issues to its callers, so the codes still describe what was presented. `credentials.malformed`'s reasons, defined until now by reference to std.credentials, are stated in std.tokens itself. Alternative rejected here, open for the operator (Open questions 1): **`tokens.*` codes**, consistent with the package name, at the cost of rewording six bullets and their conformance headers.

### D4. The rules move with the entry
E2201 and E2202 keep their codes, their reach and their limits, and name `@keel/std-tokens/server`. Their text moves from std.credentials Rules into std.tokens Rules; std.credentials' two rule bullets (#13 and #15) are re-stated as two new bullets appended to std.tokens Conformance with the new package and capability names. E220x stays one block, owned by std.tokens in the map.

### D5. Diagnostics, one by one
| Diagnostic | Owner before | After |
| --- | --- | --- |
| E2201 server entry outside `*.server.ts` | std.credentials | std.tokens, names `@keel/std-tokens/server` |
| E2202 server entry in a non-`node` module | std.credentials | std.tokens, the same |
| `credentials.mismatch`, `credentials.expired`, `credentials.ttl` | std.tokens | unchanged |
| `credentials.malformed` `format` / `parameters` / `sim` | std.credentials (reasons), std.tokens | std.tokens, reasons stated there |
| `credentials.length` | std.credentials | removed (password input only) |
| `keel.busy` from the derivation queue | std.credentials | no longer raised by this package; the kernel code stays |
| E1158 for a bad `ln` | std.credentials (k.module code) | no longer raised by this package; the kernel code stays |
| E1112 explanation's fix text | `@keel/check` | names a minted token's `digest` (`@keel/std-tokens`), no `hash` |

No diagnostic code is freed or renumbered.

## Spec diff
- `spec/std/std.tokens.md` (4,869 to 5,897 characters, 1,218 to 1,475 tokens):
  - Title "Tokens" becomes "Opaque tokens". Status `conformance-covered` becomes `implemented` here and in `spec/std/README.md`, as RFC 0133 set k.resume while appended clauses had no evidence; it goes back with the conformance commit.
  - Purpose rewritten: opaque tokens for API keys, invite links and one-time links; no password is hashed here; sign-in is the identity source's (k.user).
  - New Extension points paragraph: capability `tokens`, schema type `tokens.Digested`, check rules from `@keel/std-tokens/tools` (E2201, E2202), `deps`.
  - API: the entry sentence and the example name `@keel/std-tokens` and `tokens(ctx)`. In the `check` bullet, "An unreadable `digest` is `credentials.malformed`, with std.credentials' reasons." becomes "An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim)." `(credentials.Digested)` becomes `(tokens.Digested)`.
  - Rules: E2201 and E2202 stated in full, as std.credentials stated them, with `@keel/std-tokens/server`.
  - Conformance: bullets 1 to 10 unchanged. Appended as 11 and 12: "E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `tokens`." and "`import('@keel/std-tokens/server')` outside a `*.server.ts` file is E2201; `import type` from it is not."
- `spec/std/std.credentials.md` deleted (5,842 characters, 1,461 tokens; 15 Conformance bullets). Its ledger items `std.credentials#1` to `#15` leave with it: #13 and #15 are re-stated as std.tokens #11 and #12 (D4); the other thirteen are password hashing (D2).
- `spec/std/README.md`: the std.credentials row is removed; the std.tokens row reads `| std.tokens | Opaque tokens | implemented | capability, schema type and check rule registries: `mint` with a ttl, `check`, `Digested`, E2201-E2202 |`; the S8 line lists std.tokens without std.credentials.
- `spec/00-map.md`: the E220x owner is std.tokens. 4,794 to 4,789 characters (1,199 to 1,198 tokens).
- No kernel section names std.credentials or the package (`grep` over `spec/kernel`, 2026-11-18). No other section changes.

## Conformance diff
One `rfc:0141` commit by the `conformance-writer`, in `packages/std-tokens/conformance/` (the folder moves with the package):
- Deleted (password hashing, std.credentials only): `busy.test.ts`, `config-throw.test.ts`, `cost.test.ts`, `errors.test.ts`, `length.test.ts`, `round-trip.test.ts`, `sim.test.ts`, `stored-form.test.ts`.
- `rules.test.ts`: headers quote std.tokens Rules and bullets 11 and 12; fixtures import `@keel/std-tokens/server`; `capabilities()` lists `tokens`; the case for "A `*.server.ts` action passing the value of `credentials(ctx).hash(input.password)` to `tx` has no E1112 or E1105." is removed with its bullet.
- `mint.test.ts`, `token-check.test.ts`, `token-e1112.test.ts`, `token-expiry.test.ts`, `token-sim.test.ts`: imports from `@keel/std-tokens` and `@keel/std-tokens/server`, `tokens(ctx)` in place of `credentials(ctx)`; the two `token-check.test.ts` headers quoting the changed API sentences (the unreadable-digest sentence and the `Digested` sentence) re-quote them. No assertion changes; the writer adds a case to `token-check.test.ts` for each shape the new reason text names that no case asserts yet (for example a 31-byte digest is `parameters`).
- `fixtures.ts`: `Hashed`, `hashedOf`, the `verify` helpers and `PKG` for the old name go; `PKG` is `@keel/std-tokens`.
- `packages/check/conformance/e1112-return-0104.test.ts`: `CREDENTIALS_IMPORT` imports `tokens` from `@keel/std-tokens/server` and calls `tokens(ctx).mint`; its quoted k.reveal clauses are unchanged.

## Migration
For an app on `@keel/std-credentials` (the migration note the changeset carries):
- Tokens: replace the dependency with `@keel/std-tokens`; `import { Digested } from '@keel/std-tokens'`; `import { tokens } from '@keel/std-tokens/server'`; `credentials(ctx).mint` and `.check` become `tokens(ctx).mint` and `.check`; a module's `deps` names `@keel/std-tokens`. Stored digests and issued tokens keep working: their forms and the result codes are unchanged. Under sim, the tokens a seed gives change, since the capability's name feeds its seed (k.ctx).
- Passwords: `hash`, `verify`, `Hashed` and the `ln` config have no replacement in Keel. Hash and verify passwords in the sign-in library behind the identity source (k.user, k.mount). A stored `$scrypt$ln=…` string is `scrypt` from `node:crypto` with N = 2^ln, r = 8, p = 1, a 16-byte salt and a 32-byte key in base64 without padding, so a library or the app can verify it once and rehash to its own form. A `std: { '@keel/std-credentials': … }` entry is removed.

For the builder (commit 3), everything that names the package today:
- **Package.** `git mv packages/std-credentials packages/std-tokens`; `package.json` name; delete `src/Hashed.ts`, `src/CredentialsConfig.ts`, `src/internal/isHashed.ts`, `src/server/internal/{busy,costOf,gate,inputOf,LENGTH,readHashed}.ts` and the hash halves of `Engine`, `realEngine`, `simEngine`, `hasherOf`; `src/server/credentials.ts` becomes `tokens.ts` (`register("tokens", …)`, no cost), `Hasher` becomes `Tokens`; `src/tools/*` messages and comments name `@keel/std-tokens/server` and std.tokens; tests `bindOrder`, `costOf`, `CredentialsConfig`, `gate`, `readHashed`, `verify` go, the rest follow the rename; `test/reach.test.ts` follows E2201/E2202; README rewritten for tokens only (the "Tokens in an API route" example stays), with the migration note. Dependencies stay (`@keel/compiler` for `parseTopology` in E2202; `costOf`'s `stdConfig` import goes).
- **Check.** `packages/check/src/internal/EXPLANATIONS.ts` E1112 fix: "pass the Secret itself, or store the `digest` a minted token gives (@keel/std-tokens)".
- **golden-2.** `package.json` dependency; `modules/accounts/module.ts` `deps`; `ApiToken.schema.ts`, `bearerUser.server.ts`, `postToken.server.ts`, `test/accounts.test.ts` imports and `tokens(ctx)`; `README.md` line 22; `.keel/surface.json` regenerated by its build.
- **Tooling.** `tooling/budgets.json`: the three `@keel/std-credentials` keys become `@keel/std-tokens` (`1kb`), `@keel/std-tokens/server` (`3kb`, node), `@keel/std-tokens/tools` (`1.25kb`, node); re-measure and lower if the server entry shrank, never raise. `tooling/ci-shards.mjs` key; `tooling/deps.json` order entry; `pnpm-lock.yaml` by `pnpm install`; `tooling/ledger/ledger.json`, `tooling/ledger/evidence.json` and `tasks/COVERAGE.md` regenerated on a quiet tree.
- **Docs and skills.** `docs/COMPLIANCE.md` Credentials paragraph becomes a Tokens paragraph (digest stored, token sent once, a `ttl` for every invite and one-time link, `Digested` kept out of loader outputs; passwords are the identity source's); `docs/THREAT-MODEL.md` Credentials bullet becomes a Tokens bullet (std.tokens) without the scrypt and E1158 text, and states that Keel hashes no password; `docs/ARCHITECTURE.md` line 9 package name; `.claude/skills/keel-architecture/SKILL.md` line 11, `keel-compliance` line 12, `keel-storage` line 20 (no `hash`; store a minted token's `digest`).
- **Records.** `.changeset/std-credentials.md` replaced by a `@keel/std-tokens` minor changeset carrying the migration note; `.changeset/explain-e1112-credentials.md` names the token digest; RFC 0103 gains an Amendment section naming this RFC; ADR-0126's status reads superseded in part by ADR-0163.
- **Backlog and future list** (orchestrator): 0639 (argon2id), 0641 (sim `keel.busy`) and 0648 (lower-`ln` rehash) close as moot; 0638 keeps `Digested` only; 0640 and 0676 rename; `tasks/FUTURE.md` drops "`r` and `p` settable" and renames the token-prefix line.
- **Evals.** None: no eval task, spec slice or hidden suite names the package (`grep` over `evals/`, 2026-11-18).

## Build order
1. This RFC, ADR-0163, std.tokens, the deleted std.credentials, the std README and the map (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red until the rename; std.tokens back to `conformance-covered` in the section and the README.
3. Builders (commit 3): the package rename and removal, the check explanation, golden-2, tooling, docs, skills and records above; ledger and evidence on a quiet tree.

## Token impact
std.tokens 1,218 to 1,475. std.credentials 1,461 removed. Map 1,199 to 1,198. Net spec: 1,204 fewer tokens.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the package is `@keel/std-tokens`, accessor `tokens(ctx)`, type `Tokens`, capability `tokens`, schema type `tokens.Digested` (D1).
- C2: hashing, `Hashed`, the cost config, the queue and `credentials.length` are removed with no replacement in Keel; std.credentials is deleted (D2).
- C3: the result codes keep the `credentials.` prefix (D3).
- C4: E2201 and E2202 keep their codes and move to std.tokens; their two bullets are re-stated there (D4).

## Open questions
1. **Code prefix.** D3 keeps `credentials.*` because six existing Conformance bullets name those codes and bullets are not reworded. `tokens.mismatch`, `tokens.expired`, `tokens.malformed` and `tokens.ttl` would match the package; they need the operator's leave to reword std.tokens bullets 2, 5, 6, 7, 8 and 9 (their ledger items keep their numbers) and change every stored app check of `error.code`. Recommendation: keep the prefix now; take the rename, if wanted, before the first public release.

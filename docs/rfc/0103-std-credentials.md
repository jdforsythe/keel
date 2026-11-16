# RFC 0103: std-credentials (hash and verify a `Secret`, mint and check a token; stored forms whose parameters can rise)

Status: proposed; revised 2026-11-16 for the user's answers (accessor and error Result approved; cost configurable upward from the 2^17 floor; API tokens in the first version). The user approves the revised shape before any build. For backlog 0615. Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0126 records it.

## Decisions
- D1: a new stdlib package, `@keel/std-credentials`, with two spec sections, std.credentials (passwords) and std.tokens, and three entries. `.` exports the schemas `Hashed`, `Digested` and `CredentialsConfig` and is client-safe, since `*.schema.ts` files are shared. `./server` exports the accessor `credentials` and is Node only. `./tools` registers two check rules. A module that uses the package lists it in `deps`. The package calls `reveal` once, inside `./server` (defaults 4, 5).
- D2 (approved): the API is a capability accessor, `credentials(ctx)`. `hash(secret)` and `verify(secret, stored)` take the `Secret<string>` and are async. `hash` resolves a `Hashed`. `verify` resolves `ok({ rehash })` only when the secret matches; a wrong secret is `err` `credentials.mismatch`, and nothing throws. `stored` may be `undefined` for an unknown account, which costs one derivation and answers `credentials.mismatch` (defaults 2, 4).
- D3: `scrypt` from `node:crypto`. The cost is N = 2^`ln` with r = 8 and p = 1, and `ln` is 17 by default and at the least. An app raises it, never lowers it, in one place: `std: { '@keel/std-credentials': { ln } }` in a module manifest, an integer 17 to 20. A value under 17 or over 20 is the kernel's E1158 at `keel check`, `keel build` and startup. The stored form names its parameters, `$scrypt$ln=17,r=8,p=1$<salt>$<key>`, and `verify` answers `rehash: true` for a string below the configured cost (defaults 3, 4; Questions 2).
- D4: salts and tokens come through the capability, and the real and seeded sources never mix. Under a real ctx every random byte is `randomBytes` of `node:crypto`; `ctx.random` is not used. Under a sim ctx the bytes come from the capability seed, every string and token is marked (`$scrypt-sim$`, `keelsim_`, `$sha256-sim$`), and a real ctx refuses them (defaults 1, 4, 6; Questions 7).
- D5: one derivation at `ln` 17 takes about 170 ms and 128 MiB, and each step up doubles both. The real implementation runs derivations on the thread pool, bounded per ctx by the configured `ln`: 2 at once at 17 and 18, 1 at 19 and 20, with 16, 8, 4 or 2 waiting in call order. A call past that resolves the kernel's `keel.busy`, a 503 from an action (default 3).
- D6: it runs in a `node` deployable only. E2201 reports the server entry imported outside a `*.server.ts` file, and E2202 reports it in a module a `client` or `static` deployable serves, which is also where a shell's code lives (defaults 5, 6).
- D7: tokens are in. `credentials(ctx).mint()` gives a new token as a `Secret<string>`, its non-secret `id`, and a `Digested` to store. `credentials(ctx).check(token, find)` looks the row up by the id inside the presented token and compares in constant time. The hash is SHA-256 with no key, sound because every stored digest comes from `mint`, which draws 256 random bits. A password cannot take this path: `mint` takes no input (defaults 2, 4; Questions 3 to 6).
- D8: the hand-written form leaves the docs. k.privacy, the E1112 explain row, two skills and the threat model name `credentials(ctx)` where they name `scrypt` and `timingSafeEqual` today (default 2).
- D9: two kernel gaps limit how a token travels, and this RFC does not paper over them. A write returns `Href | null`, so the response that creates an API token cannot carry it; and no request header reaches server code, so a token is presented in an action's input, not in `Authorization`. Both are for a kernel RFC (default 1; Questions 1).
- Budget: three new entries, `@keel/std-credentials` 1kb, `@keel/std-credentials/server` 3kb and `@keel/std-credentials/tools` 1.25kb.

New codes: E2201, E2202 (std.credentials, block E220x). New KeelError codes: `credentials.length`, `credentials.mismatch`, `credentials.malformed`.

## Problem
Measured on `jdforsythe/test-impl` at `dfff457f` and re-measured at `f8e926d2`, Node 24.19.0, darwin, a shared machine.

**What the docs tell an app to write.** k.privacy Secrets says: "A credential is kept as a value derived from it in server code: a salted hash to check it (`node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual`)." Neither the kernel nor any std package has a helper (RFC 0100 D3, Questions 1). An app that follows the sentence writes the salt, the derivation, the encoding and the comparison by hand, and each of these is a way to get them wrong:
- `scryptSync(v, salt, 64)` uses Node's defaults, N = 2^14, r = 8, p = 1: 16 MiB and 18.7 ms here. OWASP's minimum for scrypt is N = 2^17 (see D3).
- Passing N = 2^17 without `maxmem` throws `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` ("memory limit exceeded"), since Node's default `maxmem` is 32 MiB and the call needs 128 MiB.
- `scryptSync` at N = 2^17 blocks the event loop for 163 ms per sign-in.
- `timingSafeEqual` throws a `RangeError` when the two lengths differ, and app code may not `try` (E1452).
- The parameters are not in the stored value, so they can never be raised for accounts that exist.
- The file holds `reveal` next to `tx`. E1112 ends a flow at any call it does not know (k.reveal), so it cannot tell `scrypt` from MD5. Its own conformance case is `tx(t, { v: scryptSync(reveal(p.k), 's', 64).toString('hex') })`, with the constant salt `'s'` (`packages/check/conformance/privacy-e1112.test.ts:406-409`), and that case is correct for the rule: it checks that a call stands between the value and the sink, not which one.
- An unknown account answers at once and a known one after a derivation, which tells a caller which emails have accounts.

**Tokens.** An API token is checked on every request, so it cannot pay a password's cost; a reset or invite token is checked once and must not be stored as it was sent. Nothing in Keel mints either. `ctx.random.id` is "the one way to mint an id or token" (k.ctx) and gives 122 random bits as a uuid, with no digest to store and no mark on what a sim made.

**What exists today.** No `s.secret`, `reveal` or `scrypt` in `apps/`, `modules/`, `evals/` or any `packages/std-*/src`. `scrypt` appears in two places: the E1112 explain row (`packages/check/src/internal/EXPLANATIONS.ts:171`) and the conformance case above.

**What `ctx.random` offers.** `Random` is `{ id(brand), float() }` (`packages/ctx/src/Random.ts`). In a real ctx `id` is `crypto.randomUUID()` and `float` is `Math.random()` (`internal/realRandom.ts`). In a sim ctx both draw from one xoshiro128** stream by seed (`internal/simRandom.ts`). There is no bytes method, and k.ctx does not say where a real `id` comes from. A production server always builds a real ctx (`packages/server/src/internal/start.ts:65`); `createCtx()` with no mode is sim only when `KEEL_TEST=1` (`internal/defaultMode.ts`).

**Where a setting can live.** A module manifest's `std` entry holds literal JSON per stdlib package in its `deps`. The package registers a schema under its name, and a value that fails it is E1158 at `keel check`, `keel build` and `createApp` (k.module Std config). `keel build` writes every module's entry to `std.json`, and a package reads it with `stdConfig(ctx, pkg, Config)`, `{}` on a ctx no `createApp` bound. `keel check` loads a package's `./tools` only when a module's `deps` names the package (THREAT-MODEL Stdlib loading). std.jobs sets its `concurrency` this way.

**Where a key could come from.** `KEEL_SECRET` is parsed from the environment by the generated entry and given to `createApp({ secret })`, which signs the caller cookie with it (k.deploy, k.server). No accessor hands it, or any other environment value, to app or stdlib code (RFC 0100 Questions 2).

**How a token can travel.**
- Out. An action returns `Result<Href | null, KeelError>` (`packages/router/src/action.ts:10`, k.server API). A write's JSON answer is that `Result` (k.api), so it holds a link or nothing. A loader returns data and saves nothing. The response that creates a token cannot carry it.
- In. A guard gets `{ url, caller }`, a loader `{ params, search, url, caller, stores }`, an action its input and `{ params, url, caller, stores }` (k.guards, k.server). None sees a request header, and the allowed cross-origin request headers are `accept`, `content-type` and `x-keel` (k.hosting). A token arrives in an action's input or in the URL.
- What works today: a token sent out of band through a `service` or `ctx.net.fetch` call from the action that minted it, and presented later as an `s.secret` field of an action's input.

**Where it can run.** `engines.node` is `>=22` and the deploy image is `node:22-slim` (k.deploy). `crypto.scrypt` is in every supported Node. `crypto.argon2` exists in the local Node 24.19 and not in Node 22.

**Cost, measured** (`scryptSync`, 32-byte key; the first six rows are one run, the last three a second run on a busier machine):

| `ln` | r | p | Memory | Time |
| --- | --- | --- | --- | --- |
| 17 | 8 | 1 | 128 MiB | 162.5 ms |
| 16 | 8 | 2 | 64 MiB | 157.1 ms |
| 15 | 8 | 3 | 32 MiB | 115.2 ms |
| 14 | 8 | 5 | 16 MiB | 92.1 ms |
| 14 | 8 | 1 | 16 MiB (Node's default) | 18.7 ms |
| 4 | 8 | 1 | 16 KiB | under 0.1 ms |
| 18 | 8 | 1 | 256 MiB | 355 ms |
| 19 | 8 | 1 | 512 MiB | 726 ms |
| 20 | 8 | 1 | 1 GiB | 1,459 ms |

- Input length does not move the cost: 64 bytes took 163.5 ms and 1 MiB took 165.5 ms, since scrypt reads the input in one HMAC pass.
- Eight async calls at N = 2^17 started at once finished in 351 ms with the process at 594 MiB: the thread pool ran 4 at a time, 128 MiB each, and file reads and DNS lookups waited behind them.
- SHA-256 over an 86-character token plus a constant-time compare: 0.6 microseconds.

## Proposal

### API
Everything an app can import. One export per file; the filename is the export.

| Entry | Export | Runs |
| --- | --- | --- |
| `@keel/std-credentials` | `Hashed`, `Digested`, `CredentialsConfig` (each a schema and its type) | anywhere |
| `@keel/std-credentials/server` | `credentials`, type `Hasher` | Node, in `*.server.ts` |
| `@keel/std-credentials/tools` | `serverImport` (E2201), `nodeDeployable` (E2202) | `keel check` loads it; apps do not import it |

```ts
// @keel/std-credentials
import type { Format, Schema } from '@keel/schema'
export const Hashed: Schema<Format<string, 'credentials.Hashed'>>
export type Hashed = Format<string, 'credentials.Hashed'>
export const Digested: Schema<Format<string, 'credentials.Digested'>>
export type Digested = Format<string, 'credentials.Digested'>
export const CredentialsConfig: Schema<{ readonly ln?: number }>   // s.object({ ln: s.int({ min: 17, max: 20 }).optional() }, { closed: true })
export type CredentialsConfig = { readonly ln?: number }

// @keel/std-credentials/server
import type { Ctx } from '@keel/ctx'
import type { KeelError, Result, Secret } from '@keel/schema'
type Busy = KeelError<'keel.busy', { readonly limit: number }>
type Mismatch = KeelError<'credentials.mismatch', Record<string, never>>
type Malformed = KeelError<'credentials.malformed', { readonly reason: 'format' | 'parameters' | 'sim' }>
export const credentials: (ctx: Ctx) => Hasher
export interface Hasher {
  // passwords (std.credentials)
  hash(secret: Secret<string>): Promise<Result<Hashed,
    KeelError<'credentials.length', { readonly min: 1; readonly max: 1024 }> | Busy>>
  verify(secret: Secret<string>, stored: Hashed | undefined): Promise<Result<{ readonly rehash: boolean },
    Mismatch | Malformed | Busy>>
  // tokens (std.tokens)
  mint(): { readonly token: Secret<string>; readonly id: string; readonly digest: Digested }
  check<R extends { readonly digest: Digested }>(token: Secret<string>, find: (id: string) => R | undefined):
    Result<R, Mismatch | Malformed>
}

// @keel/std-credentials/tools
import type { RuleDef } from '@keel/check'
export const serverImport: RuleDef   // E2201
export const nodeDeployable: RuleDef // E2202
```

**`Hashed`.** A format type over `s.string()` (k.schema Format types), registered as `credentials.Hashed`. A store's state schema names it for the field that holds a password's hash: `password: Hashed`. It accepts `$id$params$salt$key`, with `$v=<n>` allowed after the id, at most 256 characters. It checks the shape and nothing else, so a string a later version wrote still restores after a rollback. Its generator gives well-shaped sim-form strings that match no secret. `encode` is the string's, `doc()` is `credentials.Hashed`, and JSON Schema adds `format: credentials.Hashed`.

**`Digested`.** The same kind of type for a token's digest, registered as `credentials.Digested`: `$id$digest`, at most 128 characters, shape only, sim-form strings from its generator. A token row is any object with `digest: Digested`.

**`CredentialsConfig`.** The schema of the package's `std` entry, registered under `@keel/std-credentials`. One key, `ln`. An app does not import it; the manifest's `std` literal is checked against it.

**`credentials(ctx)`.** The accessor of capability `credentials` (k.ctx `register`): one `Hasher` per ctx, built on first use at the ctx's configured cost. Importing the entry registers the capability.

**`hash(secret)`.** Resolves `ok(stored)`, a new `Hashed` with a fresh salt at the ctx's cost. Two calls with one secret give two different strings. Errors:

| Code | Data | When |
| --- | --- | --- |
| `credentials.length` | `{ min: 1, max: 1024 }` | the input is empty or over 1,024 bytes |
| `keel.busy` | `{ limit }` | the ctx's queue is full (D5); `limit` is 16, 8, 4 or 2 |

**`verify(secret, stored)`.** Resolves `ok({ rehash })` when the secret matches `stored`, and never otherwise. `rehash` is `true` when `stored` is below the ctx's cost: its `ln` is lower, its salt is under 16 bytes, or its key is under 32 bytes. The caller then calls `hash` and stores the result. A string at a higher `ln` than the ctx's verifies with `rehash: false`; nothing is ever rehashed downward. Errors:

| Code | Data | When |
| --- | --- | --- |
| `credentials.mismatch` | `{}` | the secret does not match; or `stored` is `undefined`; or the input is one `hash` refuses |
| `credentials.malformed` | `{ reason: 'format' }` | `stored` is not a `Hashed` string |
| `credentials.malformed` | `{ reason: 'parameters' }` | `stored` has an id or parameters this version does not read |
| `credentials.malformed` | `{ reason: 'sim' }` | `stored` is the sim form and the ctx is real or shell |
| `keel.busy` | `{ limit }` | the ctx's queue is full |

**`mint()`.** Synchronous, no input, no error. Returns:
- `token`: the new token as a `Secret<string>`. It prints as `[secret]` everywhere, and its text is read with `reveal` in the `*.server.ts` file that sends it.
- `id`: the token's non-secret part, 16 lowercase hex characters. The app stores it as the row's key, and may show or log it.
- `digest`: the `Digested` to store.

**`check(token, find)`.** Synchronous. It reads the id from the presented `Secret<string>`, calls `find(id)` once to get the row, compares the token's SHA-256 with the row's `digest` in constant time, and returns `ok(row)`, the object `find` returned, typed as the app's row. Errors:

| Code | Data | When |
| --- | --- | --- |
| `credentials.mismatch` | `{}` | the presented value is not in the token form (`find` is not called); or `find` returns `undefined`; or the digest does not match; or it is a sim token and the ctx is real or shell |
| `credentials.malformed` | `{ reason: 'format' }` | the row's `digest` is not a `Digested` string |
| `credentials.malformed` | `{ reason: 'parameters' }` | the row's `digest` has an id this version does not read |
| `credentials.malformed` | `{ reason: 'sim' }` | the row's `digest` is the sim form and the ctx is real or shell |

**Every error.** Each is one constant value per code, `reason` and `limit`. `message` is the code, plus `: <reason>` for `credentials.malformed`, and a fixed sentence for `keel.busy`. None holds any part of a secret, a token or a stored string. No method throws or rejects: a derivation Node refuses to run resolves `keel.busy`. An action that returns one of them as is answers 400, and 503 for `keel.busy` (k.server Status). E1453 already reports a `verify` or `check` whose result is dropped.

**The cost setting.** One line in a module manifest, read the same way by every `credentials(ctx)` call:

```ts
// modules/accounts/module.ts
export default module({ id: 'accounts', deps: ['@keel/std-credentials'], capabilities: ['random'],
  std: { '@keel/std-credentials': { ln: 18 } }, public: { exports: [], routes: [] } })
```

`ln: 16` gives, from the prototype: `E1158 modules/accounts/module.ts:2 std config for @keel/std-credentials fails its schema at ln (min)`. The fix is to set `ln` from 17 to 20 or remove the entry.

**Example 1: a password.** Sign-up and sign-in, one file each, imports left out. `SignIn` is `s.object({ email: s.string({ min: 3, max: 254 }), password: s.secret(s.string({ min: 12, max: 128 })) })`; the store's user rows hold `password: Hashed`.

```ts
// modules/accounts/postSignUp.server.ts
export const postSignUp = action({ input: SignIn, stores: accountStores }, async (input, { stores }, ctx) => {
  const hashed = await credentials(ctx).hash(input.password);
  if (!hashed.ok) return err(hashed.error);
  const r = tx(stores.addUser, { id: ctx.random.id("User"), email: input.email, password: hashed.value });
  return r.ok ? ok(null) : err(r.error);
});
// modules/accounts/postSignIn.server.ts
export const postSignIn = action({ input: SignIn, stores: accountStores }, async (input, { caller, stores }, ctx) => {
  const user = stores.accounts.get("users").find((u) => u.email === input.email);
  const checked = await credentials(ctx).verify(input.password, user?.password);
  if (!checked.ok) return err(checked.error);
  const fresh = checked.value.rehash ? await credentials(ctx).hash(input.password) : undefined;
  const password = fresh?.ok ? { password: fresh.value } : {};
  const r = tx(stores.signedIn, { email: input.email, caller, ...password });
  return r.ok ? ok(null) : err(r.error);
});
```

The sign-in file has no branch for an unknown email: `user?.password` is `undefined`, `verify` spends one derivation and answers `credentials.mismatch`, the same answer in about the same time as a wrong password. Lines 5 to 7 of `postSignIn` are the whole rehash path, and they also move an account up when the app raises `ln`.

**Example 2: an API token.** Created by a signed-in user, then presented by a script on a later request. Token rows are `{ id: s.string(), digest: Digested, userId: s.id('User') }`. `Report` is `s.object({ token: s.secret(s.string({ max: 128 })), text: s.string({ max: 2000 }) })`. `mail` is a `service` over a mail provider.

```ts
// modules/accounts/postToken.server.ts
export const postToken = action({ input: TokenRequest, stores: accountStores }, async (input, { caller, stores }, ctx) => {
  const minted = credentials(ctx).mint();
  const r = tx(stores.addToken, { id: minted.id, digest: minted.digest, caller });
  if (!r.ok) return err(r.error);
  const sent = await mail.send({ body: { to: input.email, text: reveal(minted.token) } }, ctx);
  return sent.ok ? ok(null) : err(sent.error);
});
// modules/accounts/postReport.server.ts
export const postReport = action({ input: Report, stores: accountStores }, (input, { stores }, ctx) => {
  const found = credentials(ctx).check(input.token, (id) => stores.accounts.get("tokens").find((t) => t.id === id));
  if (!found.ok) return err(found.error);
  const r = tx(stores.addReport, { userId: found.value.userId, text: input.text });
  return r.ok ? ok(null) : err(r.error);
});
```

Line 5 of `postToken` is the one place the token leaves, and here it leaves through a mail service because that is what the kernel allows today: an action cannot return data (Problem). When it can, that line becomes the action's own answer, `return ok({ token: reveal(minted.token) })`, and nothing else in either file changes. A failed send returns `err`, which saves nothing, so no row is kept for a token nobody received. `postReport` takes the token in its input, since no header reaches an action.

All four files typecheck under `@keel/compiler/tsconfig.strict.json` against the prototype, and `check` reports nothing on them.

### D1. Name and entries
`@keel/std-credentials`, the name RFC 0100 Questions 1 proposed. Three entries, because three kinds of code import it:
- A `*.schema.ts` file names `Hashed` or `Digested`, and schema files are shared with client code, so `.` imports nothing from Node. It also holds `CredentialsConfig`, since `keel check` and `createApp` both import the root to find the registered schema. It is 633 B.
- A `*.server.ts` file calls `credentials(ctx)`. `./server` imports `node:crypto`, as `@keel/std-channels/server` is the Node half of that package.
- `keel check` loads `./tools`.

A module that uses the package lists `@keel/std-credentials` in its manifest's `deps`. That is what makes `keel check` load the rules, and what lets the manifest carry the `std` entry (k.module). The package has no `module.ts`: it has no route and no store, as `@keel/std-text` has none.

**Why E1112 and E1105 stay silent on the documented use.** E1112 starts at a call of `reveal` and reports the value at a closed list of sinks: `tx`, `store`, a `ctx.storage` write, `console`, `process.stdout` and `process.stderr`, the `node:fs` writes, an `Error`, `Promise.reject` and a `throw` (k.reveal).
- Passwords. The app file has no `reveal`: it passes `input.password`, the `Secret`, as is. The string `hash` resolves is the result of a call the rule does not know, which ends any flow.
- A presented token. `check(input.token, find)` takes the `Secret` too.
- A minted token. The app writes `reveal(minted.token)` once, in a `*.server.ts` file, which E1105 allows. The rule follows that value. In a `service` or `ctx.net.fetch` argument it enters a call that is no sink; in a returned value it meets no sink either, since RFC 0100 D4 keeps responses off the list on purpose. So the documented line is silent. `minted.id` and `minted.digest` are members of a call the rule does not know and carry nothing.
- The mistakes are caught. In the prototype, `tx(t, { token: reveal(minted.token) })` and `console.log(reveal(minted.token))` are each one E1112.

k.reveal needs no new line. The one `reveal` in the package is in `src/server/internal/textOf.ts`; a password's text is normalized into a byte buffer, given to `scrypt` and zeroed, and a token's text goes to SHA-256. The lane adds a test that gives the package's own server files to `check` under an app path and expects no E1112.

### D2. The password API (approved)
- **An accessor.** `hash` and `verify` need per-mode implementations (D4) and per-ctx state (D5), which is what a capability is (GLOSSARY). std.geo already spells a capability `geo(ctx).position()`.
- **`Secret<string>` in.** A plain string is a type error. A value the app holds as a string is parsed with `s.secret(s.string())` first, which is the same step that keeps it out of logs.
- **`Hashed` out.** A branded string that cannot be turned back into the secret. E1112 sees no revealed value in it (D1), and a store, a snapshot and std.db keep it as written.
- **Async.** The real derivation runs on the thread pool.
- **A wrong secret is `err`.** With `ok({ valid: false })`, the line `if (!r.ok) return err(r.error)` would let a wrong password through, and that line is the one every Keel action already writes.
- **`rehash` is a flag, and the caller rehashes.** `verify` could return the new string itself, at the price of a hidden second derivation and a salt drawn inside a check.
- **`stored: Hashed | undefined`.** The unknown-account case is in the signature, so the equal-time answer is the default path.

### D3. Algorithm, stored form and the cost setting
**Guidance, from knowledge; the lane re-checks it at build time and records the date in the package README.** The OWASP Password Storage Cheat Sheet puts Argon2id first (at least 19 MiB of memory, 2 iterations, 1 lane) and scrypt second, where Argon2id is not available: at least N = 2^17, r = 8, p = 1. It asks for a per-credential salt from a secure generator and a maximum input length. NIST SP 800-63B asks a verifier to accept at least 64 characters and to normalize Unicode with NFKC or NFKD.

**Choice.** `scrypt`, since it is in every supported Node and Argon2id is not (Alternatives). N = 2^17, r = 8, p = 1 is the default and the floor. A 16-byte salt and a 32-byte key.

**The setting.** `ln`, log2 of N, in the `std` entry of a module manifest (API). An integer from 17 to 20, default 17.
- **Where.** A manifest literal, checked by `keel check` and `keel build`, written to `std.json`, bound by `createApp`, read with `stdConfig`. It is not an argument of `hash`: a per-call cost would be a second way to say it and a way to say it wrong in one file. It is not an option of `register`: a factory gets the seed and nothing of the app. It is server-only config; the package does not mark it `clientStd`.
- **One value per app.** `std` is per module, and two modules may each list the package. A ctx's cost is the highest `ln` any module of the app sets, 17 when none does. Every deployable reads the same `std.json`, so two deployables on one database agree. Taking the highest means no module's setting is ever weakened by another's.
- **Only `ln`.** `ln` raises memory and time together, and memory is what scrypt makes an attacker pay for. `r` stays 8, the value every published parameter set uses. `p` stays 1: raising it adds time and no memory, and an app that wants more time gets it, with memory, from one more step of `ln`. One knob keeps the setting a closed list of four values.
- **The upper limit is 20.** One derivation holds 1 GiB and takes about 1.5 s here. Past that a sign-in page is slower than a person will wait, and one request holds more memory than the host of a small app has.
- **Below the floor.** `ln: 16`, or any value under 17 or over 20, or another key, fails `CredentialsConfig`, which is E1158 from the kernel: at the manifest in `keel check` and `keel build`, and as a startup error from `createApp` for a hand-edited `std.json` (E1160 or E1158). No new code. The message names the path and the rule: `... fails its schema at ln (min)`. There is no way to configure a cost weaker than 2^17.

What each value costs, so an app can choose. Times are this machine's; the last three columns follow from D5.

| `ln` | Memory per derivation | Time | Run at once | Peak memory | Waiting | Checks a second | Longest wait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17 | 128 MiB | 175 ms | 2 | 256 MiB | 16 | 11 | 1.4 s |
| 18 | 256 MiB | 355 ms | 2 | 512 MiB | 8 | 5.6 | 1.4 s |
| 19 | 512 MiB | 726 ms | 1 | 512 MiB | 4 | 1.4 | 2.9 s |
| 20 | 1 GiB | 1,459 ms | 1 | 1 GiB | 2 | 0.7 | 2.9 s |

**Stored form.** `$scrypt$ln=<ln>,r=8,p=1$<salt>$<key>`, the PHC string layout: id, parameters, salt, key, with salt and key in base64 without padding. 88 characters.

**What `verify` reads.** Id `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64 bytes, whatever the ctx's own `ln` is. The range below 17 is for strings brought from elsewhere: OWASP's other rows and a hand-written `scryptSync(v, salt, 64)` hash re-encoded into the form. Each verifies once with `rehash: true` and is stored again at the ctx's cost. Anything else is `credentials.malformed` `parameters`. The bounds keep one stored string from asking for more than 1 GiB.

**`rehash`.** True when the stored string is below the ctx's cost: a lower `ln`, a salt under 16 bytes, or a key under 32. So raising `ln` in the manifest moves each account on its next sign-in, through the same three lines of Example 1. Lowering it later, from 19 to 18, changes what `hash` writes and rehashes nothing.

**Comparison.** `timingSafeEqual` over the derived key and the stored key. The key is derived at the stored key's length, so the lengths always match.

**Input.** The secret's text, NFKC-normalized, as UTF-8: a password typed on two keyboards that compose a character differently is one password. 1 to 1,024 bytes. The cap is not about scrypt's time, which the input length does not move (Problem). It bounds what the calls in the air hold and catches a schema with no `max`. An empty input is refused so a schema with no `min` cannot store the hash of nothing.

**Memory.** The input bytes and each derived key are zeroed after use.

### D4. Random bytes and the sim forms
`ctx.random` has no bytes method, its real `float` is `Math.random`, and k.ctx does not promise where a real `id` comes from (Problem). The package does not use it. It registers a capability, and `register` picks the implementation from the ctx's mode:
- **real.** `randomBytes` of `node:crypto`, for salts and for tokens. No seed reaches this function.
- **shell.** The real implementation. A shell never runs it: E2202 refuses the placement (D6).
- **sim.** The leading bytes of SHA-256 over the capability seed and a call count. k.ctx derives that seed from the ctx seed and the name `credentials`, so one ctx seed fixes every string and every token, call by call, and a replay or a `simulate` run sees the same state bytes. The sim also derives synchronously, so two checks started together finish in call order.

Seeded bytes are predictable, so everything a sim makes is marked and kept out of production:

| Made under sim | Form | Under a real or shell ctx |
| --- | --- | --- |
| a password hash | `$scrypt-sim$ln=<ln>,r=8,p=1$<salt>$<key>` | `verify` answers `credentials.malformed` `sim` |
| a token | `keelsim_<id>_<secret>` | `check` answers `credentials.mismatch`, as for any text that is not a token |
| a token digest | `$sha256-sim$<digest>` | `check` answers `credentials.malformed` `sim` |

A fixture or a seed script run under `keel test` cannot put a working credential with a known salt, or a token with a known secret, into a production database. The sim reads both forms, so a test can load a production-shaped fixture.

**The sim and the cost setting.** A sim hash carries the ctx's `ln` as a label and is always derived at N = 2^4, about 0.3 ms. The label is what `rehash` compares, so an app's test can raise `ln` and watch its rehash path run without paying for a 256 MiB derivation. The low cost follows from the mark: once a real ctx refuses the form, a full derivation in tests protects nothing. The package's own conformance runs the real form at full cost. A ctx that no `createApp` bound has no `std` config, so its `ln` is 17.

No kernel gap is worked around here (default 1): the capability registry is the extension point for an effect with real and simulated forms, and k.ctx is unchanged.

### D5. Cost and concurrency
- One `hash` or `verify` under a real ctx at `ln` 17: 163 to 175 ms of one thread and 128 MiB, measured in two runs. The call is async and does not block the event loop.
- The bounds are a function of the ctx's `ln` and nothing else (D3's table). 2 derivations run at once at `ln` 17 and 18 and 1 at 19 and 20, so the peak stays at 512 MiB up to `ln` 19. At 17 that leaves 2 of libuv's 4 pool threads for file reads and DNS lookups.
- The waiting bound halves with each step, 16, 8, 4, 2, so the longest wait stays under 3 s as each derivation gets slower. A fixed 16 at `ln` 20 would hold a caller for 23 s.
- A call that finds the queue full resolves `keel.busy` with `{ limit }`, the kernel code a server answers 503 for. Nothing is derived for it.
- A production process has one ctx, so the bounds are per process.
- Prototype at `ln` 17, 19 `verify` calls started at once: 18 `ok`, one `keel.busy`, 1,491 ms in all, the process at 374 MiB. At `ln` 19, 6 calls: 5 `ok`, one `keel.busy` with `limit` 4.
- `mint` and `check` take no place in the queue: a token check is 0.6 microseconds.

### D6. Where it runs
`node:crypto`, so a `node` deployable only. Two rules, both from `./tools`, neither with a fix:

| Code | Reports | Message | Fix text in `keel explain` |
| --- | --- | --- | --- |
| E2201 | `@keel/std-credentials/server` imported or re-exported in a file that is not `*.server.ts`; test files are let through | `@keel/std-credentials/server outside a *.server.ts file` | call `credentials(ctx)` from an action in a `*.server.ts` file |
| E2202 | that import in a module a deployable with an adapter other than `node` serves; data `{ deployable, adapter }` | `credentials need a node deployable; '<name>' is <adapter>` | place the module in a `node` deployable (`keel codemod place`) and call its action from the client |

E2202 is what refuses a `client` deployable and its shells at check time: in a `client` deployable a `*.server.ts` loader runs in the browser or the webview, where `node:crypto` does not exist. It reads `topology.ts` as std.jobs' E2504 does. Each explain row is under 120 tokens. Both rules cover the token methods, since they are reached through the same entry.

Rules this RFC does not add:
- A `verify` or `check` result ignored. E1453 reports a dropped `Result`, and a mismatch is `err`, so a result that is read cannot be misread.
- A cost under the floor. E1158 reports it (D3).
- A `Hashed` or `Digested` field marked `.pii`. The mark only adds redaction, so there is nothing to report.
- A `Hashed` or `Digested` field in a loader `output`. It would need to read a schema across files (Questions 9).

### D7. Tokens
**What a fast hash needs.** A fast hash is sound only for a secret nobody can guess, and nothing in a `Secret<string>` says how it was made. So the fast path has no door for outside secrets: `mint()` takes no input and makes the token itself, and a stored digest exists only because `mint` returned it. A password can be handed to `check`, where it is not in the token form and answers `credentials.mismatch`; it can never be handed to anything that stores a fast hash of it.

**Algorithm.** SHA-256 over the token's whole text, with no key.
- The secret part is 256 random bits. Nobody searches that space, with a fast hash or a slow one, so a salt and a work factor add nothing.
- HMAC-SHA-256 needs a key, and Keel has no path for one. `KEEL_SECRET` is held by `createApp` for the caller cookie; using it would mean every API token dies when the cookie key rotates, and no accessor gives it to a package anyway (Problem). A key from the environment is RFC 0100 Questions 2, still open.
- What a key would add is narrow: someone who can write the database could no longer plant the digest of a token they chose. That person can already replace a password hash, so the two halves of the package stand at the same line.
- The digest names its algorithm, `$sha256$`, so `$hmac-sha256$` can be added the way a new scrypt cost is.

**Token form.** `keel_<id>_<secret>`: `id` is 16 lowercase hex characters (64 random bits) and `secret` is 64 (256 bits); 86 characters. Hex and underscores only, so a double click selects all of it, it needs no escaping in a header, a form field or JSON, and a secret scanner can match the fixed prefix.

**Lookup.** The `id` is in the token and is not secret. `check` reads it and hands it to `find`, and the app looks its row up by key: no scan, and no digest used as a search key. The digest covers the whole text, id included, so the id of one token with the secret of another does not match. A `find` that returns `undefined` still hashes the presented token before answering.

**Digest form.** `$sha256$<digest>`: 32 bytes in base64 without padding, 51 characters. `Digested` checks the shape only, like `Hashed`.

**`check` returns the row.** The caller needs the row's owner, not a boolean, and `find` already fetched it. Returning it means no second lookup and no `undefined` to narrow away.

**Expiry.** Out. The package holds no clock and no row. An app that wants a reset token to last an hour stores `expiresAt` from `ctx.clock.now()` beside the digest and compares it in the action (Questions 5).

**Revoking.** The app deletes the row. `find` then returns `undefined`.

### D8. One documented way
With the package in place, the hand-written form is a second way to do the same thing. Each place that names it changes (Spec diff, Migration).

### D9. What the kernel does not carry yet
The package's half of an API token is complete: mint, store a digest, check. Two paths around it are the kernel's and are missing (Problem):
- A write's answer cannot hold the new token. Example 2 sends it through a `service` call. That is the right path for a reset or invite token and a detour for an API token shown on a settings page.
- A request header never reaches server code. Example 2 takes the token as an `s.secret` input field of a POST. A token in a URL would land in history and proxy logs, so a GET route has no good way to take one.

This RFC changes neither. Default 1 says a stdlib need that shows a kernel gap is met by a kernel change, and both are new kernel API shapes for the user (Questions 1). The package's API does not change when they land: the token leaves by `reveal(minted.token)` wherever the kernel lets a value leave, and arrives as a `Secret<string>` wherever the kernel hands one over.

### Prototype
In the session scratchpad, `rfc0103/proto/`: the three entries (`Hashed`, `Digested`, `CredentialsConfig`, the real and sim implementations behind `register`, two rules) and the example app above. Run on Node 24.19.0 against the repo's `@keel/schema`, `@keel/ctx`, `@keel/store`, `@keel/router`, `@keel/services`, `@keel/compiler` and `@keel/check`.

| Case | Result |
| --- | --- |
| `tsc` over the prototype and both examples, strict profile | no error |
| `check` over both examples in a `node` deployable, every kernel rule | no diagnostic |
| The same with the deployable's adapter `client` | one E2202 per file importing `./server` |
| A non-server file importing `./server` | one E2201 |
| `std` `{ ln: 18 }`; `{ ln: 16 }`; `{ ln: 21 }`; `{ p: 2 }` | clean; E1158 `at ln (min)`; E1158 `at ln (max)`; E1158 `at p (unknown-key)` |
| Real `hash`, then `verify`, `ln` 17 | 184 ms, 171 ms; `ok`, `rehash` false; 88 characters |
| A hasher at `ln` 18: `hash`; `verify` of an `ln=17` string | writes `ln=18`; `ok`, `rehash` true |
| A hasher at `ln` 17: `verify` of an `ln=18` string; of an `ln=17` string with an 8-byte salt | `ok`, `rehash` false; `ok`, `rehash` true |
| `verify(secret, undefined)`, real | `credentials.mismatch` after 173 ms |
| One key or salt character changed | `credentials.mismatch` |
| `ln=30`; id `argon2id`; `hunter2` | `parameters`; `parameters`; `format` |
| A `ln=14` string built with `scryptSync` | `ok`, `rehash` true |
| Sim `hash` | `$scrypt-sim$ln=17,...`, 0.3 ms; two ctxs with one seed give equal strings |
| Sim at `ln` 18 reading a sim `ln=17` string | `ok`, `rehash` true |
| A sim hash under real; a real hash under sim | `credentials.malformed` `sim`; `ok` |
| Empty; 1,025 bytes; 1,024 bytes | `credentials.length`; `credentials.length`; hashes |
| U+212B in the secret, U+00C5 at `verify` | `ok` |
| 19 `verify` calls at once, `ln` 17 | 18 `ok`, 1 `keel.busy` `{ limit: 16 }` |
| 6 `verify` calls at once, `ln` 19 | 5 `ok`, 1 `keel.busy` `{ limit: 4 }` |
| `mint()`, real | an 86-character token of the form, its id part equal to `id`; a 51-character digest; 0.2 ms |
| `String`, `JSON.stringify`, `inspect` of the minted token | `[secret]`; the text appears in none |
| `check` of the token with its row | `ok` with the row; `find` called once with the id; 0.1 ms |
| A changed secret; another token's id; an unknown id | `credentials.mismatch` each |
| `hunter2` as the token | `credentials.mismatch`; `find` not called |
| A row whose digest is `$md5$...` | `credentials.malformed` `parameters` |
| Sim `mint`, two ctxs with one seed | equal `keelsim_` tokens and `$sha256-sim$` digests |
| A sim token under real; a sim digest under real | `credentials.mismatch`; `credentials.malformed` `sim` |
| `tx(t, { token: reveal(minted.token) })`; `console.log(reveal(minted.token))` | one E1112 each |
| `tx(t, { id: minted.id, digest: minted.digest })`; `reveal(minted.token)` in a `service` body; in a returned object | no E1112 |
| `reveal(` in the package | 1 |

## Alternatives
- Free functions `hash(ctx, secret)` and `verify(secret, stored)`. Rejected; the accessor is approved.
- `verify` resolving `ok({ valid })`. Rejected; the `err` is approved.
- `verify` returning the new string when the parameters are old. Rejected (D2).
- A plain `string` out, with no `Hashed` or `Digested`. Rejected: PRINCIPLES 4. The fields would be `s.string()`, the methods would take any string, and a generator would give text nothing can read.
- `Hashed` checking the parameter ranges. Rejected: a store whose state fails its schema cannot be restored, so one string from a newer version would take every account down after a rollback.
- The cost as an argument of `hash`. Rejected: two call sites could disagree, and the floor would be a run-time check in place of a check-time one.
- The cost from the environment (`KEEL_SCRYPT_LN`). Rejected: `DeployEnv` is the kernel's, a value there is not checked until the process starts, and two deployables could be started with different values.
- The cost as an option of `register`. Rejected: the package registers its own capability at import, and a factory receives the seed only.
- Two modules setting different `ln` as an error. Rejected: it needs a new code for a case that has a safe answer, the higher one.
- `r` or `p` settable. Rejected (D3): `p` adds time without memory, and no published set moves `r`.
- A cost below 2^17 for small hosts (N = 2^16, p = 2). Dropped on the user's answer: 2^17 is the floor.
- A queue that does not change with `ln`. Rejected: 16 waiting at `ln` 20 is a 23 s wait.
- Salt from `ctx.random.id`, as k.privacy says today. Rejected: 122 bits per draw where 128 are asked for, a promise k.ctx does not make, and no way to mark what a sim made.
- A kernel `ctx.random.bytes(n)`. Rejected for this RFC: `id` is "the one way to mint an id or token" (k.ctx), and a registered capability already gives the package its own source.
- The system generator in every mode. Rejected: a sim run would store different bytes each time, and k.sim says every capability is deterministic by seed.
- One password form in every mode, at full cost. Rejected: a seeded salt would be valid in production, and each test sign-in would cost 170 ms and 128 MiB.
- Argon2id. Rejected for now: `crypto.argon2` is not in Node 22, and a native dependency is a larger change than this package. `$argon2id$v=19$...` already fits `Hashed` (Questions 8).
- bcrypt or PBKDF2. Rejected: bcrypt is not in `node:crypto`, and OWASP lists PBKDF2 for FIPS needs only.
- No bound on concurrency, or an unbounded queue. Rejected: 8 calls at once took 594 MiB and every pool thread, and an unbounded queue only moves the wait to the client.
- Tokens: `digest(secret)` for any secret. Rejected: one autocomplete away from a password. `mint` has no input.
- Tokens: `scrypt` for them too. Rejected: 170 ms on every API request.
- Tokens: HMAC-SHA-256 keyed with `KEEL_SECRET`. Rejected (D7).
- Tokens: the digest as the lookup key, with no id part. Rejected: the app would search by a value derived from the secret and compare with `===`, and it would have no handle to show or revoke a token by.
- Tokens: `tokenId(token)` and `check(token, digest)` as two calls. Rejected: the caller would fetch the row, narrow `undefined` away, and then read the row a second time for its owner; `find` does all three in one place (Questions 3).
- Tokens: `ctx.random.id` as the token. Rejected: no digest, no sim mark, 122 bits.
- Tokens: `mint` returning a plain string. Rejected: nothing would print it as `[secret]`, and E1112 would have no `reveal` to start from when it reaches `tx` or a log.
- Tokens: an expiry inside the digest string. Rejected: `check` would need a clock, and the app's row is where a time belongs.
- One spec section for both halves. Rejected: 2,205 tokens against a limit of 1,500.

## Spec diff
Token counts are ceil(chars/4) of the whole file after the change, measured on scratch copies of `spec/` at `f8e926d2`.

### std.credentials (new, 1,290)
The file `spec/std/std.credentials.md`, in full:

````md
# std.credentials: Credential hashes
status: proposed

**Extension points.** Capability registry (k.ctx): `credentials`. Schema type registry: `credentials.Hashed`. Std config (k.module): `{ ln }`. Check rule registry: `@keel/std-credentials/tools` (E2201, E2202). A module that uses the package lists it in `deps`. Tokens: std.tokens.

**API.** `@keel/std-credentials` is client-safe; `@keel/std-credentials/server` is Node only.
```ts
import { Hashed } from '@keel/std-credentials'               // *.schema.ts: password: Hashed
import { credentials } from '@keel/std-credentials/server'  // *.server.ts
const h = await credentials(ctx).hash(input.password)                    // Result<Hashed, E>
const r = await credentials(ctx).verify(input.password, user?.password)  // Result<{ rehash: boolean }, E>
```
- Both take the `Secret<string>` (k.privacy), so app code writes no `reveal`. The input is its text, NFKC-normalized, as UTF-8.
- `hash` resolves the stored form; an input that is empty or over 1,024 bytes is `credentials.length` (data `{ min: 1, max: 1024 }`).
- `verify` is `ok` only when the secret matches `stored` (`timingSafeEqual`). `rehash` is true when `stored` is below the ctx's cost: a lower `ln`, a salt under 16 bytes or a key under 32; the caller then stores a new `hash`. No match, or an input `hash` refuses, is `credentials.mismatch`. `stored` `undefined` (no such account) derives one key and is `credentials.mismatch`. An unreadable `stored` is `credentials.malformed`, data `{ reason }`: `format` (not `Hashed`), `parameters` (an id or parameters not read) or `sim` (a sim form outside sim).
- Each error is one constant per code, `reason` and `limit`: none holds a part of the secret or of `stored`, and nothing throws.
- `Hashed` (`credentials.Hashed`) is a format type over `s.string()`: `$id$params$salt$key`, `$v=<n>` allowed after the id, at most 256 characters. It checks the shape only, so a later version's string restores. It generates sim-form strings.

**Cost.** `std: { '@keel/std-credentials': { ln } }` in a module's manifest: `ln`, log2 of scrypt's N, an integer 17 to 20, default 17; any other value or key is E1158 (k.module). A ctx's cost is the highest `ln` any module sets. `r` is 8 and `p` is 1. A derivation holds 128 MiB at 17 and twice as much per step.

**Stored form.** `$scrypt$ln=<ln>,r=8,p=1$<salt>$<key>`: `scrypt` (`node:crypto`) with N = 2^`ln`, a 16-byte salt and a 32-byte key in base64 without padding. `verify` reads `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64.

**Modes.**
- **real.** The salt is `randomBytes(16)` of `node:crypto`, never `ctx.random`. A derivation runs off the event loop. Per ctx, 2 run at once at `ln` 17 or 18 and 1 above; 16, 8, 4 or 2 wait in call order (`ln` 17 to 20), and a call past that is `keel.busy` (data `{ limit }`, that count).
- **shell.** As real.
- **sim.** The form is `$scrypt-sim$ln=<ln>,r=8,p=1$<salt>$<key>`: `ln` is the ctx's, as a label; the key is derived synchronously at N = 2^4, and the salt comes from the capability seed and a call count. It reads both forms. A real or shell ctx refuses it, so a string with a seeded salt verifies only under sim.

**Rules.** E2201 `@keel/std-credentials/server` imported outside a `*.server.ts` file, tests aside (no fix) · E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix).

**Conformance.**
- Under real and sim, for generated secrets, `verify` of a secret and its `hash` is `ok`, `rehash` false; of another secret, `credentials.mismatch`.
- A real `hash` has the stored form with `ln=17` and parses with `Hashed`; two of one secret differ.
- Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`.
- `$scrypt$ln=14,r=8,p=1$` with a salt and that secret's `scryptSync` key verifies, `rehash` true.
- Under a `createApp` whose `std` sets `ln: 18`, real and sim: `hash` writes `ln=18`, an `ln=17` string verifies with `rehash` true, and under `ln: 17` an `ln=18` string verifies with `rehash` false. `ln: 16` and `ln: 21` are each one E1158 naming `ln`.
- Under sim, ctxs with one seed give equal `hash` strings call by call, and two seeds do not; a sim `hash` and every generated `Hashed` are `credentials.malformed` `sim` under real and shell.
- `verify(secret, undefined)` is `credentials.mismatch`.
- An empty secret and one of 1,025 bytes are `credentials.length` from `hash` and `credentials.mismatch` from `verify`; 1,024 bytes hashes.
- A secret with U+212B verifies against the `hash` of the same text with U+00C5.
- Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`.
- Under real at `ln` 17, of 19 `verify` calls started at once, 18 are `ok` and one is `keel.busy` with `limit` 16.
- A `*.server.ts` action passing the value of `credentials(ctx).hash(input.password)` to `tx` has no E1112 or E1105.
- E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `credentials`.
````

### std.tokens (new, 916)
The file `spec/std/std.tokens.md`, in full:

````md
# std.tokens: Tokens
status: proposed

**Purpose.** A fast hash for secrets the package mints: API tokens, reset and invite tokens. It is sound because every stored digest comes from `mint`, which draws 256 random bits; a password takes std.credentials. Both are `@keel/std-credentials`.

**API.**
```ts
import { Digested } from '@keel/std-credentials'               // *.schema.ts: { id: s.string(), digest: Digested }
import { credentials } from '@keel/std-credentials/server'  // *.server.ts
const { token, id, digest } = credentials(ctx).mint()        // Secret<string>, string, Digested
const found = credentials(ctx).check(input.token, (id) => rows.find((t) => t.id === id))  // Result<Row, E>
```
- `mint()` returns a new token as a `Secret<string>`, its `id` (the token's non-secret part, the row's lookup key) and the `digest` to store.
- The token leaves once: the `*.server.ts` file that sends it calls `reveal(token)`. That value in `tx`, storage, a log or a throw is E1112 (k.reveal).
- `check(token, find)` reads the id from the presented `Secret<string>`, calls `find(id)` once for the row (an object with `digest: Digested`), compares in constant time (`timingSafeEqual`) and returns `ok(row)`. A presented value that is not in the token form (`find` is not called), a `find` that returns `undefined`, and a digest that does not match are `credentials.mismatch`. An unreadable `digest` is `credentials.malformed`, with std.credentials' reasons.
- Both are synchronous and neither throws. Errors are std.credentials' constants.
- `Digested` (`credentials.Digested`) is a format type over `s.string()`: `$id$digest`, at most 128 characters. It checks the shape only and generates sim-form strings.

**Forms.** Token: `keel_<id>_<secret>`, `id` 16 and `secret` 64 lowercase hex characters (64 and 256 random bits), 86 characters. Digest: `$sha256$<digest>`, the SHA-256 of the token's text in base64 without padding, 51 characters. There is no key and no expiry: the app stores what else the row needs.

**Modes.** Real and shell draw `id` and `secret` from `randomBytes` of `node:crypto`. Sim draws them from the capability seed and a call count and writes `keelsim_<id>_<secret>` and `$sha256-sim$<digest>`; it reads both forms. A real or shell ctx answers `credentials.mismatch` for a sim token and `credentials.malformed` `sim` for a sim digest.

**Rules.** E2201 and E2202 (std.credentials).

**Conformance.**
- Under real, `mint()` gives a token of the token form whose id part is `id`, and a `digest` of the digest form that parses with `Digested`; two mints share no `id`, `secret` or `digest`.
- `String`, `JSON.stringify` and `util.inspect` of a minted `token` give `[secret]`.
- `check` of a minted token, with `find` returning a row holding its `digest`, is `ok` with that row, and `find` was called once with its `id`.
- Under real, `check` is `credentials.mismatch` for: a token with one `secret` character changed; one token's `id` with another's `secret`; `hunter2` (`find` not called); `find` returning `undefined`.
- A row whose `digest` is `$md5$` plus 43 characters is `credentials.malformed` `parameters`.
- Under sim, ctxs with one seed mint equal tokens and digests call by call, and two seeds do not; under real and shell, a sim token is `credentials.mismatch`, and a row with a sim digest or any generated `Digested` is `credentials.malformed` `sim`.
- In a `*.server.ts` file, `tx(t, { token: reveal(minted.token) })` and `console.log(reveal(minted.token))` are each one E1112; `tx(t, { id: minted.id, digest: minted.digest })`, `reveal(minted.token)` in a `service` call's `body`, and `check(input.token, find)` are none.
````

Both halves in one section measure 2,205 tokens, so they are two. std.sessions, std.multi and std.monitor are three sections of one package in the same way.

### spec/std/README.md
The wave line "S8 adds std.db, std.workflows and std.shells." becomes "S8 adds std.db, std.workflows, std.shells, std.credentials and std.tokens." Two rows after std.shells:

> | std.credentials | Credential hashes | proposed | capability, schema type and check rule registries, std config: `Hashed`, `hash`, `verify`, `ln`, E2201-E2202 |
> | std.tokens | Tokens | proposed | `@keel/std-credentials`: `mint`, `check`, `Digested` |

### spec/00-map.md (1,200 to 1,198)
Code ranges gains a last row, 32 chars with its line break (4,799 to 4,831, 1,208 tokens):

> | E220x | std.credentials | | |

Three trims pay 39:
- k.scaffold one line, "structural edits as operations" becomes "structural edits".
- k.testing one line, "given, do, expect; properties" becomes "given, do, expect" (the title says properties).
- Stdlib, "Sections and statuses: `spec/std/README.md`." becomes "Sections: `spec/std/README.md`."

After: 4,792 chars, 1,198 tokens. std.tokens owns no code, so the row names std.credentials alone. E220x is unused in `spec/`, `docs/`, `tasks/` and every `packages/*/src`; the orchestrator confirms it against any RFC written in parallel.

### k.privacy (1,361 to 1,374)
**Secrets**, the last sentence, "A credential is kept as a value derived from it in server code: a salted hash to check it (`node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual`).", replacement text:

> A credential is kept as a value derived from it in server code: `credentials(ctx)` of `@keel/std-credentials` hashes and verifies a password `Secret` (std.credentials) and mints and checks tokens (std.tokens).

No conformance header quotes the old sentence.

### Unchanged
k.ctx (1,434): no new method on `random`, and `register` is used as specified. k.reveal (709): no new sink, carrier or exception (D1). k.module: `std` config and E1158 are used as they stand. k.errors and k.server: `keel.busy` and its 503 are used as they stand, and an action still returns `Href | null` (D9). std.db: its On disk paragraph already says a derived value is stored as written.

## Conformance diff
Written by the `conformance-writer` from std.credentials and std.tokens, without the implementation. This RFC allows these files under `packages/std-credentials/conformance/**`; no existing conformance file changes.

| File | Section, clauses | Notes |
| --- | --- | --- |
| `round-trip.test.ts` | std.credentials 1, 2, 7, 9 | Property, seed 1337: 100 runs under sim, 5 under real. |
| `stored-form.test.ts` | std.credentials 3, 4 | The `ln=14` string is built in the test with `scryptSync`, which pins the derivation and the encoding from outside. RFC 7914's second vector anchors `scryptSync` itself. |
| `cost.test.ts` | std.credentials 5 | A `createApp` over a `std.json` fixture, as `packages/server/conformance/module-std-config-client.test.ts` builds one; `check()` for the two E1158 cases. Two real derivations at `ln` 18, 256 MiB each. |
| `sim.test.ts` | std.credentials 6 | Seeds generated; `Hashed`'s generator through `gen`. |
| `length.test.ts` | std.credentials 8 | Multi-byte secrets, so the cap is in bytes. |
| `errors.test.ts` | std.credentials 10 | For each code and reason, two different secrets and stored strings give deep-equal errors. |
| `busy.test.ts` | std.credentials 11 | One real ctx, 19 calls; about 1.5 s. |
| `rules.test.ts` | std.credentials 12, 13 | `check()` with `@keel/std-credentials/tools` imported, as std.db's `e2151.test.ts` does. |
| `mint.test.ts` | std.tokens 1, 2 | 100 mints under real; pairwise distinct. |
| `token-check.test.ts` | std.tokens 3, 4, 5 | `find` is a spy. |
| `token-sim.test.ts` | std.tokens 6 | Seeds generated; `Digested`'s generator through `gen`. |
| `token-e1112.test.ts` | std.tokens 7 | `check()` over one-file fixtures. |

Headers quote each clause in full, as in `packages/std-db/conformance/`. The real-ctx password cases run 30 to 40 derivations at `ln` 17 and two at 18, about 8 s in all, in one worker.

No existing test goes red between the spec commit and the package lane: the suites that read every Rules code read `spec/kernel/*.md`, and E2201 and E2202 live in `spec/std/`.

**Property tests** in `packages/std-credentials/test/`, written by the lane:
- For generated parameters inside the read ranges and generated salt and key bytes, the stored text parses back to the same parts; any text `Hashed` refuses is `format`.
- For a sim `hash` with any one character replaced, `verify` is never `ok`.
- For generated strings and their NFC, NFD and NFKD forms, `verify` against one `hash` is `ok`.
- For generated sets of module configs, the ctx's `ln` is the highest set, and 17 for none; `rehash` is true exactly when the stored `ln` is below it, the salt is under 16 bytes or the key under 32.
- The queue, over a stubbed derivation, generated arrival orders and each `ln`: never more than its run bound running, results in call order, `keel.busy` exactly when its waiting bound is full.
- For a sim token with any one character replaced, and for any generated string, `check` against the minted row is never `ok`.
- Every value of `Hashed`'s and `Digested`'s generators parses.
- The package's server sources, given to `check` under an app path, have no E1112; `reveal(` appears once.

## Lanes and build order
1. Orchestrator, one commit: the spec diff, `tooling/budgets.json` (three entries), `tooling/deps.json` (`std-credentials` after `std-tauri`).
2. `conformance-writer`: the conformance diff, in the `rfc:0103` PR.
3. Package lane, one agent, `packages/std-credentials` only: `src/Hashed.ts`, `src/Digested.ts`, `src/CredentialsConfig.ts`, `src/server/` (the accessor, `Hasher`, the real and sim implementations, the stored-form reader, the queue, the token form, `textOf`), `src/tools/`, `test/`, `README.md` with the date the OWASP guidance was re-checked, a changeset. Dependencies: `@keel/ctx`, `@keel/schema`, `@keel/compiler` (`stdConfig`, `parseTopology`) and `@keel/check` for `./tools`. The exported accessor wraps `register`'s, since a factory gets the seed and the cost comes from `stdConfig(ctx, ...)` on first use. Expected `unsafe` count: 0, since `Hashed.parse`, `Digested.parse` and `s.secret(s.string()).parse` apply the brands.
4. Check text lane, `packages/check/src/internal/EXPLANATIONS.ts` only: the E1112 row's fix sentence becomes "pass the Secret itself, or store what credentials(ctx).hash returns (@keel/std-credentials)". Disjoint from lane 3; no behavior changes.
5. Orchestrator: the threat-model, skill and ledger lines below, `docs/ARCHITECTURE.md`'s storage paragraph gains the package name, backlog 0615 closed, the Questions filed.

Nothing in S8 depends on this package, and it depends on nothing unbuilt, so lanes 2 to 4 can run beside any other work. The kernel RFC of Questions 1 is not a dependency.

**Threat model.** In **Secrets**, the last sentence, "An author who means to store a secret can always do so, and the documented form is a salted hash (k.privacy).", becomes:

> An author who means to store a secret can always do so, and the documented form is `credentials(ctx)` (std.credentials, std.tokens).

A new bullet after **Durable storage**:

> - **Credentials** (std.credentials, std.tokens). `credentials(ctx).hash` takes a `Secret` and gives a salted `scrypt` string that names its parameters, at N = 2^17, r = 8, p = 1 or a higher N the app's `std` config sets; a lower one is E1158. `verify` compares in constant time and says when to rehash. `mint` gives a token with 256 random bits as a `Secret` and its SHA-256 digest to store; `check` finds the row by the token's id and compares in constant time. No stored digest comes from a secret the package did not mint. Real salts and tokens come from the system generator. A sim ctx's are seeded and marked, and a real ctx refuses them. An unknown account costs one derivation, so timing does not list accounts. A process runs 2 derivations at once and answers 503 past its waiting bound: a sign-in flood can deny sign-in, and rate limiting is the operator's. Not covered: a token's way out of a write and in by a header, which the kernel does not carry; a key in either hash; a credential the app must present later, which needs encryption; expiry, password rules and lockout; a `Hashed` or `Digested` field an app returns from a loader.

**Skills.** `keel-compliance`, the Secrets sentence "store a salted `scrypt` hash" becomes "store what `credentials(ctx).hash(secret)` gives (`@keel/std-credentials/server`, in `deps`; field type `Hashed`; `verify(secret, user?.password)`, mismatch is `err`, rehash when `rehash`; cost `std: { ln }` 17 to 20; tokens: `mint()` gives `{ token, id, digest }`, store `id` and `digest: Digested`, send `reveal(token)` once, `check(token, find)`; E2201, E2202)". `keel-storage`, "store a salted hash" becomes "store `credentials(ctx).hash(secret)` or a minted token's `digest` (keel-compliance)".

**Ledger.** One item per conformance clause, `std.credentials#1` to `#13` and `std.tokens#1` to `#7`, each at the rung its test gives: `probabilistic` for the generated-secret and generated-seed clauses (std.credentials 1 and 6, std.tokens 6), `example` for the rest. No claim about scrypt's or SHA-256's strength, or about OWASP's guidance, enters the ledger; it reports what the tests show (PRINCIPLES 11). Written on a quiet tree after lane 3.

## Migration
- Apps, modules, evals and scaffold templates: nothing changes. None holds a credential today.
- An app outside the repo that wrote the `scryptSync` form: it adds the dependency and the `deps` entry, changes the field to `Hashed`, re-encodes each stored hash as `$scrypt$ln=14,r=8,p=1$<salt>$<key>` (base64 without padding; the salt is the bytes it gave `scryptSync`), and calls `verify`. Each account moves to the app's cost on its next sign-in. A hash in another algorithm is not read.
- An app that used `ctx.random.id` values as tokens and stored them: it mints new tokens. A stored uuid has no digest and is not in the token form.
- Docs: k.privacy, the E1112 explain row, `keel-compliance`, `keel-storage`, `docs/THREAT-MODEL.md`, `docs/ARCHITECTURE.md`.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| std.credentials | none | 1,290 |
| std.tokens | none | 916 |
| k.privacy | 1,361 | 1,374 |
| `spec/00-map.md` | 1,200 | 1,198 |

`keel explain E2201` and `keel explain E2202` are one row each, under 120 tokens.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild, minified ESM, `packages: "external"`, gzip) on the prototype.

| Entry | Platform | Prototype | Limit proposed |
| --- | --- | --- | --- |
| `@keel/std-credentials` | browser | 633 B | 1kb (1,024) |
| `@keel/std-credentials/server` | node | 2,233 B | 3kb (3,072) |
| `@keel/std-credentials/tools` | node | 900 B | 1.25kb (1,280) |

The prototype's server half is two files; the lane's one-export-per-file layout adds to it, which is what the 839 B of room is for. `@keel/check` is unchanged in size: the explain sentence is 8 characters shorter.

## Risks
- Memory. At the default, two derivations hold 256 MiB on top of the process, and there is no lower setting. A host with less than 512 MiB cannot run sign-ins.
- A raised `ln` is paid on every sign-in from the next deploy, and every account rehashes once. At `ln` 20 a process answers 0.7 checks a second.
- A stored string above the ctx's cost is verified at its own cost. With `ln` lowered from 20 to 17, two such checks at once hold 2 GiB, since the run bound follows the ctx's `ln`.
- "The highest any module sets" means a module can raise the cost for the whole app from its own manifest. It can never lower it.
- A sign-in flood. Past the bounds the answer is 503, for real users too. The bound protects the process, not the sign-in page.
- Tests never run N = 2^17. An app's suite sees the sim form; only the package's conformance runs the real one.
- Sim strings and tokens in a real database. A staging database filled by a test run holds `$scrypt-sim$` and `$sha256-sim$` values, and a real server refuses each. That is D4 working, and the reason is in the error.
- A rollback after a parameter rise. A version that reads `ln` up to 20 answers `parameters` for a string with `ln=21`. `Hashed` still restores, so the store survives.
- NFKC folds compatibility forms, so two passwords that differ only in such forms are one password.
- Timing. The unknown-account answer costs one derivation at the ctx's cost. An account whose stored string is cheaper answers faster until it rehashes.
- A token id is 64 random bits. Two tokens of one app share an id with a chance of about 3 in 10^8 at a million tokens; an app's `addToken` transaction refuses a taken id, as Example 2's does.
- A token sent by mail sits in a mailbox. That is the delivery the kernel allows today for a token made by a write (D9).
- `UV_THREADPOOL_SIZE` below 3 leaves one thread or none for file reads while two derivations run.
- The times are this machine's. A slower host waits longer at the same bounds.

## Known limits
- A write cannot return a new token, and a request header cannot bring one in (D9). Until the kernel carries both, a token leaves through a `service` call and arrives in an action's input.
- A credential the app must present later, such as an OAuth refresh token or a third-party API key a user pastes in, cannot be hashed. It needs encryption under an app key, and Keel has no path for an app key from the environment (RFC 0100 Questions 2). This package does nothing for that case.
- No server-side key is mixed into either hash, for the same reason.
- Tokens have no expiry, scope or last-used time; those are fields of the app's row. Revoking is deleting the row.
- The server's `[secret]` log scrub covers a request's own secret input (k.privacy). A minted token is not in that set, so a helper in another file that throws it is logged as written; E1112 covers the same file only.
- The token prefix is fixed at `keel_`.
- Password rules are the schema's `min` and `max`. There is no breached-password check, no lockout and no rate limit.
- A `Hashed` or `Digested` field in a loader `output` or a request-scope store reaches the browser, and no rule reports it (Questions 9).
- A password the app parses as `s.string` is a type error at `hash`, which is the intended push toward `s.secret`. The form-level warning is still RFC 0100 Questions 4.
- The string `reveal` returns inside the package lives until the collector frees it; only the byte buffers are zeroed.
- A sim ctx never answers `keel.busy`, so an app's handling of it has no test path yet.
- Stored hashes in another algorithm (bcrypt, PBKDF2, Argon2) are not read.

## Questions
1. The kernel paths for a token (D9). A write returns `Href | null`, and no header reaches server code. Recommendation: one kernel RFC with two parts, an API route's action may declare `output` and return data, and a guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, with `authorization` added to the allowed request headers. Both are new kernel API shapes, so they are the user's. This package ships without them; Example 2 changes by one line when they land.
2. The cost setting's details. A `std` entry `{ ln }` in a module manifest; an integer 17 to 20; only `ln`; the highest any module sets; a value outside the range is E1158; the queue bounds follow `ln` (2, 2, 1, 1 running and 16, 8, 4, 2 waiting). Recommendation: accept. The parts most open to another answer are the upper limit of 20 and "highest wins" against an error when two modules differ.
3. `check(token, find)`. A callback that receives the token's id and returns the row, with `ok(row)` as the answer. Recommendation: accept. The two-call form is in Alternatives.
4. SHA-256 with no key. Recommendation: accept, and add `$hmac-sha256$` when Keel has a path for an app key (RFC 0100 Questions 2). `KEEL_SECRET` is not that path.
5. Expiry. Recommendation: out. The app stores `expiresAt` from `ctx.clock.now()` beside the digest. If apps repeat that field, a later version can add `mint({ ttlMs })` and a time in the digest string.
6. The token's text. `keel_`, a 16-hex id and a 64-hex secret, 86 characters, with no app-chosen prefix. Recommendation: accept; an app prefix can be a second `std` key when an app asks for one.
7. Salts, tokens and the sim forms, a security decision the first round left unanswered. Real bytes from `node:crypto` `randomBytes`, never from `ctx.random`; sim bytes from the seed, in marked forms a real ctx refuses, with a sim hash derived at N = 2^4 under an `ln` label. Recommendation: accept. The price is two forms and app tests that do not run the production cost.
8. Argon2id. Recommendation: scrypt now; add id `argon2id` when the supported Node floor has `crypto.argon2`, with `rehash` moving each account. No native dependency.
9. A stored hash or digest reaching the browser. Recommendation: a backlog line for E2203, a `Hashed` or `Digested` node in a loader `output` schema, built when the checker's schema reader (E1111's) is exported to tools.
10. Kernel text naming a stdlib package: k.privacy and the E1112 explain row would name `@keel/std-credentials`. k.deploy already names `@keel/std-db`. Recommendation: accept; the kernel imports nothing.

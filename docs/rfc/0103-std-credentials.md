# RFC 0103: std-credentials (hash and verify a `Secret`; a stored form whose parameters can rise)

Status: proposed; the user approves the API shape before any build (2026-11-16). For backlog 0615. Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0126 records it.

## Decisions
- D1: a new stdlib package, `@keel/std-credentials`, spec section std.credentials, with three entries. `.` exports the schema `Hashed` and is client-safe, since `*.schema.ts` files are shared. `./server` exports the accessor `credentials` and is Node only. `./tools` registers two check rules. The package calls `reveal` once, inside `./server`, so app code never does (defaults 4, 5).
- D2: the API is a capability accessor, as std.geo's is: `credentials(ctx).hash(secret)` and `credentials(ctx).verify(secret, stored)`. Both take the `Secret<string>` and both are async. `hash` resolves a `Hashed`, a branded string that is safe to store. `verify` resolves `ok({ rehash })` only when the secret matches; a wrong secret is `err` `credentials.mismatch`, so `r.ok` can never be read as "signed in" by mistake. `rehash: true` says the stored string was made with older parameters, and the caller stores a new `hash`. `stored` may be `undefined` for an unknown account, which costs one derivation and answers `credentials.mismatch` (defaults 2, 4; the shape itself is the user's, Questions 1 and 2).
- D3: the algorithm is `scrypt` from `node:crypto` at N = 2^17, r = 8, p = 1, with a 16-byte salt and a 32-byte key. The stored form names its own parameters, `$scrypt$ln=17,r=8,p=1$<salt>$<key>`, 88 characters, so a later version can raise them. Keys are compared with `timingSafeEqual`. The input is NFKC-normalized UTF-8 of 1 to 1,024 bytes. A stored string that cannot be read is an `err` with a closed `reason`, never a throw, and no error holds any part of the input (default 4).
- D4: salts come through the capability, and the two sources never mix. Under a real ctx the salt is `randomBytes(16)` of `node:crypto`, the system generator; `ctx.random` is not used. Under a sim ctx the salt comes from the capability seed, the form is marked `$scrypt-sim$` with a low cost, and a real ctx refuses that form. A string with a seeded salt verifies only under sim (defaults 1, 4, 6; a security decision, Questions 3).
- D5: one derivation takes 163 ms and 128 MiB, measured. The real implementation runs it on the thread pool, at most 2 at once per ctx, with 16 more waiting in call order. A call past that resolves the kernel's `keel.busy`, which an action returns as a 503 (default 3).
- D6: it runs in a `node` deployable only. E2201 reports the server entry imported outside a `*.server.ts` file, and E2202 reports it in a module a `client` or `static` deployable serves, which is also where a shell's code lives (defaults 5, 6).
- D7: API tokens and other high-entropy secrets that want a fast hash are out of the first version. A fast hash next to `hash` is a second path a password could take (default 2; Questions 6).
- D8: the hand-written form leaves the docs. k.privacy, the E1112 explain row, two skills and the threat model name `credentials(ctx).hash` where they name `scrypt` and `timingSafeEqual` today (default 2).
- Budget: three new entries, `@keel/std-credentials` 0.75kb, `@keel/std-credentials/server` 2.25kb and `@keel/std-credentials/tools` 1.25kb.

New codes: E2201, E2202 (std.credentials, block E220x). New KeelError codes: `credentials.length`, `credentials.mismatch`, `credentials.malformed`.

## Problem
Measured on `jdforsythe/test-impl` at `dfff457f`, Node 24.19.0, darwin.

**What the docs tell an app to write.** k.privacy Secrets says: "A credential is kept as a value derived from it in server code: a salted hash to check it (`node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual`)." Neither the kernel nor any std package has a helper (RFC 0100 D3, Questions 1). An app that follows the sentence writes the salt, the derivation, the encoding and the comparison by hand, and each of these is a way to get them wrong:
- `scryptSync(v, salt, 64)` uses Node's defaults, N = 2^14, r = 8, p = 1: 16 MiB and 18.7 ms here. OWASP's minimum for scrypt is N = 2^17 (see D3).
- Passing N = 2^17 without `maxmem` throws `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` ("memory limit exceeded"), since Node's default `maxmem` is 32 MiB and the call needs 128 MiB.
- `scryptSync` at N = 2^17 blocks the event loop for 163 ms per sign-in.
- `timingSafeEqual` throws a `RangeError` when the two lengths differ, and app code may not `try` (E1452).
- The parameters are not in the stored value, so they can never be raised for accounts that exist.
- The file holds `reveal` next to `tx`. E1112 ends a flow at any call it does not know (k.reveal), so it cannot tell `scrypt` from MD5. Its own conformance case is `tx(t, { v: scryptSync(reveal(p.k), 's', 64).toString('hex') })`, with the constant salt `'s'` (`packages/check/conformance/privacy-e1112.test.ts:406-409`), and that case is correct for the rule: it checks that a call stands between the value and the sink, not which one.
- An unknown account answers at once and a known one after a derivation, which tells a caller which emails have accounts.

**What exists today.** No `s.secret`, `reveal` or `scrypt` in `apps/`, `modules/`, `evals/` or any `packages/std-*/src`. `scrypt` appears in two places: the E1112 explain row (`packages/check/src/internal/EXPLANATIONS.ts:171`) and the conformance case above.

**What `ctx.random` offers.** `Random` is `{ id(brand), float() }` (`packages/ctx/src/Random.ts`). In a real ctx `id` is `crypto.randomUUID()`, 122 random bits from the system generator, and `float` is `Math.random()` (`internal/realRandom.ts`). In a sim ctx both draw from one xoshiro128** stream by seed (`internal/simRandom.ts`). There is no bytes method, and k.ctx does not say where a real `id` comes from. A production server always builds a real ctx (`packages/server/src/internal/start.ts:65`); `createCtx()` with no mode is sim only when `KEEL_TEST=1` (`internal/defaultMode.ts`).

**Where it can run.** `engines.node` is `>=22` and the deploy image is `node:22-slim` (k.deploy). `crypto.scrypt` is in every supported Node. `crypto.argon2` exists in the local Node 24.19 and not in Node 22.

**Cost, measured** (`scryptSync`, 32-byte key, mean of 5 runs):

| `ln` | r | p | Memory | Time |
| --- | --- | --- | --- | --- |
| 17 | 8 | 1 | 128 MiB | 162.5 ms |
| 16 | 8 | 2 | 64 MiB | 157.1 ms |
| 15 | 8 | 3 | 32 MiB | 115.2 ms |
| 14 | 8 | 5 | 16 MiB | 92.1 ms |
| 14 | 8 | 1 | 16 MiB (Node's default) | 18.7 ms |
| 4 | 8 | 1 | 16 KiB | under 0.1 ms |

- Input length does not move the cost: 64 bytes took 163.5 ms and 1 MiB took 165.5 ms, since scrypt reads the input in one HMAC pass.
- Eight async calls at N = 2^17 started at once finished in 351 ms with the process at 594 MiB: the thread pool ran 4 at a time, 128 MiB each, and file reads and DNS lookups waited behind them.

## Proposal

### API
Everything an app can import. One export per file; the filename is the export.

| Entry | Export | Runs |
| --- | --- | --- |
| `@keel/std-credentials` | `Hashed` (schema and type) | anywhere |
| `@keel/std-credentials/server` | `credentials`, type `Hasher` | Node, in `*.server.ts` |
| `@keel/std-credentials/tools` | `serverImport` (E2201), `nodeDeployable` (E2202) | `keel check` loads it; apps do not import it |

```ts
// @keel/std-credentials
import type { Format, Schema } from '@keel/schema'
export const Hashed: Schema<Format<string, 'credentials.Hashed'>>
export type Hashed = Format<string, 'credentials.Hashed'>

// @keel/std-credentials/server
import type { Ctx } from '@keel/ctx'
import type { KeelError, Result, Secret } from '@keel/schema'
export const credentials: (ctx: Ctx) => Hasher
export interface Hasher {
  hash(secret: Secret<string>): Promise<Result<Hashed,
    | KeelError<'credentials.length', { readonly min: 1; readonly max: 1024 }>
    | KeelError<'keel.busy', { readonly limit: number }>>>
  verify(secret: Secret<string>, stored: Hashed | undefined): Promise<Result<{ readonly rehash: boolean },
    | KeelError<'credentials.mismatch', Record<string, never>>
    | KeelError<'credentials.malformed', { readonly reason: 'format' | 'parameters' | 'sim' }>
    | KeelError<'keel.busy', { readonly limit: number }>>>
}

// @keel/std-credentials/tools
import type { RuleDef } from '@keel/check'
export const serverImport: RuleDef   // E2201
export const nodeDeployable: RuleDef // E2202
```

**`Hashed`.** A format type over `s.string()` (k.schema Format types), registered as `credentials.Hashed`. A store's state schema names it for the field that holds the credential: `password: Hashed`. It accepts `$id$params$salt$key`, with `$v=<n>` allowed after the id, at most 256 characters. It checks the shape and nothing else, so a string a later version wrote still restores after a rollback. Its generator gives well-shaped sim-form strings that match no secret. `encode` is the string's, `doc()` is `credentials.Hashed`, and JSON Schema adds `format: credentials.Hashed`.

**`credentials(ctx)`.** The accessor of capability `credentials` (k.ctx `register`): one `Hasher` per ctx. Importing the entry registers the capability.

**`hash(secret)`.** Resolves `ok(stored)`, a new `Hashed` with a fresh salt at the current parameters. Two calls with one secret give two different strings. Errors:

| Code | Data | When |
| --- | --- | --- |
| `credentials.length` | `{ min: 1, max: 1024 }` | the input is empty or over 1,024 bytes |
| `keel.busy` | `{ limit: 16 }` | 2 derivations run and 16 wait on this ctx |

**`verify(secret, stored)`.** Resolves `ok({ rehash })` when the secret matches `stored`, and never otherwise. `rehash` is `true` when `stored` was not made in the current form (another `ln`, `r`, `p`, salt length or key length); the caller then calls `hash` and stores the result. Errors:

| Code | Data | When |
| --- | --- | --- |
| `credentials.mismatch` | `{}` | the secret does not match; or `stored` is `undefined`; or the input is one `hash` refuses |
| `credentials.malformed` | `{ reason: 'format' }` | `stored` is not a `Hashed` string |
| `credentials.malformed` | `{ reason: 'parameters' }` | `stored` has an id or parameters this version does not read |
| `credentials.malformed` | `{ reason: 'sim' }` | `stored` is the sim form and the ctx is real or shell |
| `keel.busy` | `{ limit: 16 }` | 2 derivations run and 16 wait on this ctx |

**Every error.** Each is one constant value per code and `reason`. `message` is the code, plus `: <reason>` for `credentials.malformed`, and a fixed sentence for `keel.busy`. None holds any part of the secret or of `stored`. Neither method throws or rejects: a derivation Node refuses to run resolves `keel.busy`. An action that returns one of them as is answers 400, and 503 for `keel.busy` (k.server Status). E1453 already reports a `verify` whose result is dropped.

**Example.** An app's sign-up and sign-in actions, one file each, imports left out. `SignIn` is `s.object({ email: s.string({ min: 3, max: 254 }), password: s.secret(s.string({ min: 12, max: 128 })) })`; the store's user rows hold `password: Hashed`. Both files typecheck under `@keel/compiler/tsconfig.strict.json` against the prototype, and `check` reports nothing on them.

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

The sign-in file has no branch for an unknown email: `user?.password` is `undefined`, `verify` spends one derivation and answers `credentials.mismatch`, the same answer in about the same time as a wrong password. Lines 5 to 7 of `postSignIn` are the whole rehash path.

### D1. Name and entries
`@keel/std-credentials`, the name RFC 0100 Questions 1 proposed. Three entries, because three kinds of code import it:
- A `*.schema.ts` file names `Hashed`, and schema files are shared with client code, so `.` imports nothing from Node. It is 469 B.
- A `*.server.ts` file calls `credentials(ctx)`. `./server` imports `node:crypto`, as `@keel/std-channels/server` is the Node half of that package.
- `keel check` loads `./tools`.

The package has no `module.ts`: it has no route, no store and no `std` config, so an app lists it in `dependencies` and nothing in `deps`.

**Why E1112 and E1105 stay silent, by construction.** E1112 starts at a call of `reveal` (k.reveal Flow). An app file that uses this package has none: it passes `input.password`, the `Secret`, as is. The string `hash` resolves is the result of a call the rule does not know, which ends any flow. So k.reveal needs no new line. E1105 reports an import of `reveal` in app code, and the app imports none. The one `reveal` is in the package's `src/server/internal/inputOf.ts`; its result is normalized into a byte buffer, given to `scrypt`, and zeroed. The lane adds a test that gives the package's own server files to `check` under an app path and expects no E1112.

### D2. The API shape
- **An accessor, not free functions.** `hash` and `verify` need per-mode implementations (D4) and per-ctx state (D5), which is what a capability is (GLOSSARY). std.geo already spells a capability `geo(ctx).position()`. One export, `credentials`, also keeps the generic names `hash` and `verify` out of an app file's top level.
- **`Secret<string>` in.** A plain string is a type error. A value the app holds as a string is parsed with `s.secret(s.string())` first, which is the same step that keeps it out of logs.
- **`Hashed` out.** A branded string that cannot be turned back into the secret. E1112 sees no revealed value in it (D1), and a store, a snapshot and std.db keep it as written.
- **Async.** The real derivation runs on the thread pool. A sync form would block the event loop for 163 ms.
- **A wrong secret is `err`.** k.errors puts a denial among expected failures. With `ok({ valid: false })`, the line `if (!r.ok) return err(r.error)` would let a wrong password through, and that line is the one every Keel action already writes.
- **`rehash` is a flag, and the caller rehashes.** `verify` could return the new string itself, at the price of a hidden second derivation and a salt drawn inside a check. Two explicit lines cost less than that surprise.
- **`stored: Hashed | undefined`.** The unknown-account case is in the signature, so the equal-time answer is the default path and the short-circuit is the one that takes extra code.

### D3. Algorithm and stored form
**Guidance, from knowledge; the lane re-checks it at build time and records the date in the package README.** The OWASP Password Storage Cheat Sheet puts Argon2id first (at least 19 MiB of memory, 2 iterations, 1 lane) and scrypt second, where Argon2id is not available: at least N = 2^17, r = 8, p = 1, with N = 2^16 and p = 2, N = 2^15 and p = 3, and N = 2^14 and p = 5 listed as equal choices. It asks for a per-credential salt from a secure generator and a maximum input length. NIST SP 800-63B asks a verifier to accept at least 64 characters and to normalize Unicode with NFKC or NFKD.

**Choice.** `scrypt`, since it is in every supported Node and Argon2id is not (Alternatives). N = 2^17, r = 8, p = 1: OWASP's first row, 128 MiB and 163 ms. A 16-byte salt and a 32-byte key.

**Stored form.** `$scrypt$ln=17,r=8,p=1$<salt>$<key>`, the PHC string layout: id, parameters, salt, key, with salt and key in base64 without padding. `ln` is log2 of N. 88 characters at the current parameters.

**What `verify` reads.** Id `scrypt` with `ln` 14 to 18, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64 bytes. That covers each OWASP row above and a hand-written `scryptSync(v, salt, 64)` hash re-encoded into the form, so an app that followed k.privacy's old sentence can bring its accounts along. Anything else is `credentials.malformed` `parameters`. The upper bounds keep one stored string from asking for more than 512 MiB.

**Raising the parameters.** A later version changes its constants. Strings made before still verify, with `rehash: true`, and each account moves on its next sign-in.

**Comparison.** `timingSafeEqual` over the derived key and the stored key. The key is derived at the stored key's length, so the lengths always match.

**Input.** The secret's text, NFKC-normalized, as UTF-8: a password typed on two keyboards that compose a character differently is one password. 1 to 1,024 bytes. The cap is not about scrypt's time, which the input length does not move (Problem). It bounds what 18 calls in the air hold and catches a schema with no `max`. An empty input is refused so a schema with no `min` cannot store the hash of nothing.

**Memory.** The input bytes and each derived key are zeroed after use.

### D4. Salt source
`ctx.random` has no bytes method, its real `float` is `Math.random`, and k.ctx does not promise where a real `id` comes from (Problem). The package does not use it. It registers a capability, and `register` picks the implementation from the ctx's mode:
- **real.** `randomBytes(16)` of `node:crypto`. No seed reaches this function.
- **shell.** The real implementation. A shell never runs it: E2202 refuses the placement (D6).
- **sim.** The first 16 bytes of SHA-256 over the capability seed and a call count. k.ctx derives that seed from the ctx seed and the name `credentials`, so one ctx seed fixes every string, call by call, and a replay or a `simulate` run sees the same state bytes. The sim also derives synchronously, so two checks started together finish in call order.

A seeded salt is predictable, so the sim form is marked and kept out of production: `$scrypt-sim$ln=4,r=8,p=1$<salt>$<key>`. A real or shell ctx answers `credentials.malformed` `sim` for it. A fixture or a seed script run under `keel test` cannot put a working credential with a known salt into a production database. The sim reads both forms, so a test can load a production-shaped fixture.

The low sim cost follows from the mark. Once a real ctx refuses the form, a 128 MiB derivation in tests protects nothing, and the measured sim `hash` is 0.5 ms against 163 ms. The package's own conformance runs the real form at full cost.

No kernel gap is worked around (default 1): the capability registry is the extension point for an effect with real and simulated forms, and k.ctx is unchanged.

### D5. Cost and concurrency
- One `hash` or `verify` under a real ctx: 163 ms of one thread and 128 MiB, measured. The call is async and does not block the event loop.
- At most 2 derivations run at once per ctx. That is 256 MiB at the peak and leaves 2 of libuv's 4 pool threads for file reads and DNS lookups. A production process has one ctx, so the bound is per process.
- 16 more wait in call order. With 2 running, the last of them waits about 1.4 s.
- A call that finds 16 waiting resolves `keel.busy` with `{ limit: 16 }`, the kernel code a server answers 503 for. Nothing is derived for it.
- Prototype, 19 `verify` calls started at once: 18 `ok`, one `keel.busy`, 1,491 ms in all, the process at 374 MiB. A process answers about 12 checks a second.
- The bounds are constants in the first version (Questions 4).

### D6. Where it runs
`node:crypto`, so a `node` deployable only. Two rules, both from `./tools`, neither with a fix:

| Code | Reports | Message | Fix text in `keel explain` |
| --- | --- | --- | --- |
| E2201 | `@keel/std-credentials/server` imported or re-exported in a file that is not `*.server.ts`; test files are let through | `@keel/std-credentials/server outside a *.server.ts file` | call `credentials(ctx)` from an action in a `*.server.ts` file |
| E2202 | that import in a module a deployable with an adapter other than `node` serves; data `{ deployable, adapter }` | `credentials need a node deployable; '<name>' is <adapter>` | place the module in a `node` deployable (`keel codemod place`) and call its action from the client |

E2202 is what refuses a `client` deployable and its shells at check time: in a `client` deployable a `*.server.ts` loader runs in the browser or the webview, where `node:crypto` does not exist. It reads `topology.ts` as std.jobs' E2504 does. Each explain row is under 120 tokens.

Rules this RFC does not add:
- A `verify` result ignored. E1453 reports a dropped `Result`, and a mismatch is `err`, so a result that is read cannot be misread.
- A `Hashed` field marked `.pii`. The mark only adds redaction, so there is nothing to report.
- A `Hashed` field in a loader `output`. It would need to read a schema across files (Questions 7).

### D7. Tokens
Out of the first version. An API token checked on every request cannot pay 163 ms, and wants a fast hash that is also a lookup key. A fast hash is sound only for a secret with enough entropy, and nothing in a `Secret<string>` says how much it has. A `digest(secret)` next to `hash(secret)` would be one autocomplete away from a password. The follow-up shape that avoids this is in Questions 6. A reset token or an invite code is checked once, so `hash` and `verify` already fit it.

### D8. One documented way
With the package in place, the hand-written form is a second way to do the same thing. Each place that names it changes (Spec diff, Migration).

### Prototype
In the session scratchpad, `rfc0103/proto/`: the three entries (`Hashed`, the real and sim hashers behind `register`, two rules) and the example app above. Run once on Node 24.19.0 against the repo's `@keel/schema`, `@keel/ctx`, `@keel/store`, `@keel/router` and `@keel/check`.

| Case | Result |
| --- | --- |
| `tsc` over the prototype and the example, strict profile | no error |
| `check` over the example in a `node` deployable, every kernel rule | no diagnostic |
| The same with the deployable's adapter `client` | one E2202 per server file |
| A non-server file importing `./server` | one E2201 |
| `tx(t, { v: reveal(p.k) })`, for contrast | one E1112 |
| Real `hash`, then `verify` | 184 ms, 171 ms; `ok`, `rehash` false; 88 characters |
| `verify(secret, undefined)`, real | `credentials.mismatch` after 173 ms |
| One key or salt character changed | `credentials.mismatch` |
| `ln=30`; id `argon2id`; `hunter2` | `parameters`; `parameters`; `format` |
| A `ln=14` string built with `scryptSync` | `ok`, `rehash` true |
| Sim, two ctxs with seed 7; a ctx with seed 8 | equal strings; a different string |
| A sim string under real; a real string under sim | `credentials.malformed` `sim`; `ok`, `rehash` true |
| Empty; 1,025 bytes; 1,024 bytes | `credentials.length`; `credentials.length`; hashes |
| U+212B in the secret, U+00C5 at `verify` | `ok` |
| 19 `verify` calls at once | 18 `ok`, 1 `keel.busy`, 1,491 ms, 374 MiB |
| `reveal(` in the package | 1 |
| `scryptSync('password', 'NaCl', 64, { N: 1024, r: 8, p: 16 })` | RFC 7914's second test vector |

## Alternatives
- Free functions `hash(ctx, secret)` and `verify(secret, stored)`, as the backlog line spells them. Rejected: `verify` needs the ctx too (the queue, the sim form), and the names collide with an app's own `hash`. Questions 1.
- `verify` resolving `ok({ valid })`. Rejected (D2).
- `verify` returning the new string when the parameters are old. Rejected (D2).
- A plain `string` out, with no `Hashed`. Rejected: PRINCIPLES 4. The field would be `s.string()`, `verify` would take any string, and a generator would give text no `verify` can read.
- `Hashed` checking the parameter ranges. Rejected: a store whose state fails its schema cannot be restored, so one string from a newer version would take every account down after a rollback. `verify` answers `parameters` for that one account.
- Salt from `ctx.random.id`, as k.privacy says today. Rejected: 122 bits per draw where 128 are asked for, a kernel sentence k.ctx does not have (that a real `id` is from the system generator), and no way to mark what a sim made, since the package would not know its mode.
- A kernel `ctx.random.bytes(n)`. Rejected for this RFC: `id` is "the one way to mint an id or token" (k.ctx), and a registered capability already gives the package its own source. An encryption helper (RFC 0100 Questions 2) would need nonces and is the place to raise it.
- The system generator in every mode. Rejected: a sim run would store different bytes each time, and k.sim says every capability is deterministic by seed.
- One form in every mode, at full cost. Rejected: a seeded salt would be valid in production, and each test sign-in would cost 163 ms and 128 MiB.
- Argon2id. Rejected for now: `crypto.argon2` is not in Node 22, the supported floor and the deploy image, and a native dependency is a larger change than this package. `$argon2id$v=19$...` already fits `Hashed`, so a later version adds it and `rehash` moves each account (Questions 5).
- bcrypt or PBKDF2. Rejected: bcrypt is not in `node:crypto`, and OWASP lists PBKDF2 for FIPS needs only.
- N = 2^16, p = 2 (64 MiB, the same time). Kept as the fallback if 128 MiB is too much for the hosts Keel targets (Questions 4).
- No bound on concurrency. Rejected: 8 calls at once took 594 MiB and every pool thread (Problem).
- An unbounded queue. Rejected: under a flood each caller would wait longer than any client does, and the work would still run.
- A fast `digest` for tokens in this version. Rejected (D7).

## Spec diff
Token counts are ceil(chars/4) of the whole file after the change, measured on scratch copies of `spec/` at `dfff457f`.

### std.credentials (new, 1,069)
The file `spec/std/std.credentials.md`, in full:

````md
# std.credentials: Credential hashes
status: proposed

**Extension points.** Capability registry (k.ctx): `credentials`. Schema type registry: `credentials.Hashed`. Check rule registry: `@keel/std-credentials/tools` (E2201, E2202).

**API.** `@keel/std-credentials` is client-safe; `@keel/std-credentials/server` is Node only.
```ts
import { Hashed } from '@keel/std-credentials'               // *.schema.ts: password: Hashed
import { credentials } from '@keel/std-credentials/server'  // *.server.ts
const h = await credentials(ctx).hash(input.password)                    // Result<Hashed, E>
const r = await credentials(ctx).verify(input.password, user?.password)  // Result<{ rehash: boolean }, E>
```
- Both take the `Secret<string>` (k.privacy), so app code writes no `reveal`. The input is its text, NFKC-normalized, as UTF-8.
- `hash` resolves the stored form; an input that is empty or over 1,024 bytes is `credentials.length` (data `{ min: 1, max: 1024 }`).
- `verify` is `ok` only when the secret matches `stored` (`timingSafeEqual`); `rehash` is true when `stored` is not in the current form, and the caller then stores a new `hash`. No match, or an input `hash` refuses, is `credentials.mismatch`. `stored` `undefined` (no such account) derives one key and is `credentials.mismatch`. An unreadable `stored` is `credentials.malformed`, data `{ reason }`: `format` (not `Hashed`), `parameters` (an id or parameters not read) or `sim` (the sim form outside sim).
- Each error is one constant per code and `reason`: none holds a part of the secret or of `stored`, and nothing throws.
- `Hashed` (`credentials.Hashed`) is a format type over `s.string()`: `$id$params$salt$key`, `$v=<n>` allowed after the id, at most 256 characters. It checks the shape only, so a later version's string restores. It generates sim-form strings.

**Stored form.** `$scrypt$ln=17,r=8,p=1$<salt>$<key>`: `scrypt` (`node:crypto`) with N = 2^`ln`, a 16-byte salt and a 32-byte key in base64 without padding. `verify` reads `scrypt` with `ln` 14 to 18, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64.

**Modes.**
- **real.** The salt is `randomBytes(16)` of `node:crypto`, never `ctx.random`. A derivation holds 128 MiB off the event loop; per ctx 2 run at once and 16 wait in call order, and a call past that is `keel.busy` (data `{ limit: 16 }`).
- **shell.** As real.
- **sim.** The form is `$scrypt-sim$ln=4,r=8,p=1$<salt>$<key>`, its salt drawn from the capability seed and a call count, derived synchronously. It reads both forms. A real or shell ctx refuses it, so a string with a seeded salt verifies only under sim.

**Rules.** E2201 `@keel/std-credentials/server` imported outside a `*.server.ts` file, tests aside (no fix) · E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix).

**Conformance.**
- Under real and sim, for generated secrets, `verify` of a secret and its `hash` is `ok`, `rehash` false; of another secret, `credentials.mismatch`.
- A real `hash` has the stored form and parses with `Hashed`; two of one secret differ.
- Under real, a `hash` with one salt or key character changed is `credentials.mismatch`; `ln=30` and id `argon2id` are `credentials.malformed` `parameters`, and `hunter2` is `format`.
- `$scrypt$ln=14,r=8,p=1$` with a salt and that secret's `scryptSync` key verifies, `rehash` true.
- Under sim, ctxs with one seed give equal `hash` strings call by call, and two seeds do not; a sim `hash` and every generated `Hashed` are `credentials.malformed` `sim` under real and shell.
- `verify(secret, undefined)` is `credentials.mismatch`.
- An empty secret and one of 1,025 bytes are `credentials.length` from `hash` and `credentials.mismatch` from `verify`; 1,024 bytes hashes.
- A secret with U+212B verifies against the `hash` of the same text with U+00C5.
- Every `err` above deep-equals the one of its code and `reason` for another secret and `stored`.
- Under real, of 19 `verify` calls started at once, 18 are `ok` and one is `keel.busy`.
- A `*.server.ts` action passing the value of `credentials(ctx).hash(input.password)` to `tx` has no E1112 or E1105.
- E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `credentials`.
````

The aim was 900 tokens. The twelve conformance clauses are 354 of the 1,069, and the section stays 431 under the 1,500 limit.

### spec/std/README.md
The wave line "S8 adds std.db, std.workflows and std.shells." becomes "S8 adds std.db, std.workflows, std.shells and std.credentials." A row after std.shells:

> | std.credentials | Credential hashes | proposed | capability, schema type and check rule registries: `Hashed`, `hash`, `verify`, E2201-E2202 |

### spec/00-map.md (1,200 to 1,198)
Code ranges gains a last row, 32 chars with its line break (4,799 to 4,831, 1,208 tokens):

> | E220x | std.credentials | | |

Three trims pay 39:
- k.scaffold one line, "structural edits as operations" becomes "structural edits".
- k.testing one line, "given, do, expect; properties" becomes "given, do, expect" (the title says properties).
- Stdlib, "Sections and statuses: `spec/std/README.md`." becomes "Sections: `spec/std/README.md`."

After: 4,792 chars, 1,198 tokens. E220x is unused in `spec/`, `docs/`, `tasks/` and every `packages/*/src` at `dfff457f`; the orchestrator confirms it against any RFC written in parallel.

### k.privacy (1,361 to 1,363)
**Secrets**, the last sentence, "A credential is kept as a value derived from it in server code: a salted hash to check it (`node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual`).", replacement text:

> A credential is kept as a value derived from it in server code: `credentials(ctx).hash` and `.verify` (std.credentials) take the `Secret`, so no `reveal` is written.

No conformance header quotes the old sentence.

### Unchanged
k.ctx (1,434): no new method on `random`, and `register` is used as specified. k.reveal (709): no new sink, carrier or exception (D1). k.errors and k.server: `keel.busy` and its 503 are used as they stand. std.db: its On disk paragraph already says a derived value is stored as written.

## Conformance diff
Written by the `conformance-writer` from std.credentials, without the implementation. This RFC allows these files under `packages/std-credentials/conformance/**`; no existing conformance file changes.

| File | Clauses | Notes |
| --- | --- | --- |
| `round-trip.test.ts` | 1, 2, 6, 8 | Property, seed 1337: 100 runs under sim, 5 under real (163 ms each). |
| `stored-form.test.ts` | 3, 4 | The `ln=14` string is built in the test with `scryptSync`, which pins the derivation and the encoding from outside. RFC 7914's second vector anchors `scryptSync` itself. |
| `sim.test.ts` | 5 | Seeds generated; `Hashed`'s generator through `gen`. |
| `length.test.ts` | 7 | Multi-byte secrets, so the cap is in bytes. |
| `errors.test.ts` | 9 | For each code and reason, two different secrets and stored strings give deep-equal errors. |
| `busy.test.ts` | 10 | One real ctx, 19 calls; about 1.5 s. |
| `check.test.ts` | 11, 12 | `check()` with `@keel/std-credentials/tools` imported, as std.db's `e2151.test.ts` does. |

Headers quote each clause in full, as in `packages/std-db/conformance/`. The real-ctx cases run 30 to 40 derivations, about 6 s in all, in one worker.

No existing test goes red between the spec commit and the package lane: the suites that read every Rules code read `spec/kernel/*.md`, and E2201 and E2202 live in `spec/std/`.

**Property tests** in `packages/std-credentials/test/`, written by the lane:
- For generated parameters inside the read ranges and generated salt and key bytes, the stored text parses back to the same parts; any text `Hashed` refuses is `format`.
- For a sim `hash` with any one character replaced, `verify` is never `ok`.
- For generated strings and their NFC, NFD and NFKD forms, `verify` against one `hash` is `ok`.
- The queue, over a stubbed derivation and generated arrival orders: never more than 2 running, results in call order, `keel.busy` exactly when 16 wait.
- Every value of `Hashed`'s generator parses.
- The package's server sources, given to `check` under an app path, have no E1112; `reveal(` appears once.

## Lanes and build order
1. Orchestrator, one commit: the spec diff, `tooling/budgets.json` (three entries), `tooling/deps.json` (`std-credentials` after `std-tauri`).
2. `conformance-writer`: the conformance diff, in the `rfc:0103` PR.
3. Package lane, one agent, `packages/std-credentials` only: `src/Hashed.ts`, `src/server/` (accessor, `Hasher`, the real and sim implementations, the stored-form reader, the queue, `inputOf`), `src/tools/`, `test/`, `README.md` with the date the OWASP guidance was re-checked, a changeset. Dependencies: `@keel/ctx`, `@keel/schema`, and `@keel/check` and `@keel/compiler` for `./tools`. Expected `unsafe` count: 0, since `Hashed.parse` applies the brand.
4. Check text lane, `packages/check/src/internal/EXPLANATIONS.ts` only: the E1112 row's fix sentence becomes "pass the Secret itself, or store what credentials(ctx).hash returns (@keel/std-credentials)". Disjoint from lane 3; no behavior changes.
5. Orchestrator: the threat-model, skill and ledger lines below, `docs/ARCHITECTURE.md`'s storage paragraph gains the package name, backlog 0615 closed, the Questions filed.

Nothing in S8 depends on this package, and it depends on nothing unbuilt, so lanes 2 to 4 can run beside any other work.

**Threat model.** In **Secrets**, the last sentence, "An author who means to store a secret can always do so, and the documented form is a salted hash (k.privacy).", becomes:

> An author who means to store a secret can always do so, and the documented form is `credentials(ctx).hash` (std.credentials).

A new bullet after **Durable storage**:

> - **Credentials** (std.credentials). `credentials(ctx).hash` takes a `Secret` and gives a salted `scrypt` string (N = 2^17, r = 8, p = 1) that names its parameters; `verify` compares in constant time and says when to rehash. Real salts come from the system generator. A sim ctx's salts are seeded, its strings are marked, and a real ctx refuses them. An unknown account costs one derivation, so timing does not list accounts. A process runs 2 derivations at once and answers 503 past 16 waiting: a sign-in flood can deny sign-in, and rate limiting is the operator's. Not covered: a credential the app must present later, which needs encryption; a server-side key mixed into the hash; fast hashes for API tokens; password rules and lockout; a `Hashed` field an app returns from a loader.

**Skills.** `keel-compliance`, the Secrets sentence "store a salted `scrypt` hash" becomes "store what `credentials(ctx).hash(secret)` gives (`@keel/std-credentials/server`; field type `Hashed`; `verify(secret, user?.password)`, mismatch is `err`, rehash when `rehash`; E2201, E2202)". `keel-storage`, "store a salted hash" becomes "store `credentials(ctx).hash(secret)` (keel-compliance)".

**Ledger.** One item per conformance clause, `std.credentials#1` to `#12`, each at the rung its test gives: `probabilistic` for clauses 1 and 5, `example` for the rest. No claim about scrypt's strength or OWASP's guidance enters the ledger; it reports what the tests show (PRINCIPLES 11). Written on a quiet tree after lane 3.

## Migration
- Apps, modules, evals and scaffold templates: nothing changes. None holds a credential today.
- An app outside the repo that wrote the `scryptSync` form: it adds the dependency, changes the field to `Hashed`, re-encodes each stored hash as `$scrypt$ln=14,r=8,p=1$<salt>$<key>` (base64 without padding; the salt is the bytes it gave `scryptSync`), and calls `verify`. Each account moves to the current parameters on its next sign-in. A hash in another algorithm is not read.
- Docs: k.privacy, the E1112 explain row, `keel-compliance`, `keel-storage`, `docs/THREAT-MODEL.md`, `docs/ARCHITECTURE.md`.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| std.credentials | none | 1,069 |
| k.privacy | 1,361 | 1,363 |
| `spec/00-map.md` | 1,200 | 1,198 |

`keel explain E2201` and `keel explain E2202` are one row each, under 120 tokens.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings (esbuild, minified ESM, `packages: "external"`, gzip) on the prototype.

| Entry | Platform | Prototype | Limit proposed |
| --- | --- | --- | --- |
| `@keel/std-credentials` | browser | 469 B | 0.75kb (768) |
| `@keel/std-credentials/server` | node | 1,660 B | 2.25kb (2,304) |
| `@keel/std-credentials/tools` | node | 900 B | 1.25kb (1,280) |

The prototype's server half is one file; the lane's one-export-per-file layout and its error for a derivation Node refuses add to it, which is what the 644 B of room is for. `@keel/check` is unchanged in size: the explain sentence is 8 characters shorter.

## Risks
- Memory. Two derivations hold 256 MiB on top of the process. A host with less than 512 MiB cannot run sign-ins at these parameters (Questions 4).
- A sign-in flood. Past 18 calls in the air the answer is 503, for real users too. The bound protects the process, not the sign-in page.
- Tests never run N = 2^17. An app's suite sees the sim form; only the package's conformance runs the real one.
- Sim strings in a real database. A staging database filled by a test run holds `$scrypt-sim$` strings, and a real server answers `credentials.malformed` `sim` for each. That is D4 working, and the reason is in the error.
- A rollback after a parameter rise. A version that reads `ln` up to 18 answers `parameters` for a string with `ln=19`. `Hashed` still restores, so the store survives; those accounts cannot sign in until the newer version returns.
- NFKC folds compatibility forms, so two passwords that differ only in such forms are one password. A Node upgrade that changes Unicode tables changes the result only for code points unassigned before it.
- Timing. The unknown-account answer costs one derivation at the current parameters. An account whose stored string has older, cheaper parameters answers faster until it rehashes.
- `UV_THREADPOOL_SIZE` below 3 leaves one thread or none for file reads while two derivations run.
- The 1.4 s worst wait is this machine's. A slower host waits longer at the same bounds.

## Known limits
- A credential the app must present later, such as an OAuth refresh token or a third-party API key a user pastes in, cannot be hashed. It needs encryption under an app key, and Keel has no path for an app key from the environment (RFC 0100 Questions 2). This package does nothing for that case.
- No server-side key is mixed into the hash, for the same reason.
- Tokens checked on every request are out (D7).
- Password rules are the schema's `min` and `max`. There is no breached-password check, no lockout and no rate limit.
- A `Hashed` field in a loader `output` or a request-scope store reaches the browser, and no rule reports it (Questions 7).
- A password the app parses as `s.string` is a type error at `hash`, which is the intended push toward `s.secret`. The form-level warning is still RFC 0100 Questions 4.
- The string `reveal` returns inside the package lives until the collector frees it; only the byte buffers are zeroed.
- A sim ctx never answers `keel.busy`, so an app's handling of it has no test path yet.
- Stored hashes in another algorithm (bcrypt, PBKDF2, Argon2) are not read.

## Questions
1. The spelling. `credentials(ctx).hash(secret)` and `.verify(secret, stored)`, a capability accessor like `geo(ctx)`, or free functions `hash(ctx, secret)` and `verify(ctx, secret, stored)`. Recommendation: the accessor. It is the existing shape for a capability, it is one export, and it keeps `hash` and `verify` free as local names.
2. A wrong secret as `err`. `verify` resolves `ok` only on a match, and `credentials.mismatch` otherwise. Recommendation: accept, so the line every action already writes, `if (!r.ok) return err(r.error)`, is the safe one.
3. Salts and the sim form, a security decision. Real salts from `node:crypto` `randomBytes`, never from `ctx.random`; sim salts from the seed, in a marked, low-cost form a real ctx refuses. Recommendation: accept. The price is two forms and tests that do not run the production cost. The alternative, one form with a `ctx.random.id` salt, makes a seeded salt valid in production.
4. The numbers. N = 2^17, r = 8, p = 1; a 16-byte salt; a 32-byte key; input of 1 to 1,024 bytes, NFKC; 2 derivations at once and 16 waiting, as constants with no config. Recommendation: accept, with the OWASP guidance re-checked by the lane. If Keel's target hosts have under 512 MiB, take N = 2^16, p = 2 (64 MiB, the same time). A `std` config key for the two bounds can follow when an app measures a need.
5. Argon2id. OWASP's first choice, not in Node 22. Recommendation: scrypt now; add id `argon2id` when the supported Node floor has `crypto.argon2`, with `rehash` moving each account. No native dependency.
6. Tokens. Recommendation: a later RFC, in this package, shaped so a fast hash is reachable only for a token the package minted: `credentials(ctx).mint()` gives the token as a `Secret` plus its SHA-256 digest to store, and `digest(secret)` gives the lookup key for a presented token. A password can be passed to `digest`, but no stored digest ever comes from one. Until then a reset token uses `hash` and `verify`.
7. A stored hash reaching the browser. Recommendation: a backlog line for E2203, a `Hashed` node in a loader `output` schema, built when the checker's schema reader (E1111's) is exported to tools.
8. The explain row and k.privacy name a stdlib package from kernel text. k.deploy already names `@keel/std-db`. Recommendation: accept; the kernel imports nothing.

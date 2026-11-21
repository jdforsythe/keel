# std.tokens: Opaque tokens
status: implemented

**Purpose.** Opaque tokens an app mints and checks: API keys, invite links, one-time links. A fast hash is sound because every stored digest comes from `mint`, which draws 256 random bits. No password is hashed here: sign-in is the identity source's (k.user).

**Extension points.** Capability registry (k.ctx): `tokens`. Schema type registry: `tokens.Digested`. Check rule registry: `@keel/std-tokens/tools` (E2201-E2203). A module that uses the package lists it in `deps`.

**API.** `@keel/std-tokens` is client-safe; `@keel/std-tokens/server` is Node only.
```ts
import { Digested } from '@keel/std-tokens'     // *.schema.ts: { id: s.string(), digest: Digested }
import { tokens } from '@keel/std-tokens/server' // *.server.ts
const m = tokens(ctx).mint({ ttl: 3_600_000 })  // Result<{ token, id, digest, expiresAt }, E>
const found = tokens(ctx).check(input.token, (id) => rows.find((t) => t.id === id))  // Result<Row, E>
```
- `mint({ ttl })`: `ttl` is required, milliseconds as an integer from 60,000 to 31,536,000,000 (365 days), or `null` for a token that does not expire; any other value is `credentials.ttl` (data `{ min: 60000, max: 31536000000 }`). It returns the new `token` as a `Secret<string>`, its `id` (non-secret, the row's key), the `digest` to store, and `expiresAt`, `ctx.clock.now()` plus `ttl`, or `null`.
- The expiry is in `digest`, so the app stores no other field for `check` to read.
- The token leaves once, as `reveal(token)` in the `*.server.ts` file that sends it (in `tx`, storage, a log or a throw: E1112). Its `digest` never leaves (E2203).
- `check(token, find)` reads the id from the presented `Secret<string>`, calls `find(id)` once for the row (an object with `digest: Digested`), compares in constant time (`timingSafeEqual`), then reads `ctx.clock.now()`, and returns `ok(row)`. A presented value that is not in the token form (`find` is not called), a `find` that returns `undefined`, and a digest that does not match are `credentials.mismatch`. A matching token whose digest has an expiry at or before now is `credentials.expired`. An unreadable `digest` is `credentials.malformed`, data `{ reason }`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest that is not 32 bytes) or `sim` (a sim form outside sim).
- Both are synchronous and neither throws, a throw from `find` aside. Each error is one constant per code and `reason`.
- `Digested` (`tokens.Digested`) is a format type over `s.string()`: `$id$digest` or `$id$params$digest`, at most 128 characters. It checks the shape only and generates sim-form strings.

**Forms.** Token: `keel_<id>_<secret>`, `id` 16 and `secret` 64 lowercase hex characters (64 and 256 random bits), 86 characters. Digest: `$sha256$exp=<ms>$<digest>`, or `$sha256$<digest>` with no expiry: `<ms>` is `expiresAt` in decimal, `<digest>` the SHA-256 of the token's text in base64 without padding. There is no key.

**Modes.** Real and shell draw `id` and `secret` from `randomBytes` of `node:crypto`. Sim draws them from the capability seed and a call count and writes `keelsim_<id>_<secret>` and `$sha256-sim$...`; it reads both forms.

**Rules.** E2201 `@keel/std-tokens/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside (no fix) · E2202 that import in a module a deployable other than `node` serves, naming the deployable and its adapter (no fix). Each reads the file's own `import`, `export ... from` and `import()`; a `require` and a helper file re-exporting the entry are not followed · E2203 an `output` (`outputSchemas`, k.privacy-reads) for which `schemaHolds` of `Digested` is `'yes'` (no fix).

**Conformance.**
- Under real, `mint({ ttl: null })` gives a token of the token form whose id part is `id`, `expiresAt` `null`, and a `digest` `$sha256$<digest>` that parses with `Digested`; two mints share no `id`, `secret` or `digest`.
- `mint({ ttl })` for `ttl` 60,000 and 31,536,000,000 is `ok` with `expiresAt` `ctx.clock.now()` plus `ttl` and `exp=<expiresAt>` in `digest`; 59,999, 31,536,000,001, 60,000.5 and `NaN` are `credentials.ttl`.
- `String`, `JSON.stringify` and `util.inspect` of a minted `token` give `[secret]`.
- `check` of a minted token, with `find` returning a row holding its `digest`, is `ok` with that row, and `find` was called once with its `id`.
- Under real, `check` is `credentials.mismatch` for: a token with one `secret` character changed; one token's `id` with another's `secret`; `hunter2` (`find` not called); `find` returning `undefined`.
- Under sim, a token minted at clock 0 with `ttl` 3,600,000 is `ok` after `advance(3599999)`, `credentials.expired` after one more millisecond and after any later `advance`; a `ttl: null` token is `ok` after `advance(1e12)`.
- Another token presented against an expired row is `credentials.mismatch`, never `credentials.expired`.
- A row whose `digest` is `$md5$` plus 43 characters, or has `exp=soon`, is `credentials.malformed` `parameters`.
- Under sim, ctxs with one seed mint equal tokens and digests call by call, and two seeds do not; under real and shell, a sim token is `credentials.mismatch`, and a row with a sim digest or any generated `Digested` is `credentials.malformed` `sim`.
- In a `*.server.ts` file, with `m` a `mint` result, `tx(t, { token: reveal(m.value.token) })` and `console.log(reveal(m.value.token))` are each one E1112; `tx(t, { id: m.value.id, digest: m.value.digest })`, `reveal(m.value.token)` in a `service` call's `body`, and `check(input.token, find)` are none.
- E2201 and E2202 each fire on a fixture and not on its clean twin; `capabilities()` lists `tokens`.
- `import('@keel/std-tokens/server')` outside a `*.server.ts` file is E2201; `import type` from it is not.
- A page `loader` `output` and an API entry `output` holding `digest: Digested` are each one E2203; a store schema holding it is none.

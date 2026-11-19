# std.tokens: Tokens
status: conformance-covered

**Purpose.** A fast hash for secrets the package mints: API tokens, reset and invite tokens. It is sound because every stored digest comes from `mint`, which draws 256 random bits; a password takes std.credentials. Both are `@keel/std-credentials`.

**API.**
```ts
import { Digested } from '@keel/std-credentials'               // *.schema.ts: { id: s.string(), digest: Digested }
import { credentials } from '@keel/std-credentials/server'  // *.server.ts
const m = credentials(ctx).mint({ ttl: 3_600_000 })          // Result<{ token, id, digest, expiresAt }, E>
const found = credentials(ctx).check(input.token, (id) => rows.find((t) => t.id === id))  // Result<Row, E>
```
- `mint({ ttl })`: `ttl` is required, milliseconds as an integer from 60,000 to 31,536,000,000 (365 days), or `null` for a token that does not expire; any other value is `credentials.ttl` (data `{ min: 60000, max: 31536000000 }`). It returns the new `token` as a `Secret<string>`, its `id` (the token's non-secret part, the row's lookup key), the `digest` to store, and `expiresAt`, `ctx.clock.now()` plus `ttl`, or `null`.
- The expiry is in `digest`, so the app stores no other field for `check` to read.
- The token leaves once: the `*.server.ts` file that sends it calls `reveal(token)`. That value in `tx`, storage, a log or a throw is E1112 (k.reveal).
- `check(token, find)` reads the id from the presented `Secret<string>`, calls `find(id)` once for the row (an object with `digest: Digested`), compares in constant time (`timingSafeEqual`), then reads `ctx.clock.now()`, and returns `ok(row)`. A presented value that is not in the token form (`find` is not called), a `find` that returns `undefined`, and a digest that does not match are `credentials.mismatch`. A matching token whose digest has an expiry at or before now is `credentials.expired`. An unreadable `digest` is `credentials.malformed`, with std.credentials' reasons.
- Both are synchronous and neither throws, a throw from `find` aside. Each error is one constant per code and `reason`.
- `Digested` (`credentials.Digested`) is a format type over `s.string()`: `$id$digest` or `$id$params$digest`, at most 128 characters. It checks the shape only and generates sim-form strings.

**Forms.** Token: `keel_<id>_<secret>`, `id` 16 and `secret` 64 lowercase hex characters (64 and 256 random bits), 86 characters. Digest: `$sha256$exp=<ms>$<digest>`, or `$sha256$<digest>` with no expiry: `<ms>` is `expiresAt` in decimal, `<digest>` the SHA-256 of the token's text in base64 without padding. There is no key.

**Modes.** Real and shell draw `id` and `secret` from `randomBytes` of `node:crypto`. Sim draws them from the capability seed and a call count and writes `keelsim_<id>_<secret>` and `$sha256-sim$...`; it reads both forms. A real or shell ctx answers `credentials.mismatch` for a sim token and `credentials.malformed` `sim` for a sim digest.

**Rules.** E2201 and E2202 (std.credentials).

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

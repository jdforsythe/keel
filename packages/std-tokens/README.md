# @keel/std-tokens

**Spec:** std.tokens · **Status:** conformance-covered · **verified:** (none)

Opaque tokens for `node` deployables: API keys, invite links, one-time links. `tokens(ctx)` mints a token and checks a presented one against its stored digest. No password is hashed here: sign-in, and the passwords behind it, belong to the identity source (k.user).

## Contract

- **Public API:**
  - `@keel/std-tokens` (client-safe): `Digested` (`tokens.Digested`), a schema and its type.
  - `@keel/std-tokens/server` (Node, `*.server.ts`): `tokens(ctx): Tokens`, type `Tokens`:
    - `mint({ ttl: number | null }): Result<{ token: Secret<string>, id: string, digest: Digested, expiresAt: number | null }, credentials.ttl>`
    - `idOf(token: Secret<string>): Result<string, credentials.mismatch>`
    - `check<R extends { digest: Digested }>(token: Secret<string>, find: (id: string) => R | undefined): Result<R, credentials.mismatch | credentials.expired | credentials.malformed>`
  - `@keel/std-tokens/tools`: `serverImport` (E2201), `nodeDeployable` (E2202), `digestOutput` (E2203).
- **Invariants:**
  - Token: `keel_<id>_<secret>`, 16 and 64 lowercase hex characters from `randomBytes`. Digest: `$sha256$exp=<ms>$<digest>`, or `$sha256$<digest>` for `ttl: null`, the SHA-256 of the token's text in base64 without padding. `expiresAt` is the clock's whole milliseconds plus `ttl`. `ttl` is an integer from 60,000 to 31,536,000,000 or `null`.
  - `idOf` returns the id `check` passes to `find`, from the same parse, and `credentials.mismatch` for what `check` refuses before it calls `find` (a value not in the token form, and under real or shell a sim token). It reads no row, digest or clock, so `ok` means well formed, not valid; it is synchronous, never throws, and neither returns nor logs the secret part.
  - `check` hashes the presented token, compares it with the row's digest in constant time (`timingSafeEqual`), then reads `ctx.clock`; a `find` that returns `undefined`, `null` or a non-object is `credentials.mismatch`, and a throw from `find` passes through. A token is valid while `now < expiresAt` and `credentials.expired` from `now >= expiresAt`, an answer only the real token gets.
  - An unreadable digest is `credentials.malformed` with `reason`: `format` (not `Digested`), `parameters` (an id other than `sha256` or `sha256-sim`, a parameter other than `exp=<ms>`, or a digest text that is not the canonical base64 of 32 bytes) or `sim` (a sim digest outside sim).
  - Sim forms: `keelsim_` and `$sha256-sim$`, with bytes from the capability seed and a call count. Sim reads both forms; real and shell answer `credentials.malformed` `sim` for a sim digest and `credentials.mismatch` for a sim token.
  - Each error is one frozen value per code and `reason`, and holds no part of a token or a stored digest. No method throws, a throw from `find` aside; `mint` answers `credentials.ttl` for a missing or non-object argument.
  - Rules: E2201 and E2202 read a file's own static imports, re-exports and `import()` of `@keel/std-tokens/server`; type-only imports and re-exports pass, and a `require` or a helper file that re-exports the entry is not followed. E2201 lets through `*.test.*` and `*.spec.*` files, a top-level test directory and a test directory inside a module. E2203 is an `output` a file declares (`outputSchemas` of `@keel/check`: a `contract` entry's, a `loader` declaration's inline or through a `const`) for which `schemaHolds` of `Digested` is `'yes'`, through consts, schema files and re-exports, at the `output`; no fix. It does not see an `output` built by a factory call, given by `decl()` or taken from a package, nor a digest copied into an `s.string()` field.
- **Dependencies:** `@keel/check`, `@keel/compiler`, `@keel/ctx`, `@keel/schema`; `randomBytes`, `createHash` and `timingSafeEqual` of `node:crypto`.
- **Rungs:** conformance (example and property, real and sim), properties for `mint`, `idOf`, `check` and the generator.

## Tokens in an API route

A minted token leaves as `reveal(token)` into an `s.string()` field of an API action's `output`, once, in a `*.server.ts` file. A presented token arrives as the handler's `bearer`:

```ts
// in an action with output: s.object({ token: s.string() })
const minted = tokens(ctx).mint({ ttl: null })
if (!minted.ok) return err(minted.error)
// ... store minted.value.id and minted.value.digest ...
return ok({ token: reveal(minted.value.token) })

// in a handler that keeps its rows in a database: read the id, fetch the row, then check
const id = tokens(ctx).idOf(bearer)
if (!id.ok) return err({ code: 'keel.denied', message: 'Unknown token', data: null })
const row = await readRow(ctx, id.value)
const checked = tokens(ctx).check(bearer, () => row)

// in a handler that checks a presented token
if (bearer === undefined) return err({ code: 'keel.denied', message: 'No token', data: null })
const found = tokens(ctx).check(bearer, (id) => rows.find((r) => r.id === id))
if (!found.ok) return err({ code: 'keel.denied', message: 'Unknown token', data: null })
```

## Extension points

Uses the **capability registry** (k.ctx `register('tokens', { real, shell, sim })`), the **schema type registry** (`tokens.Digested`) and the **check rule registry** (k.check: E2201 to E2203 from `./tools`).

## Migration from `@keel/std-credentials`

- Tokens: replace the dependency with `@keel/std-tokens`; `import { Digested } from '@keel/std-tokens'`; `import { tokens } from '@keel/std-tokens/server'`; `credentials(ctx).mint` and `.check` become `tokens(ctx).mint` and `.check`; a module's `deps` names `@keel/std-tokens`. Stored digests and issued tokens keep working: their forms and the result codes are unchanged. Under sim, the tokens a seed gives change, since the capability's name feeds its seed (k.ctx).
- Passwords: `hash`, `verify`, `Hashed` and the `ln` config have no replacement in Keel. Hash and verify passwords in the sign-in library behind the identity source (k.user, k.mount). A stored `$scrypt$ln=…` string is `scrypt` from `node:crypto` with N = 2^ln, r = 8, p = 1, a 16-byte salt and a 32-byte key in base64 without padding, so a library or the app can verify it once and rehash to its own form. A `std: { '@keel/std-credentials': … }` entry is removed.

## Unsafe

count: 0

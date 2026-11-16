# @keel/std-credentials

**Spec:** std.credentials, std.tokens · **Status:** conformance-covered · **verified:** (none)

Password hashes and tokens for `node` deployables: `credentials(ctx)` hashes and verifies a `Secret`, and mints and checks tokens.

## Contract

- **Public API:**
  - `@keel/std-credentials` (client-safe): `Hashed` (`credentials.Hashed`), `Digested` (`credentials.Digested`), `CredentialsConfig` (`{ ln?: 17 to 20 }`), each a schema and its type.
  - `@keel/std-credentials/server` (Node, `*.server.ts`): `credentials(ctx): Hasher`, type `Hasher`:
    - `hash(secret: Secret<string>): Promise<Result<Hashed, credentials.length | keel.busy>>`
    - `verify(secret: Secret<string>, stored: Hashed | undefined): Promise<Result<{ rehash: boolean }, credentials.mismatch | credentials.malformed | keel.busy>>`
    - `mint({ ttl: number | null }): Result<{ token: Secret<string>, id: string, digest: Digested, expiresAt: number | null }, credentials.ttl>`
    - `check<R extends { digest: Digested }>(token: Secret<string>, find: (id: string) => R | undefined): Result<R, credentials.mismatch | credentials.expired | credentials.malformed>`
  - `@keel/std-credentials/tools`: `serverImport` (E2201), `nodeDeployable` (E2202).
- **Invariants:**
  - Stored password: `$scrypt$ln=<ln>,r=8,p=1$<salt>$<key>`, a 16-byte salt from `randomBytes` and a 32-byte key, base64 without padding. The input is the secret's text, NFKC-normalized, as UTF-8, 1 to 1,024 bytes.
  - `verify` reads id `scrypt` with `ln` 14 to 20, `r` 8, `p` 1 to 5, a salt of 8 to 64 bytes and a key of 16 to 64; anything else is `credentials.malformed`. `rehash` is true for a lower `ln`, a salt under 16 bytes or a key under 32. Keys compare with `timingSafeEqual`; input bytes and keys are zeroed after use.
  - Cost: the highest `ln` any module sets in `std: { '@keel/std-credentials': { ln } }`, 17 when none does. Per ctx:

    | `ln` | Memory per derivation | Run at once | Waiting |
    | --- | --- | --- | --- |
    | 17 | 128 MiB | 2 | 16 |
    | 18 | 256 MiB | 2 | 8 |
    | 19 | 512 MiB | 1 | 4 |
    | 20 | 1 GiB | 1 | 2 |

    A call past the waiting bound is `keel.busy` with that `limit`.
  - Token: `keel_<id>_<secret>`, 16 and 64 lowercase hex characters from `randomBytes`. Digest: `$sha256$exp=<ms>$<digest>`, or `$sha256$<digest>` for `ttl: null`, the SHA-256 of the token's text. `ttl` is an integer from 60,000 to 31,536,000,000 or `null`.
  - `check` hashes the presented token, compares it with the row's digest in constant time, then reads `ctx.clock`: a token is valid while `now < expiresAt` and `credentials.expired` from `now >= expiresAt`, an answer only the real token gets.
  - Sim forms: `$scrypt-sim$` (derived at N = 2^4, `ln` as a label), `keelsim_` and `$sha256-sim$`, with bytes from the capability seed and a call count. Sim reads both forms; real and shell answer `credentials.malformed` `sim` for a sim hash or digest and `credentials.mismatch` for a sim token.
  - Each error is one frozen value per code, `reason` and `limit`, and holds no part of a secret, a token or a stored string. No method throws.
- **Dependencies:** `@keel/check`, `@keel/compiler`, `@keel/ctx`, `@keel/schema`; `scrypt`, `scryptSync`, `randomBytes`, `createHash` and `timingSafeEqual` of `node:crypto`.
- **Rungs:** conformance (example and property, real and sim), properties for the stored-form reader, the queue, the cost, `verify`, `mint`, `check` and the generators.

Guidance checked: 2026-11-16, OWASP Password Storage Cheat Sheet, scrypt: N = 2^17, r = 8, p = 1 at the least.

## Extension points

Uses the **capability registry** (k.ctx `register('credentials', { real, shell, sim })`), the **schema type registry** (`credentials.Hashed`, `credentials.Digested`), **std config** (k.module: `CredentialsConfig` registered under `@keel/std-credentials`) and the **check rule registry** (k.check: E2201 and E2202 from `./tools`).

## Unsafe

count: 0

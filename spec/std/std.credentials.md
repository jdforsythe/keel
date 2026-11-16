# std.credentials: Credential hashes
status: conformance-covered

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

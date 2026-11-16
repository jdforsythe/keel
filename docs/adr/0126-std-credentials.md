# ADR-0126: `@keel/std-credentials` hashes and checks a `Secret` through a capability; real salts come from the system generator and a sim's strings are marked and refused (RFC 0103)

**Status:** proposed; the user approves the API shape before any build (2026-11-16).

**Context.** k.privacy tells an app to keep a credential as a salted `scrypt` hash written by hand: `node:crypto` `scrypt`, a `ctx.random.id` salt, `timingSafeEqual` (ADR-0123). No package has a helper. The hand-written form goes wrong in ordinary ways. Node's `scryptSync` defaults to N = 2^14, where OWASP asks for 2^17 (to be re-checked at build); N = 2^17 throws until `maxmem` is raised; the sync call blocks the event loop for 163 ms; `timingSafeEqual` throws on unequal lengths; the parameters are not stored, so they can never rise; and an unknown account answers faster than a known one. The file also holds `reveal` beside `tx`, and E1112 ends a flow at any call, so it cannot tell `scrypt` from MD5 or a random salt from a constant one. `ctx.random` has `id` and `float` and no bytes method; a real `id` is `crypto.randomUUID()` and a real `float` is `Math.random()`; k.ctx does not say where a real `id` comes from. Node 22, the supported floor and the deploy image, has `scrypt` and no Argon2. Measured: one derivation at N = 2^17, r = 8, p = 1 takes 163 ms and 128 MiB, and eight at once take 594 MiB and every thread of the pool.

**Decision.**
- D1: a stdlib package with three entries. `@keel/std-credentials` exports the schema `Hashed` and is client-safe. `@keel/std-credentials/server` exports the accessor `credentials` and type `Hasher`, Node only. `@keel/std-credentials/tools` registers E2201 and E2202. The package calls `reveal` once, so app code calls it never, and E1112 and E1105 have nothing to report; k.reveal is unchanged.
- D2: `credentials(ctx).hash(secret: Secret<string>)` resolves `Result<Hashed, credentials.length | keel.busy>`. `credentials(ctx).verify(secret, stored: Hashed | undefined)` resolves `Result<{ rehash: boolean }, credentials.mismatch | credentials.malformed | keel.busy>`. A wrong secret is `err`. `rehash` says the stored parameters are not the current ones, and the caller stores a new `hash`. `stored` `undefined` costs one derivation and is `credentials.mismatch`. Each error is one constant per code and reason, and nothing throws.
- D3: `scrypt` at N = 2^17, r = 8, p = 1, a 16-byte salt, a 32-byte key, stored as `$scrypt$ln=17,r=8,p=1$<salt>$<key>`. `verify` reads `ln` 14 to 18, `r` 8, `p` 1 to 5. Keys are compared with `timingSafeEqual`. The input is NFKC UTF-8 of 1 to 1,024 bytes. `Hashed` checks the shape only, so a newer version's string still restores.
- D4: the package registers capability `credentials`. Real and shell draw the salt from `randomBytes(16)`; `ctx.random` is not used. Sim draws it from the capability seed, writes `$scrypt-sim$ln=4,r=8,p=1$...`, and derives synchronously. A real or shell ctx refuses the sim form with reason `sim`.
- D5: under a real ctx 2 derivations run at once per ctx and 16 wait in call order; a call past that resolves `keel.busy`, a 503 from an action.
- D6: E2201 reports the server entry imported outside a `*.server.ts` file. E2202 reports it in a module a deployable other than `node` serves, which covers `client`, `static` and shells.
- D7: fast hashes for high-entropy tokens are not in the first version.
- D8: k.privacy, the E1112 explain row, the `keel-compliance` and `keel-storage` skills and the threat model name `credentials(ctx).hash` in place of the hand-written form.

**Alternatives.**
- Free functions `hash(ctx, secret)` and `verify(secret, stored)`. Rejected: both need the ctx, per-mode implementations and per-ctx state are what a capability is, and std.geo already spells one `geo(ctx)`.
- `verify` resolving `ok({ valid })`. Rejected: `if (!r.ok) return err(r.error)` would pass a wrong password.
- A plain `string` out. Rejected: the field would be `s.string()`, with no generator and no type for `verify` to ask for.
- Salt from `ctx.random.id`. Rejected: 122 bits per draw, a promise k.ctx does not make, and no way to mark what a sim made.
- A kernel `ctx.random.bytes`. Rejected here: `id` is the one way to mint a token, and the registry already gives the package its own source.
- One form in every mode at full cost. Rejected: a seeded salt would be valid in production, and each test sign-in would cost 163 ms and 128 MiB.
- Argon2id. Rejected for now: not in Node 22 without a native dependency. The stored form has room for it.
- No bound, or an unbounded queue. Rejected: memory and the thread pool in the first case, unbounded waits in the second.
- `Hashed` checking parameter ranges. Rejected: one out-of-range string would stop a whole store from restoring.

**Consequences.**
- Storing a password is two lines in an action and one schema field, with no `reveal`, no parameter and no salt in app code.
- A later version raises the parameters by changing constants; each account moves on its next sign-in.
- A credential made under `keel test` never verifies on a real server, and app tests do not run the production cost; the package's conformance does.
- A process holds up to 256 MiB for derivations, answers about 12 checks a second, and answers 503 past 18 calls in the air.
- The docs have one way to keep a credential. An app that hand-wrote the `scryptSync` form re-encodes its hashes as `$scrypt$ln=14,...` and they verify with `rehash` true.
- Still open: a credential the app must present later (encryption, RFC 0100 Questions 2), a server-side key in the hash, fast token hashes, a rule for a `Hashed` field in a loader `output`, and Argon2id.
- Budgets: `@keel/std-credentials` 0.75kb, `/server` 2.25kb, `/tools` 1.25kb; std.credentials is 1,069 tokens; `spec/00-map.md` stays under 1,200 with three trims.

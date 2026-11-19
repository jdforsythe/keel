---
"@keel/std-tokens": minor
---

`@keel/std-credentials` is `@keel/std-tokens`: opaque tokens for API keys, invite links and one-time links, and no password hashing. `.` exports the client-safe schema `Digested` (`tokens.Digested`); `./server` exports `tokens(ctx)`, type `Tokens`, whose `mint({ ttl })` and `check(token, find)` give and read `keel_<id>_<secret>` tokens stored as `$sha256$exp=<ms>$<digest>`; `./tools` keeps E2201 and E2202 for `@keel/std-tokens/server`. The capability is `tokens`. Result codes keep their names: `credentials.mismatch`, `credentials.expired`, `credentials.malformed`, `credentials.ttl`.

Migration from `@keel/std-credentials`:

- Tokens: replace the dependency with `@keel/std-tokens`; `import { Digested } from '@keel/std-tokens'`; `import { tokens } from '@keel/std-tokens/server'`; `credentials(ctx).mint` and `.check` become `tokens(ctx).mint` and `.check`; a module's `deps` names `@keel/std-tokens`. Stored digests and issued tokens keep working: their forms and the result codes are unchanged. Under sim, the tokens a seed gives change, since the capability's name feeds its seed (k.ctx).
- Passwords: `hash`, `verify`, `Hashed` and the `ln` config have no replacement in Keel. Hash and verify passwords in the sign-in library behind the identity source (k.user, k.mount). A stored `$scrypt$ln=…` string is `scrypt` from `node:crypto` with N = 2^ln, r = 8, p = 1, a 16-byte salt and a 32-byte key in base64 without padding, so a library or the app can verify it once and rehash to its own form. A `std: { '@keel/std-credentials': … }` entry is removed.

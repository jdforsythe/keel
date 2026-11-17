---
name: keel-compliance
description: "Keel personal data and compliance: .pii(class), s.secret/reveal, autocomplete and data-k-pii, the content security policy's limits on app code, pii canary tests, keel evidence and --verify; E1105, E1111, E1113, E1570, E1571, E1821, E106x, E2201, E2202"
---

# Personal data, policy, evidence

Spec: `pnpm spec k.privacy`, `k.security`, `k.evidence`. Read `docs/COMPLIANCE.md` first.

**Personal data:** `.pii('name' | 'contact' | 'location' | 'identifier' | 'financial' | 'special' | 'network' | 'content')` on each person's field in a `*.schema.ts`; never in a route's `params`/`search` (E1111). A control bound to it gets `data-k-pii` (input masked) and needs `autocomplete` (`email`, ...; `off` for others' data; E1821). Secrets: `s.secret(inner)`, read with `reveal` only in `*.server.ts` (E1105). A `reveal`ed value is plain data: reaching a log, `storage`, a file, `tx`/`store` or a `throw` is E1112, encoded (`btoa`) or not; store what `credentials(ctx).hash(secret)` gives (`@keel/std-credentials/server`, in `deps`; field type `Hashed`; `verify(secret, user?.password)`, mismatch is `err`, rehash when `rehash`; cost `std: { ln }` 17 to 20; tokens: `mint({ ttl })` (ms, or `null`) gives `{ token, id, digest, expiresAt }`, store `id` and `digest: Digested`, return `reveal(token)` once, in an API action's `output` as an `s.string()` field (an `s.secret` in an `output` is E1113); a presented token arrives as the API route's `bearer`, `check(bearer, find)` answers `credentials.expired` past the ttl; E2201, E2202). `.pii` data is stored unencrypted: encrypt at the database or disk.

**Policy:** `node` pages carry a fixed nonce CSP: no inline script, `<style>`, `style` or `on*` attribute, and no other origin: a literal absolute URL in `src`, `action`, `Image src` (E1570) or given to `ctx.net.fetch` or `service({ base })` in client code (E1571) fails. A `client` build gets `dist/<name>/csp.txt`. Keep privileged caller lists on the server, read by a guard.

**Canary test:** fill every path of `piiPaths(S)`, then find no `piiValues(S, v)` in log `write` lines or sim `session(ctx).taken()`.

**Evidence:** `keel evidence [--out dir] [--audit audit.json]` runs check, test and ledger and signs the bundle with `KEEL_EVIDENCE_KEY` (Ed25519 PKCS#8 PEM, env only; else E1061). `keel evidence --verify <dir> --key <keyId>` checks it (no or wrong `--key`: E1063; a changed or extra file: E1062).

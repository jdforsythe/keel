---
name: keel-compliance
description: "Keel personal data and compliance: .pii(class), clientPii, s.secret/reveal, autocomplete and data-k-pii, the content security policy's limits on app code, the persistent caller, pii canary tests, keel evidence and --verify; E1105, E1107, E1111, E1113, E1570, E1571, E1821, E106x, E2201, E2202"
---

# Personal data, policy, evidence

Spec: `pnpm spec k.privacy`, `k.security`, `k.evidence`, `k.leave`, `k.user`; `docs/COMPLIANCE.md`.

**Personal data:** `.pii('name' | 'contact' | 'location' | 'identifier' | 'financial' | 'special' | 'network' | 'content')` on each person's field in a `*.schema.ts`, a user id the app stores included; never in a route's `params`/`search` (E1111, as for `s.secret`: post a token as an action input). A store a client file reaches ships its state to the browser: list each `.pii` class it holds in the module manifest's `clientPii` (E1107). A control bound to a marked field gets `data-k-pii` and needs `autocomplete` (`off` for others' data; E1821). `.pii` data is stored unencrypted: encrypt at the database or disk.

**Secrets:** `s.secret(inner)`, `reveal` only in `*.server.ts` (E1105); a revealed value reaching a log, `storage`, a file, a store or a `throw` is E1112. Store `credentials(ctx).hash(secret)` (`@keel/std-credentials/server`; `verify`); `mint({ ttl })`: store `id` and `digest`, return `reveal(token)` once as an `s.string()` output (an `s.secret` output is E1113); `check(bearer, find)`; E2201, E2202.

**Caller:** `caller: { days }` on a `node` deployable makes the caller hash a long-lived device identifier, class `network`: `pii.json` records `caller: { days, class: 'network' }`.

**Policy:** `node` pages carry a fixed nonce CSP: no inline script, `<style>`, `style` or `on*` attribute, and no other origin: a literal absolute URL in `src`, `action`, `Image src` (E1570) or given to `ctx.net.fetch` or `service({ base })` in client code (E1571) fails.

**Canary:** fill `piiPaths(S)`, then find no `piiValues(S, v)` in log lines or `session(ctx).taken()`.

**Evidence:** `keel evidence [--out dir] [--audit audit.json]` signs check, test and ledger with `KEEL_EVIDENCE_KEY` (Ed25519 PKCS#8 PEM, env only; else E1061). `keel evidence --verify <dir> --key <keyId>` checks it (no or wrong `--key`: E1063; a changed or extra file: E1062).

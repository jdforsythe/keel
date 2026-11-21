---
name: keel-compliance
description: "Keel personal data and compliance: .pii(class), clientPii, s.secret and reveal, autocomplete on pii controls, what leaves the browser or lands in a log, the content security policy's limits on app code, the caller lifetime, sessions redaction, pii canary tests, keel evidence and --verify; E1105, E1107, E1111, E1112, E1113, E1570, E1571, E1590, E1591, E1821, E1578, E2201, E2202, E1061, E1062, E1063"
---

# Personal data, secrets, policy, evidence

Exact rules: `keel docs k.privacy`, `k.reveal`, `k.leave`, `k.security`, `k.evidence`, `k.user`, `std.sessions`, `std.tokens`. `keel explain <code>` gives one diagnostic; `keel docs --for <code>` its section.

## Mark data

```ts
// Registration.schema.ts
import { s } from "@keel/schema";

export const Registration = s.object({
  name: s.string({ min: 1 }).pii("name"),
  email: s.string().pii("contact"),
  password: s.secret(s.string({ min: 12 })),
});
export type Registration = s.infer<typeof Registration>;
```

- `.pii(class)` goes on each field that holds a person's data, in a `*.schema.ts` file; classes are `name`, `contact`, `location`, `identifier`, `financial`, `special`, `network`, `content`. A stored user id is marked too.
- Marked and secret fields belong in an action `input`, never in a route's `params` or `search`: a URL reaches history and proxy logs Keel cannot redact (E1111). Post a token or an id as action input.
- `.pii` values serialize where the app sends them, are stored as written (encrypt the database or disk), and are redacted in session capture, server logs, error text and the evidence bundle.
- A store a client file reaches ships its state in `#k-state`. List each `.pii` class such a store holds in the module manifest, or `keel check` reports E1107 and the fix adds the class:

```ts
// module.ts
import { module } from "@keel/compiler";

export default module({
  id: "accounts",
  deps: [],
  capabilities: [],
  public: { exports: [], routes: [] },
  clientPii: ["name", "contact"],
});
```

- A control bound to a marked field (`Field.bind`, `keel docs k.forms`) carries `data-k-pii` and needs an `autocomplete` value, or the render check reports E1821 (`off` for another person's data).

## Secrets and reveal

`s.secret(inner)` parses to a `Secret<T>` that encodes, stringifies and logs as `"[secret]"`. `reveal(secret)` reads it and is allowed only in `*.server.ts` files (E1105, tests included). A revealed value reaching a log, `ctx.storage`, a file, store state or a `throw` is E1112: hash it first (a hash call ends the flow). A `return` is not a sink. An `s.secret` node in a loader or action `output` is E1113: return `reveal(token)` as an `s.string()` output.

Keel hashes no password; sign-in is the identity source's (`keel docs k.user`). Opaque API keys and invite links use `tokens(ctx)`:

```ts
// postToken.server.ts
import { action } from "@keel/router";
import { err, ok, reveal, s } from "@keel/schema";
import { tokens } from "@keel/std-tokens/server";

const Asked = s.object({});
const Minted = s.object({ token: s.string(), id: s.string() });

export const postToken = action({ input: Asked, output: Minted }, (_input, _args, ctx) => {
  const minted = tokens(ctx).mint({ ttl: 3_600_000 });
  if (!minted.ok) return err(minted.error);
  return ok({ token: reveal(minted.value.token), id: minted.value.id });
});
```

Store `id` and `digest` (type `Digested` from `@keel/std-tokens`) in a store; `tokens(ctx).check(bearer, (id) => row)` verifies. `@keel/std-tokens/server` imports only in `*.server.ts` files (E2201) and in `node` deployables (E2202). A secret hard-coded in a schema, `routes.ts` or a helper ships to the browser: read it from the environment in a `*.server.ts` file.

## Caller

`caller: { days }` on a `node` deployable in `topology.ts` (integer 1 to 400; E1578 otherwise) makes the caller cookie last that long. The caller hash is a device identifier of class `network`; `pii.json` records it. A std.sessions recording keeps no `meta.caller`; a caller hash in store state needs `.pii('network')`. The caller grants nothing.

## Content security policy

Every `node` document carries a fixed policy with a per-response nonce. App code uses no inline script, `<style>` element, `style` attribute or `on*` attribute, and loads nothing from an undeclared origin. A literal absolute `http(s)` URL in `src`, `action`, `srcset` or `Image src` is E1570; one given to `ctx.net.fetch` or `service({ base })` in client-reachable code is E1571 (fine in `*.server.ts`). Use same-origin paths, a configured base URL in a server file, or declare the origin: `origins: { img: { 'https://cdn.example': 'photos' } }` on the deployable in `topology.ts`. Directives are `img`, `media`, `font`, `connect`, `frame` (exact https origin, or http on localhost, with a one-line reason; E1590 malformed, E1591 repeated); a declared origin's URL is not E1570 or E1571. Scripts and styles take no declaration. `keel build` writes a `client` or `static` deployable's policy to `csp.txt`. Browser violation reports log as `csp` records with no path or query.

## Canary test

Fill a schema with generated values and assert none reaches a sink: `piiPaths(S)` lists marked paths, `piiValues(S, v)` gives the strings and numbers under them (both from `@keel/schema`). Under a sim ctx, check the captured log lines and `session(ctx).taken()` hold none of them.

## Evidence

`keel evidence [--out <dir>] [--audit audit.json]` runs check, test and ledger and writes a signed bundle (default `evidence/<date>`). The key is `KEEL_EVIDENCE_KEY`, an Ed25519 PKCS#8 PEM, from the environment only (E1061 otherwise). `keel evidence --verify <dir> --key <keyId>` re-checks signature and hashes (E1062 a file changed, E1063 a key or signature mismatch). A failing check or test still writes the bundle and exits 1 with E1060. `pii.json` lists every marked path, each sink and its ledger rung; `security.json` each deployable's declared origins and reasons.

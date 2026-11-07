# Threat model (seed)

Assets: user data in stores and logs; secrets in server env; session files. Adversaries: web attackers (XSS, CSRF, injection), malicious dependencies, agents reaching for `unsafe`.

Kernel commitments:

- **Output.** Escaped by default. One URL policy covers `href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `ping` (http, https, mailto, tel only; `srcdoc` is always `about:blank`); the runtime enforces it and E1003 reports literals it would blank (RFC 0024, red-team 0084).
- **Secrets.** `s.secret` values (`Secret<T>`) serialize and log only as `"[secret]"`, never restore from JSON, and are read only by `reveal` in `*.server.ts`. E1105 (`packages/check/src/rules/revealInServerFile.ts`) reports `reveal` anywhere else in app code (RFC 0026).
- **Server and client split.** `.server.ts` cannot reach the client. Documents load runtime JS only when a page has islands, so a static page carries no module script (RFC 0037). Built client assets are read once at startup from the deployable's build directory and served only from that fixed set, so a request path never reaches the filesystem (RFC 0048). Only files whose real path is inside `assets/` are read: no symlink or `..` manifest entry leads out. Every asset response is `nosniff`. Only files the manifest names with a content hash are `immutable`; others are `no-cache` (RFC 0057).
- **Dependencies and code.** Parameterized queries only (stdlib db). `unsafe.*` is justified and counted.
- **Mode.** Servers default to production; dev serves inspect and error text (RFC 0022).
- **Writes.** A write needs same-site proof (`Sec-Fetch-Site`, `Origin`, or `x-keel`), else 403 `keel.denied`; submitted values drop `__proto__`, `constructor`, `prototype` (RFC 0022). An action body over `maxBodyBytes` (default 1 MiB) is 413 `keel.payloadTooLarge` and nothing runs (RFC 0024).
- **Inspect.** Dev only. It answers a loopback or listed host whose `Origin` is its own or listed; an absent `Origin` is admitted for GET only, so a POST needs a matching `Origin` (RFC 0022, RFC 0024). The document is decided before the request scope exists, so it never lists another request's stores (RFC 0042). Inspector sections come from `read(ctx)` hooks that stdlib code registers, and the viewer shows each value as JSON; a `Secret` in a section value encodes as `"[secret]"` (RFC 0042).
- **State in the page.** `#k-state` carries only stores created in the request scope (components). Stores a loader or action creates through `stores` live for one request and persist through `ctx.storage` under `keel.store.<id>`; they never enter `#k-state`, and no process-shared log can be exposed (`createApp({ expose })` is gone) (RFC 0044, superseding the `expose` opt-in of RFC 0022).
- **Request isolation.** Every request has its own isolated store registry and its own store instances, so overlapping requests cannot read each other's half-done writes (RFC 0022, RFC 0044).
- **Caller identity.** The caller cookie (`HttpOnly; SameSite=Lax; Path=/`) is minted on a write that has none. It is a per-browser token. On https (`createApp({ secure })`, default the request scheme) it is `__Host-keel-caller` with `Secure`, which no sibling subdomain can set; on http it is `keel-caller`. Its value is HMAC-signed under `createApp({ secret })` (at least 32 bytes, else E1556; a production start without one logs W1556), and a value the server did not sign counts as none (RFC 0057). Loaders and actions see only its base64url SHA-256 as `caller`, which apps record in tx `meta` to scope undo, so a stored snapshot never holds a cookie that could be replayed (RFC 0054). It is not authentication: anyone who holds the cookie is that caller (RFC 0044). Residual risk: over http, or behind a TLS proxy without `secure: true`, a sibling host can still plant a signed value it obtained. Without a shared `secret`, callers reset per restart and per instance, which fails closed (RFC 0057).
- **Stored logs.** A store keeps at most `logLimit` log entries (default 256), so a saved snapshot, and the work to restore it per request, stays bounded (RFC 0054).

Grows per package.

verified: 093c84e7d14d40944ab0959b34f7dfa41af6bf37

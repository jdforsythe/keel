# ADR-0094: one fixed nonce policy with Trusted Types, reports to the app's own log (RFC 0083)

**Status:** accepted (2026-11-10), user decisions D3 and D6, under the WORKFLOW RFC defaults 4, 5 and 6.

**Context.** No Keel response carried a Content-Security-Policy, Referrer-Policy, frame or HSTS header; only built assets were `nosniff`. Served documents held no inline script but the `application/json` `#k-state` block, no inline style and no `on*` attribute; the runtime's only HTML-string sink was `template()`, fed by compiler output; Vite's preload helper in a client build reads `meta[property=csp-nonce]`.

**Decision.** A new kernel section, k.security, which also takes k.server's caller-cookie sentence and clause. Every `createApp` response carries six fixed headers, and HSTS on https. Every document carries one policy with no option: a per-response nonce (two `ctx.random.id` values) with `'strict-dynamic'`, `default-src 'none'`, `'self'` for styles, images, fonts and connections, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`, `require-trusted-types-for 'script'` with the single policy `keel` that `template()` uses, and reports to `POST /__keel/csp`. Dev sends it as `Report-Only` with `'unsafe-inline'` styles for Vite. The report endpoint skips the write proof (it changes no state), caps bodies at 16 KiB and logging at 100 reports per 60 s, and logs an origin and a route id only. `client` and `static` deployables get `dist/<name>/csp.txt` with `script-src 'self'` (D6). E1570 and E1571 report cross-origin URLs the policy would block.

**Alternatives.**
- `script-src 'self'`, rejected for `node` documents: bypassable through same-origin files that parse as script.
- A hash-based policy, rejected: Keel documents have no inline script to hash.
- A `createApp({ csp })` option, rejected: every option widens the policy.
- A meta policy in `client` builds, rejected (D6): no `frame-ancestors` or reporting, and it would block `apps/inspector`'s cross-origin fetches.
- A third-party report collector, rejected (D3): it would receive document URLs.

**Consequences.**
- Documents are not shared-cacheable; they were already per request.
- Trusted Types is enforced where the engine implements it (Chromium); elsewhere the nonce policy and escaping remain.
- golden-1 and golden-2 change no source (D4); their `api` responses gain headers.

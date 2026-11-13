# k.security: Response headers, CSP and the caller cookie
status: conformance-covered

**Headers.** Every `createApp` response (documents, JSON, event streams, assets, redirects, errors) carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and `Permissions-Policy: camera=(), microphone=(), payment=(), usb=()`; on https (the cookie's rule below) also `Strict-Transport-Security: max-age=63072000`.

**Policy.** Every document carries `Content-Security-Policy` (`Content-Security-Policy-Report-Only` in dev) with `Reporting-Endpoints: keel-csp="/__keel/csp"`:
```
default-src 'none'; script-src 'nonce-<n>' 'strict-dynamic'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none';
object-src 'none'; require-trusted-types-for 'script'; trusted-types keel; report-uri /__keel/csp; report-to keel-csp
```
`<n>` is new per response: two `ctx.random.id('Nonce')` values without hyphens. A document is `Cache-Control: private, no-store`, so no cache replays its nonce. The document writes `nonce="<n>"` on its module script and `<meta property="csp-nonce" nonce="<n>">` in the head, which Vite's preload helper copies to the links it adds; `#k-state` is `application/json` and runs nothing. Dev adds `'unsafe-inline'` to `style-src` for Vite's injected styles. Other responses carry `default-src 'none'; frame-ancestors 'none'`. The policy has no option, so no app widens it.

**Trusted Types.** Where `globalThis.trustedTypes` exists, the runtime's `template()` builds its compiler HTML through the policy `keel`, created once per realm and shared by every runtime copy (a policy the browser refuses throws); a string assigned to any other HTML sink throws.

**Reports.** `POST /__keel/csp` takes `application/csp-report` and `application/reports+json` bodies up to 16 KiB (else 413, nothing logged) without the write proof, since it changes no state, and answers 204. Each report is one `csp` log record `{ kind: 'csp', directive, blocked, route }`: `blocked` is `inline`, `eval`, `trusted-types` or the blocked URL's origin; `route` is the route id the document URL matches, else `-`. No path, query or sample is logged. In each 60 s of `ctx.clock` at most 100 reports are logged, at most 10 per source (the last `x-forwarded-for` entry, else the peer address; held for the window, never logged; none: the 100 only; it binds behind a proxy that appends the header); the rest are counted, and the window's end writes one `csp` record `{ kind, dropped }`.

**Caller cookie.** The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, `Secure` on https (`createApp({ secure })`; default the URL's or `x-forwarded-proto`, W1557 in production), else `keel-caller`.

**Other deployables.** `client` and `static` documents are served by their host. `keel build` writes their policy to `dist/<name>/csp.txt`: the one above with `script-src 'self'`, no nonce and no report directives, and `connect-src` adding each `keel-peer` origin (k.hosting). A `client` `index.html` a `node` deployable serves as its `host` carries that policy.

**Rules.** E1570 a literal absolute `http(s)` URL in `src`, `poster`, `data`, `srcset`, `action`, `formaction` or `Image src`: the policy blocks another origin (fix: none) · E1571 a literal absolute `http(s)` URL given to `ctx.net.fetch` or `service({ base })` in client-reachable code (E1004's reachability) · E1576 a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, re-export, or literal `import()` or `require` in a file outside `packages/`, `node_modules/` and `.keel/`, tests included: internal entries are kernel and stdlib seams such as the server state runner (fix: none).

**Conformance.**
- Every `createApp` response, a 404, a 413 and an asset included, carries the six headers; `Strict-Transport-Security` only on https.
- A production document carries the policy above, and its nonce equals the `nonce` of its module script and of `<meta property="csp-nonce">`; two documents under one sim ctx carry different 64-character nonces.
- A dev document carries `Content-Security-Policy-Report-Only` with `'unsafe-inline'` in `style-src` and nowhere else; JSON and event-stream responses carry `default-src 'none'; frame-ancestors 'none'`.
- No document of the fixture app has an inline script other than `#k-state`, a `<style>`, a `style` attribute or an `on*` attribute.
- A `csp-report` POST answers 204 and logs one `csp` record whose `blocked` is the blocked URL's origin and `route` the document's route id; no record holds the document's path or query.
- The 101st report within 60 s of the sim clock is not logged; one `csp` record with `dropped: 1` follows the window; a 17 KiB body is 413 and logs nothing.
- With a stub `trustedTypes` global, `template()` passes its HTML through policy `keel`, created once.
- On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none.
- `Image src="https://cdn.example/a.png"` and `action="https://x.example/"` are each E1570; `src="logo.png"` is not.
- `ctx.net.fetch(new Request('https://api.example/x'))` in a client-reachable file is E1571; in a `*.server.ts` file it is not.
- `keel build` of a fixture with a `client` deployable writes its `csp.txt` with `script-src 'self'`.
- `import { serverState } from '@keel/store/internal'` in `modules/a/x.ts`, `import('@keel/router/internal')` in `test/a.test.ts` and `export * from '@keel/std-jobs/tools/internal'` are each one E1576; the first in `packages/std-x/src/a.ts` or `node_modules/@keel/std-x/a.ts`, and `import '@keel/router/match'`, are not.
- In one window, 50 reports with `x-forwarded-for: 192.0.2.1` log 10 and a later one from `192.0.2.2` is logged; `dropped: 40` follows the window; no record holds an address.

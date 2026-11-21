# ADR-0182: k.origins: declared third-party origins (RFC 0160)

**Status:** accepted (operator decisions D46 and D41; for the operator to confirm). It reverses ADR-0094's "one policy with no option".

**Context.** Every Keel document carries one fixed policy: `default-src 'none'`, `'self'` for images, fonts and connections, no media or frames, a nonce with `'strict-dynamic'` for scripts, `style-src 'self'` and Trusted Types. No app can show a CDN image, use a hosted font file, post to an analytics collector or embed a video player without proxying it through its own origin. The policy's protection comes from its script, style and Trusted Types directives, which these loads do not touch.

**Decision.** A deployable of any adapter may set `origins` in `topology.ts`: per directive (`img`, `media`, `font`, `connect`, `frame`), an object mapping an exact origin (its own serialization; `https`, or `http` on `localhost`; no wildcard or path) to a one-line reason, at most 16 per directive. Each policy Keel emits for that deployable gains its origins: `node` documents in production and dev, `csp.txt`, a hosted `client` `index.html` (the client's declaration), the Tauri and Capacitor shell policies. `img`, `font` and `connect` append after `'self'`; `media-src` and `frame-src` are added holding the declared origins alone. No declaration emits the fixed policy byte for byte. Scripts, styles, Trusted Types and the other directives take none. E1570 and E1571 pass a declared origin; E1590 reports a malformed declaration, E1591 a duplicate. `Frame` joins `@keel/ui`: required `title`, fixed `sandbox`, `referrerpolicy="strict-origin"`. `keel evidence` lists each declaration with its reason in `security.json`.

**Alternatives.**
- Keep the fixed policy and proxy: costs the CDN and hides the third party from the evidence.
- `createApp({ csp })` or an environment variable: a widening the source and the evidence cannot show.
- Wildcards or paths: a wildcard admits parties nobody named; CSP drops a path after a redirect.
- Declarable scripts now: `'strict-dynamic'` ignores host lists and Trusted Types refuses a script that writes HTML strings; a later, separate decision.

**Consequences.**
- Every widening is in `topology.ts`, typed, reasoned and in the evidence bundle; an app without one is unchanged.
- A declared origin learns the address of each browser that loads from it, and receives what the app's code sends; it never runs script in the document.
- `media` has no app-code element until a `Video` or `Audio` exists; it serves the W15 host element.
- A public API declares nothing: callers from other origins are `KEEL_ALLOW_ORIGINS` and `bearer`.

# ADR-0110: a `client` deployable is a static artifact with a `keel-peer` tag, allowed origins and an optional node host (RFC 0087)

**Status:** accepted (2026-11-11), user decisions D1 and D3 of RFC 0087.

**Context.** A `client` deployable had no production artifact of its own: its build landed in `dist/` beside the `node` output, no server returned `index.html`, a browser client had no way to find an API on another origin, and a request from another origin was refused twice (preflight 405, write 403).

**Decision.** `keel build` writes `dist/<name>/` per `client` deployable, a self-contained set of files for any static host. `KEEL_PEER_<NAME>` at build becomes a `keel-peer` tag in `index.html`, which the client entry binds to its `ctx` so `service({ module })` reaches the module's deployable, with credentials when the origin differs. `KEEL_ALLOW_ORIGINS` (`createApp({ allow })`) lists origins that may call API routes: a preflight is answered, responses carry the allow headers, and an allowed `Origin` passes the same-site check. The caller cookie is unchanged and reaches the API only when the origins are same-site; a cross-site allowed origin is W1567. `host: '<node>'` on the `client` deployable copies the artifact into the host's `dist/` and makes the host answer unmatched document requests with `index.html`.

**Alternatives.**
- `access-control-allow-origin: *`, rejected: no credentials, and every site may call every API route.
- Allowed origins on every route, rejected: pages are never fetched across origins.
- The API origin compiled into the JavaScript, rejected: one build per environment.
- `SameSite=None` for the caller cookie, rejected: blocked as third-party by Safari and Firefox, and it weakens the write defense.
- A host chosen automatically, rejected: a second `node` deployable would change what the first serves.

**Consequences.**
- A project that uploaded `dist/index.html` and `dist/assets/` uploads `dist/<name>/`.
- One build serves several environments: a deploy step may rewrite the tag's `content`.
- A client under a path prefix is not supported; one `client` deployable per host.

# ADR-0178: k.mount: the identity mount path is the router's own; E1580 at run time; no page at a path holding a `\` (RFC 0156)

**Status:** proposed (orchestrator, under review decision D39; for the user to confirm).

**Context.** `identityMount` checked its `path` only under `keel check`. A router matched whatever its table matched, so a `:param` route took a path under the identity mount client-side. A first fix held every mount path in one process-wide set that only grows, so one app's or test's mount changed another's routing.

**Decision.** `identityMount` throws E1580 for a `path` that is not lowercase `/` segments. A router matches no page at or under its own `mount` (a `createRouter` and `renderRoute` option; the client entry of a project with `identity.ts` passes its `path`; `createApp` uses `handle.path`), nor at a path holding a `\`. E1579 refuses literal routes at or under `handle.path` only; a `:param` route beside the mount is legitimate.

**Alternatives.**
- A process-wide set of mount paths: crosses apps and tests in one process.
- E1579 for a `:param` route that fits the mount: refuses `/:locale/:slug` beside `/api/auth`, and the router's refusal already closes the hole.

**Consequences.** Each router knows its mount from its caller; a hand-written `createRouter` or a `renderRoute` of a page whose table could fit the mount passes `mount`. The shell's mount requests (k.return) still read every `identityMount` path. The conformance cases live in RFC 0156, since k.mount has no room for more bullets.

# k.mount-scope: What counts as the mount
status: conformance-covered
How a router and the server decide that a path is the identity mount's (k.mount), and what that test does not see.

**Test.** The server's `handle` takes a path whose undecoded text is `path` or begins `path/`: textual and case-sensitive, as its library expects. A router matches no page at or under its own `mount` (a `createRouter` option; a build with `identity.ts` passes its `path`, `renderRoute` the first identity mount the test made (k.guards Client), `createApp` `handle.path`), nor at a path holding a raw `\`, which a URL parser reads as `/`; `%5C` in a path is an ordinary character. At or under is read on the path's segments decoded as the matcher decodes them, joined by `/`, case-sensitive, on the client (`createRouter`, `renderRoute`) and the server alike: with `path` `/api/auth`, `/%61pi/auth` is under it, and the server answers it 404 without `handle`. `identityMount` throws E1580 for any `path` that is not lowercase `/` segments.

**Limits.** A proxy that lowercases paths must not sit in front: with the mount `/gate`, `/GATE` renders a page, and the server's `handle` does not take it either. A hand-wired `createApp` whose `handle.path` differs from the root `identity.ts` path gives the router and the server two mounts; `keel check` ties them (E1580).

**Rules.** E1580 (k.mount). Fix: none.

**Conformance.**
- With `path` `/gate`, a router matches no page at `/gate`, `/gate/x` or `/%67ate`, nor at `/\x`; `/GATE` is matched by the table as any path; the server answers `/%67ate` 404 without calling `handle`.

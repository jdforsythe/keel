# k.mount-scope: What counts as the mount
status: proposed

How a router and the server decide that a path is the identity mount's (k.mount), and what that test does not see.

**Test.** A path is under the mount when its undecoded text is `path` or begins `path/`: textual and case-sensitive, the same on the client (`createRouter`, `renderRoute`) and on the server. A router matches no page at or under its own `mount` (a `createRouter` and `renderRoute` option; a build with `identity.ts` passes its `path`, `createApp` `handle.path`), nor at a path holding a raw `\`, which a URL parser reads as `/`; `%5C` in a path is an ordinary character. `identityMount` throws E1580 for any `path` that is not lowercase `/` segments.

**Limits.** A proxy that decodes or lowercases paths must not sit in front: with the mount `/gate`, `/%67ate` and `/GATE` render a page, and the server's `handle` does not take them either. A hand-wired `createApp` whose `handle.path` differs from the root `identity.ts` path gives the router and the server two mounts; `keel check` ties them (E1580).

**Rules.** E1580 (k.mount). Fix: none.

**Conformance.**
- With `path` `/gate`, a router matches no page at `/gate` or `/gate/x`, nor at `/\x`; `/%67ate` and `/GATE` are matched by the table as any path.

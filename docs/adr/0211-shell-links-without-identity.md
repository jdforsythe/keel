# ADR-0211: k.shell: a shell delivers page links with or without an identity source (RFC 0189)

**Status:** accepted (orchestrator; for the operator to confirm).

**Context.** k.links says a link from outside reaches a page as a web link does. k.shell had the shell entry call `shellMount`, the only deep-link listener, only when the project has `identity.ts`. A shell project without one registers its scheme, opens on a link and ignores it, while `renderRoute(..., { shell })` delivers the same link, so its tests pass.

**Decision.** k.links stands. A shell build's entry always calls the shell package's `shellMount(ctx, { id, origin, mount? })` before the router starts; the shell owns the link listener. With `identity.ts`, `mount` is its default export and the listener also takes that mount's paths; without it, page links are delivered and every other link is ignored. The harness delivers what the build delivers: with no identity source, page links only. Clauses k.shell#9 and k.links#12 hold it; both sections read `implemented` until they are covered.

**Alternatives.** Page links only with an identity source (contradicts k.links; the registered scheme opens the app on a link it drops); a links-only export beside `shellMount` (two listeners per package to keep in step); a harness that refuses links without an identity source (matches a wrong build); no scheme without `identity.ts` (the same contradiction).

**Consequences.** `vite.ts` gives `entryCode` the shell's `id` whatever the project holds; `entryCode` passes `mount` only with `identity.ts`; each shell package's `shellMount` takes `mount` as optional. A shell project without an identity source gains the link listener, under 1 kb.

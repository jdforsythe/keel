# ADR-0041: a production server without `assets` is E1555 at startup (RFC 0052)

**Status:** accepted

**Context.** A production `createApp` without `assets` scripted the Vite-only `/@keel/entry.ts` into island documents, whose bare `@keel/*` imports fail in a browser. Islands broke silently in a deployed server (red team M3, backlog 0127). In-process production apps in tests rely on the same path without a build.

**Decision.**
- **E1555 at startup.** `createApp` rejects with E1555 when `mode` is production, `assets` is absent, and `NODE_ENV` (trimmed, lowercased) is neither `development` nor `test`. Unset counts as production, as in Express and most Node tooling.
- **Amendment (backlog 0147).** The first gate was `NODE_ENV=production` exactly, so Node's default (unset) let `node server.ts` serve the dev entry.
- **Every deployable.** Islands are known only at render, and `keel build` emits a client build for every `node` deployable.
- **Unchanged.** Dev mode, and a production `createApp` under `NODE_ENV` `development` or `test` (vitest sets `test`), serve `/@keel/entry.ts` without a build.

**Alternatives.**
- **`NODE_ENV=production` exactly.** Node's default, unset, slips through.
- **`mode` alone.** It breaks in-process production tests that run without a build.
- **Islands only.** Startup cannot know which pages have islands.
- **Fail at the first island document.** The operator learns late, and a working page becomes a 500.

**Consequences.**
- **Deploys.** A production server needs `keel build` output passed as `assets`, island-free or not, unless `NODE_ENV` is `development` or `test`.
- **Environment.** `@keel/server` reads `NODE_ENV` once at `createApp`, safely where `process` does not exist.

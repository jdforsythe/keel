# ADR-0117: `keel check` refuses `@keel/*` internal entries outside library code (RFC 0094)

**Status:** accepted

**Context.** Six kernel packages and one stdlib package export an `internal` entry (`@keel/compiler`, `router`, `reactive`, `schema`, `ctx`, `store`; `@keel/std-jobs/tools/internal`). They are the seams kernel and stdlib producers share. `@keel/store/internal` (`serverState`, `openStores`, `saveStores`, `copyOf`) and `@keel/router/internal` (`createRouterWith(routes, options, state?)`) together let browser code run server state, which k.server refuses to client routers; `@keel/ctx/internal` `report` lets app code forge the events observers and `std.sessions` record. The only guard is the k.router sentence "`@keel/router/internal` is not public". TypeScript and Vite resolve every `exports` entry, and `keel check` has one import rule (E1251, runtime ops). Today two app files import one: `apps/sessions/test/homeRecording.test.ts` and `homeOpaque.test.ts` (`report`).

**Decision.**
- New kernel rule E1576 in k.security (block E155x; E1572 to E1575 are reserved by RFC 0085): a `@keel/*` specifier with an `internal` path segment, named by an import (type-only too), a re-export, or a literal `import()` or `require`, in a file outside `packages/`, `node_modules/` and `.keel/`. Tests and `unsafe/` are in scope. No fix.
- Stdlib and kernel source may import internal entries; the rule tells them from app code by path, as E1207 does. Order between packages stays S0003's.
- k.security gains the Rules entry and one Conformance clause (1,240 to 1,398 tokens). k.router's "not public" sentence stays.
- `@keel/check` is re-based from 47.25kb to 47.5kb: the rule and its explanation row measure 48,482 B against 48,384 B.
- The two `apps/sessions` tests produce their events through kernel producers: a failing loader under `renderRoute` (router `nav` then `error`) and a throwing component under `mount` (root Boundary, `keel.unexpected`).

**Alternatives.**
- A package.json `exports` condition, rejected: conditions apply per build, not per importer, so the condition that lets stdlib packages load in an app's bundle lets the app load the entry too; a failed resolution also has no code or fix.
- Package-private `#internal` imports, rejected: every internal entry is shared across packages.
- Kernel packages as modules under E1151/E1152, rejected: they have no manifest.
- A runtime refusal in `createRouterWith`, rejected as the guard: one export of seven entries, and the router cannot tell a test process from a browser.
- Biome `noRestrictedImports` or a structure-lint S-code, rejected: a second checker without a Keel code, or one that runs in this repo only.
- A public `@keel/testing` event helper for the two tests, rejected: a new user-facing API and a second way to produce kernel events.

**Consequences.**
- No app, module or test in a project can run server state, forge ctx events, or read the compiler's resolver through an internal entry without failing `keel check`.
- Stdlib packages keep their kernel seams (`schema/internal`, `ctx/internal`, `std-jobs/tools/internal`) with no change.
- Computed specifiers, an app folder named `packages/`, and kernel-only entries without an `internal` segment (`@keel/server/dom`, `@keel/compiler/entry/*`) are not covered; renaming the latter two under `internal` would bring them in with no new rule.
- `@keel/check` has 158 B of its budget left after the re-base.

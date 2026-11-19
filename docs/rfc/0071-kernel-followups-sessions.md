# RFC 0071: kernel follow-ups to RFC 0070 (resume `nav`, `observe` as a capability, `@keel/router/match`, secret payloads)

Status: accepted (ADR-0060, 2026-11-09). These follow from the user-accepted RFC 0070 and fix gaps the red-team pass on it found. They amend RFC 0070's decisions as listed under Amendments.

## Problem
Backlog 0212, 0216, 0218 and 0205 (filed by 0092 and its red-team pass):
1. **0212.** `record` on a `node` or `static` deployable records nothing. Only `createRouter` reports `nav`, and the resume entry starts no router, so a recorder never gets a base and drops every event. Inputs made before resume never reach observers: queued events replay through `dispatch()`, which bypasses the observer tap, and values typed before the runtime loaded have no event at all.
2. **0216.** `observe` is an ambient channel. Any module can read every non-password input of every module on the ctx, and E1156 sees only `ctx.<name>` uses.
3. **0218.** std-sessions' `replay` and `redactSession` import `compileRoutes`, `compileTable` and `matchUrl` from `@keel/router/internal`, whose contract names only @keel/server and @keel/forms. std-sessions is published on its own, so a router patch could break replay with no router test.
4. **0205.** A `tx` payload cannot carry an `s.secret` field. The store's `copy()` encodes it (secret becomes `"[secret]"`) and re-parses it, which fails with `secret-missing`.

## Amendments to RFC 0070's decisions
- **§2 k.ctx Producers.** `resume` (runtime-dom) is a `nav` producer too. The `nav` it reports carries `params` and `search` in their encoded JSON form and `schemas` `{}`, because a resumed page has no route table in the browser.
- **§2 k.ctx Observers.** `observe` is a declared capability (this RFC §2), not ambient.
- **§6 replay and redaction.** These match hrefs through the public `@keel/router/match`, not `@keel/router/internal`.
- **§4 Secrets.** A `tx` payload may hold an `s.secret` field, so the recorder's "always redacted" path is reached by real payloads.

## Proposal
### 1. Resume reports the route and pre-resume inputs (0212, k.runtime, k.ctx)
- **Server.** A route document's `#k-state` gains `route: { id, path, href, params, search }`: the matched route, its path pattern, the canonical URL, and its params and search encoded by their schemas. These are the values the island props already carry.
- **`resume`.** After restoring stores and before the first island, `resume` reports `route` to `options.ctx` as `{ kind: 'nav', href, route: { id, path, params, search, schemas: {} } }`. The ctx keeps it as the current route even when nothing observes (k.ctx), so a recorder that an island starts during resume gets it first and has a base. The resume entry calls `resume` after `bindClientStd`, so the order is: bind std config, report `nav`, resume islands. `RESUME_ENTRY` text is unchanged.
- **Inputs, per island, after its component ran:**
  1. A real bubbling `input` event is dispatched on each `input` (value types), `textarea` and single `select` in the island whose value differs from its default and that has no queued `input`, in document order. These are values typed before the runtime's queue existed. The event takes the normal path: the observer tap reports it (masked on a password field), then the island's handlers run, so the app state and the session agree.
  2. The queued events replay in order. Each one goes to the root's observer tap (`Root.tell`) and then to `dispatch`, so it is reported once, before its handlers.
- **Why `input` and not only a report.** If the event were reported but not dispatched, a replay would apply an input that the live app never saw, and the replayed state would differ. Dispatching also fixes the live app, whose state missed a value typed before load.

### 2. `observe` is a declared capability (0216, k.ctx, k.module)
- **Declaration.** A module that observes lists `observe` in its manifest's `capabilities`, next to `clock` or `net`. A stdlib package declares it once, in its root `module.ts`: std-sessions lists `observe`.
- **Static rule.** E1156 also reports an `observe` import from `@keel/ctx` (any alias) or a `<namespace>.observe` access in a file of a module whose `capabilities` lack `observe`. It reports once per file, and the fix adds `observe`. A type-only import is not a use.
- **No runtime gate.** `observe(ctx, fn)` has no module identity to check. One ctx is shared by every module of an app, and capabilities are reached through accessors that take only the ctx. A per-module ctx view would change every capability call site, so the static rule is the enforcement. The same holds for the four kernel capabilities today.

### 3. `@keel/router/match` (0218, k.router)
```ts
// @keel/router/match: public, versioned
export type RouteMatch = { readonly id: string; readonly params: Readonly<Record<string, unknown>>; readonly search: Readonly<Record<string, unknown>> };
export function matchHref<M extends Readonly<Record<string, RouteDef>>>(routes: Manifest<M>, href: string): RouteMatch | null;
```
- **Semantics.** `matchHref` matches the way a navigation does: static beats `:param`, params are decoded by the route's schema, and failing search keys are dropped. It returns `null` when no path route matches or the params fail. It reuses the manifest's compiled table and never seals it, so `routes.actions` still works afterwards.
- **No `hrefOf`.** `routes.href(id, params, search)` is the inverse. A second builder would be a second way to do one thing.
- **Size.** The subpath has its own size budget (`@keel/router/match`, 2 kB). `tooling/budgets.mjs` measures `@keel/<pkg>/<sub>` from `packages/<pkg>/src/<sub>/index.ts`.
- **Migration.** std-sessions moves `replay` and `redactSession` to `matchHref`. Each needs `routes.routes[id]` for the def.

### 4. Secret payloads (0205, k.store)
- **In memory.** `copy()` encodes and re-parses as before, which prunes undeclared keys and copies every container, then puts each `Secret` back where the encoding wrote the marker. A `Secret` is frozen and opaque, so sharing it is safe. `tx` commits, and `log()` entries hold the `Secret`, so `reveal` gives the value sent. `structuredClone` was rejected: it turns a `Secret` (private field) into `{}`.
- **Persisted.** `snapshot()` must not write a secret, because snapshots reach `#k-state` and `ctx.storage`. It folds every entry up to the last one whose payload holds a secret into `initial`, the base `undo` replays from, in the same way the log limit folds the oldest entries. The snapshot log then holds no secret, `restore` is unchanged, and the state is unchanged. Undo cannot reach a folded entry after a restore. A secret in state still throws at `snapshot()`, as it did before.
- **Rejected: a check rule forbidding secrets in payloads.** A payload is the one place a secret legitimately crosses from a form to server state.

## Alternatives
- **0212: match `location` in the browser.** That needs the route table with its schemas, which on a server-rendered page lives only on the server. Importing `routes.ts` into an island bundle would ship loaders and actions to the browser.
- **0212: report typed values without dispatching them.** Rejected: replay would diverge from the live state (§1).
- **0216: restrict `observe` to stdlib packages.** That needs a runtime caller identity, which does not exist, and a static "is stdlib" test is the same rule with fewer uses.
- **0218: name std-sessions as an internal consumer.** That leaves an unversioned surface published as a dependency of a public package.
- **0205: mark secret entries non-replayable in the snapshot.** That adds a log entry shape and restore semantics for entries that cannot be applied. Folding needs neither.

## Spec diff
- **k.runtime** (1,499 -> 1,498 printed). `#k-state` carries the served `route`. `resume` reports it as a `nav`, fires `input` on controls off their default, and reports queued events before handlers. One clause: "An observer on the resume ctx gets the served `nav`, an `input` for a field typed before load, then each queued event, once." Trimmed: the `mount` code block, folded into the prose.
- **k.ctx** (1,491 -> 1,499). `nav` also comes from `resume` (encoded, no `schemas`). "A module calling `observe` lists it in `capabilities` (E1156, static: a ctx has no module identity)."
- **k.module** (1,490 -> 1,499). E1156 adds "or `observe` called", and its clause adds `observe`.
- **k.router** (1,493 -> 1,498). Execution names `@keel/router/match` and `matchHref`. One clause: "`matchHref(routes, routes.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`."
- **k.store** (1,442 -> 1,499). A **Secrets** paragraph. One clause: "A payload's `s.secret` value is `reveal`able in `log()`; `snapshot()` then holds no secret and restores the same state."
- Trims elsewhere are wording only, with no normative change.

## Conformance diff (rfc:0071)
- Added `packages/runtime-dom/conformance/resume-observed.test.ts`, `packages/router/conformance/match-href.test.ts` and `packages/store/conformance/secret-payload.test.ts`.
- Edited `packages/check/conformance/module-E1156-capability.test.ts` to add the `observe` cases.

## Migration
- **std-sessions.** Its `module.ts` adds `"observe"` to `capabilities`, and `replay` and `redactSession` switch to `@keel/router/match`.
- **Apps.** A module that calls `observe` adds it to `capabilities`, which `keel check` fixes.

## Token impact
Each section stays at or under 1,500 printed tokens (above).

## Known limits
- The resume `nav` has no `schemas`, so `s.secret` search values in the base route cannot be found by schema. The server encodes them as `"[secret]"`, so none reach `#k-state`.
- Checkboxes and radios toggled before load are not replayed: they have no value off a default.
- A recorder started in a later island misses inputs reported for earlier islands.
- E1156 does not follow `observe` through a re-export from another module or a dynamic `import()`.

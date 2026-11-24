# RFC 0219: k.guards: a test names the identity mount; `keel test` loads nothing before a test file

Status: accepted (ADR-0241), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.guards (Client, a new Test files paragraph, Conformance #9 and #10 reworded, #11 added), k.testing (`renderRoute`, Rules, one Conformance clause), k.mount (Declaration), k.mount-scope (Test), k.scaffold (`route`, one clause), std.sessions (`replay`, Commands, one clause), the map. Written over RFC 0221's section split. From the operator's decision D136 (backlog 1089): principle 2 holds against RFC 0209's loading.

## Decisions
- D1: `renderRoute` takes `mount`, the identity mount: `identity.ts`'s default export, which the test file imports (`import mount from '../identity.ts'`). It is the one way a harness gets a mount. The built entry does the same: it imports `identity.ts` and passes the mount to `createRouter` and `shellMount`.
- D2: a `renderRoute` router reads `/__keel/user` only with `mount` and without `user`; a shell harness sends mount requests only under `mount`. Without it the harness has no mount, whatever the test's modules import.
- D3: nothing is loaded before a test file. The `keel()` plugin adds no setup file and `keel test` adds no plugin. A test runs the same under `keel test` and plain vitest.
- D4: E1730 (k.testing's code block, defined in k.guards Test files; error, `keel check` only): in a project with `identity.ts`, a test's `renderRoute` with neither `mount` nor `app`. The message says what to write; the fix writes it.
- D5: `app` with `mount` is E1722: a served page's identity comes from `app`.
- D6: the request log (k.requests) is unchanged.

## Problem
Principle 2: nothing outside a file changes what it does. RFC 0209 broke it for tests. Under vitest with the `keel()` plugin, and under `keel test` whatever the config, the project's `identity.ts` is a setup file (`packages/compiler/src/hosting/identitySetupFiles.ts`, used by `packages/compiler/src/vite.ts` and `packages/cli/src/internal/testCommand.ts`). It runs before each test file. Its `identityMount` call fills the router's `identityMounts` set, and `renderRoute` takes the first entry as its mount and reads `/__keel/user`. So the same test file sends a request or not depending on a file it never names. Adding `identity.ts` to a project changes the request log, the guard's `user` and the mount scope of every route test in it, and a reader of the test cannot see why.

What the tree does today:
- `renderRoute` (`packages/testing/src/renderRoute.ts`) reads `[...identityMounts]` for the router's `mount` and `read` and for a shell's `mountRequests`. Its options name no mount (RFC 0209 removed `mount`).
- `identityMount` (`packages/router/src/identityMount.ts`) adds each mount to `identityMounts`; only `renderRoute` reads that set. It also installs `readUser` into `userRead`, which a bundle without `identity.ts` lacks.
- The built client entry (`packages/compiler/src/internal/entryCode.ts`) imports `identity.ts` and passes `mount: __keelIdentity.path` to `createRouter`, and `mount: __keelIdentity` to a shell's `shellMount`. That is the app: it stays.
- Route tests without `app` in identity projects: `apps/golden-2/test/{market,catalog,timings,routes,canary-user}.test.ts` and `examples/shell-mount/test/shellGuard.test.ts`. Every `renderRoute` in `apps/household`'s tests passes `app`. `apps/sessions`, golden-1 and the other examples have no `identity.ts`.

## Proposal
### The test names the mount
```ts fragment
import mount from "../identity.ts";
const page = await renderRoute("recipes.index", { routes, params: {}, ctx, mount });
```
`mount` is an `IdentityMount` (`{ path, href, links }`), the value the built entry passes. With it the router reads `user` as a built one does (unless `user` stands for the answer), matches no page under `mount.path` (k.mount-scope), and a shell harness sends mount requests under it (k.return). Without it the harness is a build of a project with no `identity.ts`: no read, no mount scope, no mount requests.

An import or an option alone would not do. An import as the switch is the module graph again: a page that imports `identity.ts` for `mount.href` would turn the read on in every test of it. The option takes the imported value, so the line that turns it on is in the test file, and the type says what goes there.

A front end with no back end has no `identity.ts`. Its tests never write `mount` and never see E1730; `renderRoute` carries one more optional key and no new code runs.

### E1730
In a project with `identity.ts` beside `topology.ts`, the built app always reads and always has a mount, so a route test that does not name it is a test of some other build. `keel check` reports E1730 at the options object of a `renderRoute` from `@keel/testing` in a test file when the options are an object literal with no spread and no computed key, and with neither `mount` nor `app`:
```
E1730 modules/recipes/test/index.test.ts:12:44 renderRoute names no identity mount; import mount from '../../../identity.ts' and pass it
  fix: pass mount
fail check 1 errors
```
The fix adds `mount` to the options and `import mount from '<path>';` after the last import, or uses an existing default import of `identity.ts` under its own name; no fix when `mount` is bound to something else. Non-literal options are not judged, as W1723 does not judge them.

`keel check` only, not at run. A run-time check would need to know that the project has `identity.ts`, which means reading something outside the test file. That is the principle this RFC restores. It would also behave differently under plain vitest.

An error, not a warning. A route test of an identity project without `mount` asserts on a request log, a guard's `user` and a route table that the built app never has. A warning would let such tests pile up.

### What goes
- `identitySetupFiles.ts`; the `keel()` plugin's `test.setupFiles` entry in `vite.ts`; `testCommand.ts`'s `keel-identity` plugin.
- `identityMounts` (`packages/router/src/internal/identityMounts.ts`), its export and its `add` in `identityMount`. `userRead` stays.

### Other test writers
- `keel session replay|minimize|to-test` run under `keel test`, so they relied on the setup file too. `replay` and `minimize` take `mount` and pass it to `renderRoute` for a base rendered without `serve`; with `serve` it is E1722, as `renderRoute` rejects it. In router mode the commands pass the project's `identity.ts` default export, and the router-form `to-test` file imports it as `mount` and passes it. The `node` form (RFC 0215) passes `app` and is unchanged.
- `keel scaffold route` in a project with `identity.ts` writes a route test without `app` that imports and passes `mount`. The `node` and `--api` forms are unchanged, and no scaffolded project has `identity.ts`.
- The built entry keeps importing `identity.ts`. That is the app, not a test.

## Alternatives
- **The import alone switches the read on** (`import '../identity.ts'` in the test). Any page module importing `identity.ts` for `mount.href` does the same from outside the test file, and `identityMounts` stays. Rejected.
- **Keep the setup file and let a test opt out.** That keeps the effect from outside the file. Rejected by D136.
- **E1730 at run as well, from `identityMounts` being non-empty.** It depends on the module graph, misses projects whose pages do not import `identity.ts`, and keeps the set. `keel check` sees the project directly.
- **`identity` as the option's name.** `createApp`'s `identity` takes `identity.server.ts`'s export. One name for two halves invites passing the wrong one. `mount` is the name `shellMount` already uses for this value.
- **A warning.** Rejected above.

## Spec diff
Applied in this commit, over RFC 0221's split (k.scaffold-service, std.sessions-served).
- k.guards (to `implemented`): Client's last three sentences are replaced (the read only with `mount`; nothing loaded; what `mount` does for router and shell; a Conformance clause of any section whose harness uses an identity mount passes it as `mount`, written or not). A new paragraph, Test files, defines E1730 and its fix. Conformance #9 is reworded (`mount` passed; without it, in the same file, no read), #10 is reworded (`keel test` and `vitest run` pass both a no-mount and a `mount` test file), #11 is added (E1730). Nothing is deleted or renumbered. Headers quoting the old #9, #10 or the replaced Client sentences: `packages/testing/conformance/guard-read-in-harness.test.ts`, `guard-read-in-harness-none.test.ts`, `packages/cli/conformance/test-identity-read.test.ts`.
- k.testing (to `implemented`): `renderRoute`'s options gain `mount?`, with a one-line pointer to k.guards Client; Rules: E1722 gains `mount` with `app`, E1730 added (k.guards Client); Conformance #27 (E1722).
- k.mount Declaration: the second-call sentence no longer names a first mount. k.mount-scope Test: `renderRoute` its `mount` option's `path`. Headers quoting the old text: `packages/testing/conformance/mount-router-scope.test.ts`, `mount-router-scope-none.test.ts`. No clause changes; both stay `conformance-covered`.
- k.scaffold (to `implemented`): `route` writes `mount` in an identity project; Conformance #19. k.scaffold-service is untouched.
- std.sessions (to `implemented`): `replay` and `minimize` take `mount?`; the commands pass it in router mode; Conformance #17 (the router-form `to-test` file). std.sessions-served is untouched: the served form passes `app`.
- Map: k.guards, k.testing, k.scaffold read `implemented`; `spec/std/README.md` std.sessions likewise. E1730 sits in k.testing's E170x block (E1727 to E1729 are held by RFC 0218).
- k.requests unchanged. No glossary term. No budget moves.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/testing/conformance/guard-read-in-harness.test.ts`: k.guards#9 rewritten (one file: `identityMount('/auth')` at module scope, cases with and without `mount`). `guard-read-in-harness-none.test.ts` is deleted, since #9 no longer asks for a second module graph.
- `packages/cli/conformance/test-identity-read.test.ts`: k.guards#10 rewritten (`keel test` and `vitest run` over the scratch project).
- `packages/check/conformance/guards-E1730-identity-mount.test.ts`: k.guards#11; plus an E1730 fixture and its fix in `fixtures-by-code.ts` and `fix-diffs.test.ts`.
- `packages/server/conformance/render-route-app-mount-e1722.test.ts`: k.testing#27.
- `packages/scaffold/conformance/route-identity-mount.test.ts`: k.scaffold#19.
- `packages/std-sessions/conformance/to-test-identity-mount.test.ts`: std.sessions#17.
- Existing cases that get a mount from `identityMount` in their module graph pass it as `mount` (k.guards Client's "written or not"): `packages/testing/conformance/mount-router-scope*.test.ts`, `mount-pages.ts`, `return-support.ts`, `return-mount-form.test.ts`, `return-link-intake.test.ts`, `links-no-identity-source.test.ts`; `packages/services/conformance/render-route-user-support.ts`, `render-route-guard-user-support.ts`, `render-route-shell-jar-0185.test.ts`, `render-route-guard-user-shell-0186.test.ts`. Their headers quote unchanged clauses.

## Migration
None. Nothing is released.

## Token impact
- Spec, in tokens: k.guards 2,470, k.testing 2,950, k.scaffold 2,281, std.sessions 2,480, k.mount 2,101, k.mount-scope 399 (k.scaffold-service 1,362 and std.sessions-served 936, untouched), each under the 3,100 section budget. No map row is added.
- `keel explain E1730`: one catalog entry.
- `@keel/testing`: one option replaces a set read; `@keel/router`: the set goes; `@keel/compiler/vite`: one function goes. Sizes measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the clauses and cases above. 3. Build:
- `packages/testing/src/renderRoute.ts`: `mount?: IdentityMount`; `mount: options.mount?.path`, `read: options.user === undefined && options.mount !== undefined`, `mountRequests(..., { mounts: options.mount === undefined ? [] : [options.mount] })`; E1722 for `app` with `mount`; README.
- `packages/router`: delete `internal/identityMounts.ts`, its export and the `add` in `identityMount.ts`; `test/identityMountSubpaths.test.ts` as needed.
- `packages/compiler`: delete `src/hosting/identitySetupFiles.ts` and its use and docblock in `vite.ts`; its `package.json` export if any. `packages/cli/src/internal/testCommand.ts`: drop `identitySetup` and the `keel-identity` plugin.
- `packages/check`: `src/rules/identityMountMissing.ts` (E1730, beside `nodePageWithoutApp.ts`), registered; `EXPLANATIONS.ts` entry.
- `packages/std-sessions`: `replay.ts`, `internal/replayRun.ts` (`mount`), `toTest.ts` (router form imports and passes `mount`), the command job (passes the project's `identity.ts` default export).
- `packages/scaffold/src/templates/routeTest.ts` and its caller: the `mount` import in an identity project.
- Apps and examples: `apps/golden-2/test/market.test.ts`, `catalog.test.ts`, `timings.test.ts`, `routes.test.ts`, `canary-user.test.ts`; `examples/shell-mount/test/shellGuard.test.ts`; `packages/testing/test/renderRouteMount.test.ts`. Each imports `identity.ts`'s default export and passes `mount`; each app's and example's `keel check` is clean of E1730 and `keel test` passes.
- Docs: keel-testing skill (both copies), `@keel/testing` README, the `keel` skill's code list, a changeset, `tasks/BACKLOG.md` 1089.

## For the operator
1. **`mount` on `renderRoute`, taking the imported `identity.ts` value.** Recommended: yes. One visible line, typed, and the same value the built entry passes.
2. **E1730 is a `keel check` error and is never raised at run.** Recommended: yes. Run-time detection would read the project from outside the test file.
3. **`mount` with `app` is E1722.** Recommended: yes. A served page takes its identity from `app`.

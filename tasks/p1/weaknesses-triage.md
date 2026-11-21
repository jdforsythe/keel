# Weakness lanes 06 and 10 to 21: re-triage

Each line of lanes 06 and 10 to 21 in `tasks/p1/weaknesses.md` (61 lines), checked against the code, `spec/`, `docs/rfc/` and `tasks/BACKLOG.md` on 2026-11-21. `weaknesses.md` itself is unchanged.

Categories: (a) closed, (b) open as written, (c) open and restated for today's shapes, (d) waits on RFC 0158 (app data seam) or RFC 0163 (library format).

| Category | Lines |
| --- | --- |
| (a) closed | 22 |
| (b) open as written | 33 |
| (c) open, restated | 5 |
| (d) waits on 0158 or 0163 | 1 |
| Total | 61 |

Lines 0692 and 0693 are checked in `tasks/BACKLOG.md`; the rest of (a) are still unchecked there and the backlog needs a tick (see Backlog upkeep).

## 1 Line by line

### Lane 06 compiler-routes

| Line | Cat | Finding |
| --- | --- | --- |
| 0386 | c | Fixed: handlers take `(props, ctx)`, `tsconfig.json` lists no root `routes.ts`, `api` lists `storage`, a `client` deployable's own `*.server.ts` loader is the k.boundary design. Left: `apps/golden-1/index.html` links fonts through `/node_modules/@keel/ui/fonts/fonts.css`, and the unexplained file-count difference between build and check. |
| 0521 | b | `packages/compiler/src/internal/stdExport.ts` reads `<pkg>/module.ts` by path; `packages/std-sessions/package.json` has `files: ["dist", "docs"]` and exports `./module` as the root `module.ts`, so a published package serves no routes. |
| 0517 | b | `packages/cli/src/internal/surfaceRun.ts` lines 110, 114 and 129 still end in `.catch(() => undefined)`. Needs a design. |
| 0372 | a | `packages/compiler/src/vite.ts` `routesFiles` falls back to `stdRoutes(root, m)`; the server and dev entries import a placed stdlib module's `./routes`. |
| 0486 | a | `routeLiterals` and `artifactHashes` take `projectManifests(topology, paths, root)`, which includes `stdRoutes`; `pathCollisions` reads `routeLiterals(files, { root })`. |
| 0926 | b | `packages/compiler/src/internal/unreadModules.ts` says a stdlib module without `./routes` is not reported; `spec/kernel/k.topology.md` Route table still reads "(none: no routes)". |

### Lane 10 runtime-errors

| Line | Cat | Finding |
| --- | --- | --- |
| 0282 | a | `packages/runtime-dom/src/internal/stampOf.ts` returns the compiler's `data-k` only, "never an element's `id`"; `spec/kernel/k.errors.md` says the same. |
| 0775 | b | `packages/cli/src/internal/viteRun.ts` sets `NODE_ENV=production` in the child environment only; a config that assigns `process.env.NODE_ENV` is not overridden and the plugin defines no `DEV` or `PROD`. |
| 0463 | b | `packages/check/src/rules/noIntrinsicElement.ts` `dropIn` writes ` as="aside"` and ` as="nav"` with no `label`; `packages/ui/src/elements/Box.ts` requires `label` there (E1802). |
| 0747 | b | No conformance case under `packages/runtime-dom/conformance/` shows the island fallback message with `resume` and `mode: "dev"`; `mount-onerror.test.ts` covers `mount` only. |
| 0281 | a | `packages/runtime-dom/test/resumeBoundary.test.ts` covers a nested `Boundary` in a resumed island and fragment, text and empty re-renders; the production fallback shows `keel.unexpected` only (`k.errors`). |

### Lane 11 golden-2-access

| Line | Cat | Finding |
| --- | --- | --- |
| 0332 | b | `apps/golden-2/modules/recipes/loadRecipe.server.ts` puts the URL's `recipeId` into the `notFound` message that `RecipeError.tsx` renders as the `h1`. |
| 0688 | a | `apps/golden-2/modules/accounts/AccountError.schema.ts`: a sign-up with an existing email answers as a success. |
| 0903 | c | `identify` in `apps/golden-2/identity.server.ts` reads the library's session cookie when no `authorization` header is present. Left: a present but invalid bearer never falls back to the cookie; decide and test it. |
| 0911 | b | `modules/kitchen/routes.ts` binds `kitchen.add` with no guard; only the page `/recipes/new` has `cook`, and `cook` denies guests only. |
| 0689 | a | `packages/server/conformance/api-routes-0086.test.ts` asserts a form POST to an API route is not 303 with no `Location`; `apps/golden-2/test/tokens.test.ts` mints and refuses over real sessions. |
| 0334 | a | `packages/router/test/prefix.property.test.ts` covers a param second segment (E1509); no length-only not-found assertion remains in `apps/golden-2/test/routes.test.ts`. |
| 0366 | b | `evals/tasks/golden-1-api/acceptance.test.ts` still builds topologies `A` and `B` by hand (lines 58 and 62). Its hop lists now record forwarded and peer paths; the topology literals are the open part. |

### Lane 12 a11y

| Line | Cat | Finding |
| --- | --- | --- |
| 0396 | a | `apps/golden-1/modules/todos/AppShell.tsx` labels its `nav` "Main"; row links read `Edit {title}`; errors use `fg="error"`; route titles come from `routes.ts`. |
| 0475 | a | `landmark-unique` is the axe-core rule (`packages/testing/src/internal/axeRuleIds.ts`); the hand-written counter is gone. |
| 0572 | b | `packages/testing/src/a11y/criteriaOf.ts` maps 1.3.2 and 2.4.3 to E1820 only. |
| 0573 | b | `packages/testing/src/internal/eventFor.ts` `click` dispatches a `MouseEvent` and moves no focus; `roleOf` delegates to the compiler's `roleFor`; no state key for `aria-rowindex`. Verify the `th scope=row` case when building. |
| 0580 | b | No `Box as="nav"` or `"section"` case in `packages/testing/conformance/a11y-json-agreement.test.ts` or `a11y-tree.test.ts`. |
| 0874 | b | `packages/ui/src/elements/Text.ts` takes no `role`. |
| 0932 | b | No app-level live region in `@keel/ui`; `std-headless` `Toaster` is the only live output. |

### Lane 13 conformance-topology

| Line | Cat | Finding |
| --- | --- | --- |
| 0349 | a | `spec/kernel/k.topology.md` has `status: conformance-covered`. |
| 0346 | a | The `keel dev` clause is covered (`packages/cli/conformance/dev-port-0091.test.ts` starts it) and k.topology is flipped. |
| 0423 | a | The clause now reads `service({ contract })`; `packages/cli/conformance/hosting-peer-binding.test.ts` covers the binding. |
| 0693 | a | Checked in the backlog. |
| 0270 | b | `packages/cli/src/internal/citesClause.ts` still counts a clause covered when any one file cites it. |
| 0531 | b | `spec/kernel/k.ledger.md` has no sentence for range clauses; the k.testing `find` `lang` RFC is not written. |

### Lane 14 shells

| Line | Cat | Finding |
| --- | --- | --- |
| 0608 | c | A deployable's declared `connect` origins (k.origins) now enter the shell policy, but `packages/std-tauri/src/tools/tauriHttpCapability.ts` still allows `KEEL_ORIGIN` only and the Capacitor net driver sends another origin as given. One rule: both drivers follow the declared `connect` origins. |
| 0958 | b | No app with `identity.ts` has a shell run on a device; golden-1 declares shells but the return-link path has no device job. |
| 0964 | b | No change in `apps/golden-1` or `packages/ui`; needs a Simulator run. |

### Lane 15 check-tools

| Line | Cat | Finding |
| --- | --- | --- |
| 0616 | b | `packages/std-jobs/src/tools/` has `secretInput.ts` for job inputs; nothing reports a revealed value passed to `enqueue`. |
| 0617 | b | No rule ties a password control to `s.secret` in `packages/forms` or `packages/check`. |
| 0638 | b | E2203 is not in `packages/std-tokens`. |
| 0957 | c | E1572 reads dependencies in `packages/check/src/internal/topologyNeeds.ts`; the shell target now lives in `packages/std-capacitor/src/tools/` (`capacitorTarget.ts`), which has no check for `@capacitor/app` and `@capacitor/browser`. Put the check in the target. |
| 0434 | a | `packages/check/src/internal/modules/moduleChecks.ts` reports E1156 for any `ctx.<capability>` outside `capabilities`, storage included (`scanFile.ts`). The k.module sentence still names only `net` and `observe`: a docs line. |
| 0330 | b | `packages/check/src/internal/guardRedirectLoops.ts` checks the redirect target and loops, not the carried fields' schemas. |
| 0918 | b | `packages/check/src/internal/runRules.ts` turns a throwing rule into E1756; no test helper in `packages/testing` fails on it. |
| 0936 | a | `packages/cli/src/internal/readProject.ts` skips `dist`; `accounts.service.ts` no longer exists, since a contract replaces the endpoints file. No repro was run. |

### Lane 16 compiler-boundary

| Line | Cat | Finding |
| --- | --- | --- |
| 0424 | b | `packages/compiler/src/vite.ts` (around line 788) passes `Object.fromEntries(... x.modules)` for every deployable into `entryCode`. |
| 0953 | d | A build-time check for third-party std-style packages is the library format (RFC 0163); the repository's own structure lint is S0012. |
| 0954 | b | `spec/kernel/k.cli.md` Inspect names no winner when two deployables serve a section id. |
| 0304 | a | `packages/server/src/internal/headHtml.ts` links a stylesheet per CSS file of the client build's entry chunk (`BuiltClient`, `loadAssets`). |
| 0692 | a | Checked in the backlog. |

### Lane 17 compat

| Line | Cat | Finding |
| --- | --- | --- |
| 0368 | a | A missing base surface is W1568 (`packages/cli/src/internal/checkCommand.ts`); the generated CI removes the file and runs `keel check --base`. |
| 0371 | a | `accepts.ts` handles an open `b`; `pathCollisions` strips trailing slashes; `routeFor` is gone; `callsOf` takes namespace imports and `holdsSecretCall` takes `<name>.secret` and `<ns>.s.secret` only. |
| 0883 | b | `packages/scaffold/src/internal/opService.ts` still writes `api.server.ts` with a literal `base`, E1571 in a module only `client` deployables list. |

### Lane 18 std-runtime

| Line | Cat | Finding |
| --- | --- | --- |
| 0507 | a | `packages/std-live/src/live.ts` bounds a read with an `AbortController` (`bound`); `docs/rfc/0114-std-live-read-bound.md`. |
| 0302 | c | E2005 now reads a placed `sessions` module in a non-`node` deployable (`routes.ts` doc), and `packages/std-sessions/src/internal/sourcesOf.ts` still reads literal `import()` and `require` only. Left: `createRequire`, `module.require`, parenthesized and aliased `require`, non-literal `import()`. |
| 0525 | a | `spec/std/std.monitor.md` Read: placing `sessions` serves the tally, with or without `monitor`; `routes.ts` binds `ingest`, `list` and `tally` together. |
| 0779 | a | `packages/std-temporal/src/TimeZone.ts` parses against the pinned list and never builds an `Intl.DateTimeFormat`. |

### Lane 19 std-storage

| Line | Cat | Finding |
| --- | --- | --- |
| 0812 | b | `packages/std-db/src/postgres/postgres.ts` passes `sslmode` to the driver; no verification note or test. |
| 0829 | b | `.github/workflows/ci.yml` uses a `postgres:17` service container; the TLS cases skip. |
| 0826 | b | `packages/std-tauri/test/storeStorage.crash.test.ts` kills inside a save through a fake; no power-loss case. |

### Lane 20 mutation-tooling

| Line | Cat | Finding |
| --- | --- | --- |
| 0916 | b | `tooling/mutate-cache.ts` and `tooling/mutate.mjs` key nothing on test files. |
| 0919 | b | `tooling/mutate.mjs` and `mutate-changed.mjs` name no `apps/`. |
| 0960 | b | `packages/testing/src/internal/freshGraph.ts` line 9 still does `(await import("vitest"))`. |

### Lane 21 std-mutation

| Line | Cat | Finding |
| --- | --- | --- |
| 0914 | b | Open; needs a quiet machine for the mutation runs. |

## 2 Work packages

Packages share no files, so each runs in its own worktree. Kernel changes go by RFC: the conformance-writer writes the tests from the spec section first, then the build. Order is by value toward the first public release.

| # | Package | Lines | Touches | RFC | Size | Tier |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | std-module-publish | 0521 | `packages/compiler/src/internal/stdExport.ts`, `std/stdRoutes.ts`, `std-*/package.json` `files` | no | S | sonnet |
| 2 | golden-2-access | 0332 0911 0903 | `apps/golden-2/modules/{recipes,kitchen}`, `identity.server.ts`, `apps/golden-2/test` | no | S | sonnet |
| 3 | check-privacy-rules | 0616 0617 0638 | `packages/check` (exports for tools), `std-jobs/src/tools`, `forms`, `std-tokens/src/tools`, `spec/kernel/k.check.md`, k.compliance | yes (E2203, the tools exports) | M | opus |
| 4 | ledger-range-clauses | 0270 0531 | `packages/cli/src/internal/{buildLedger,citesClause}.ts`, `spec/kernel/k.ledger.md`, `k.testing.md` | yes (k.ledger sentence) | S | opus |
| 5 | ui-roles-and-live | 0874 0932 | `packages/ui/src`, `spec/kernel/k.ui.md` | yes | M | opus |
| 6 | a11y-harness | 0572 0573 0580 | `packages/testing/src`, `packages/testing/conformance` (`rfc:` commit), `spec/kernel/k.a11y.md` | yes for 0572 and 0573 | M | sonnet |
| 7 | shell-origin-and-deps | 0608 0957 | `packages/std-capacitor/src`, `std-tauri/src/tools`, `check/src/internal/topologyNeeds.ts`, std.shells specs | yes (std spec) | M | opus |
| 8 | placed-module-no-routes | 0926 | `packages/compiler/src/internal/unreadModules.ts`, `routeLiterals.ts`, `spec/kernel/k.topology.md` | yes (diagnostic code) | S | opus |
| 9 | guard-redirect-schemas | 0330 | `packages/check/src/internal/guardRedirectLoops.ts`, `router` | yes (k.guards static half) | M | opus |
| 10 | inspect-sections | 0954 | `spec/kernel/k.cli.md`, `packages/server` and compiler dev inspect, golden-2 timings | yes | M | opus |
| 11 | client-entry-map | 0424 | `packages/compiler/src/vite.ts` `entryCode`, `docs/THREAT-MODEL.md` | no (RFC if k.hosting text changes) | S | sonnet |
| 12 | surface-run-throws | 0517 | `packages/cli/src/internal/surfaceRun.ts` | design note; RFC if k.compat text changes | M | opus |
| 13 | std-db-tls | 0812 0829 | `packages/std-db`, `.github/workflows/ci.yml`, `tooling/ci.source.json` | no | M | sonnet |
| 14 | mutation-tooling | 0916 0919 | `tooling/mutate*.mjs`, `tooling/mutate-cache.ts` | no | M | sonnet |
| 15 | testing-vitest-seam | 0960 | `packages/testing/src/internal/freshGraph.ts`, structure lint S0009 in `tooling` | no | M | sonnet |
| 16 | small-fixes | 0463 0775 0883 0302 0918 | `check/src/rules/noIntrinsicElement.ts`; `cli/viteRun.ts` and compiler define; `scaffold/opService.ts`; `std-sessions/src/internal/sourcesOf.ts`; `check/runRules.ts` and `testing` helper | no | M (five S) | sonnet |
| 17 | resume-dev-conformance | 0747 | `packages/runtime-dom/conformance` (`rfc:` commit) | conformance only | S | sonnet (conformance-writer) |
| 18 | golden-polish | 0386 0964 0366 | `apps/golden-1`, `packages/ui` (checkbox label tap), `evals/tasks/golden-1-api` | no | S | sonnet |
| 19 | shells-device-proof | 0958 0826 | `apps/*` with `identity.ts`, `packages/std-tauri/test`, macOS and iOS CI jobs | no | L | opus |
| 20 | std-mutation | 0914 | `std-health`, `std-geo`, `std-i18n`, `std-brands`, `std-text` tests | no | L | sonnet |

Overlaps to respect:
- Packages 1, 8 and 16 each touch `packages/compiler` in different files; merge 1 first.
- Packages 6, 15 and 16 each touch `packages/testing` in different files.
- Packages 7 and 3 both change `packages/check` exports; run 3 first.
- Package 13 and `lane-r158` (RFC 0158 Postgres module) can both touch `packages/std-db` and the CI services block; start 13 after the 0158 build lands or keep it to the TLS test and CI step.
- Line 0953 waits on RFC 0163 and is in no package.

## 3 Order and first three

Start first:
1. std-module-publish: a published `@keel/std-*` package serves no routes, which breaks the first release; one file, no RFC.
2. golden-2-access: a public demo that writes without a user and echoes URL text in its own voice, one worktree of app files, no RFC.
3. check-privacy-rules: the privacy rules outside reviewers read (W4); opus opens with the RFC while the other two build.

Next: ledger-range-clauses (gate integrity), ui-roles-and-live and a11y-harness (a11y claims), shell-origin-and-deps.

## 4 Backlog upkeep

The 22 closed lines (0372 0486 0282 0281 0688 0689 0334 0396 0475 0349 0346 0423 0693 0434 0936 0304 0692 0368 0371 0507 0525 0779) can be checked in `tasks/BACKLOG.md` and dropped from lanes 06 and 10 to 21 when the operator confirms this triage; 0386, 0903, 0608, 0957 and 0302 take the restated text above.

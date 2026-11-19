# Assumption triage (freeze review item 6)

Source: `grep -rnE "ASSUMED|ASSUMPTION|Assumed" packages/*/conformance`, the 15 kernel packages only: 124 lines in 107 files. Classified by reading each assumption line and grepping the spec for the quoted shape; no conformance file is edited. Counts: **stale 43, unstated public shape 24, plumbing 57**. Spot-check a row before acting on it.

Classes: stale = the spec now states it (the comment can go, or the clause be quoted); unstated = a public shape no section names (spec text by RFC before the freeze); plumbing = fixture layout, harness seam or test input (accept).

## Unstated public shape (24): needs spec text by RFC

| section | what is unstated | lines |
| --- | --- | --- |
| k.sim | sim `ctx.net.route(url, handler)` is named by no section | services/never-throws:8, services/network-failure:9, services/network-failure:19, services/timeout:8, services/api-input:8, services/status-errors:8, services/decode-failure:8, services/param-encoding:8, services/ok-decodes-output:8 |
| k.ledger | `ledger(items)`, `ledgerDiff(before, after)` of `@keel/testing` and their input shape | testing/ledger-fixtures.ts:1, testing/ledger-fixtures.ts:2 |
| k.schema | format-type node accessor | schema/format-type-node:2 |
| k.runtime | return value of `resume` ({ warnings }) is not stated | runtime-dom/rules-e1253:2 |
| k.forms | an untouched field of a form with no `initial` holds an absent value | forms/required-message-0091:4 |
| k.ui | motion tokens emitted as CSS custom properties | ui/reduced-motion:3 |
| k.a11y | `contrastTable` entry field names (`scheme`, `fg`, `bg`, `ratio`) | ui/a11y-contrast-table:3 |
| k.a11y | how `check` receives tokens (`artifacts: { tokens }`) | check/a11y-contrast-inherited:3 |
| k.shell, k.return | the `tauri.conf.json` key path of deep-link schemes | scaffold/return-scheme:4 |
| k.testing | how `renderRoute` receives tokens (`artifacts: { tokens }`) | testing/a11y-render-contrast:4 |
| k.security | header name of the `default-src 'none'` policy for other responses | server/security-dev-report-only:57 |
| k.evidence | `security.json` field names | cli/evidence-security:2 |
| k.evidence | `runs` key names | cli/evidence-failing-run:3 |
| k.evidence | the object holding a sink clause in `pii.json` | cli/evidence-shipped-rungs-0095:3 |
| k.sim | sim `ctx.net.route(url, handler)` | ctx/sync-sim-offline:3 |

## Stale (43): the spec states it

| spec sentence or section | lines |
| --- | --- |
| k.router: "`createRouter(routes, { ctx, history, mode? })`"; `navigate` and `App` are stated (Client); `memoryHistory` is a fixture helper | router/fixtures.ts:2, router/revalidate-data-binding:4, router/last-navigation-wins:4, router/head-focus:4, router/prefix-fixtures.ts:2, router/head-fixtures.ts:2, router/head-search-only:4, router/search-only-keeps-page:4 |
| k.server: `createApp` is the entry | server/fixtures.ts:2, server/head-fixtures.ts:2, server/topology-fixtures.ts:4, server/topology-fixtures.ts:35 |
| k.runtime: `resume(document.…` the entry calls `resume` | runtime-dom/resume-observed:4, runtime-dom/resume-identity:7, runtime-dom/event-before-resume:3 |
| k.opening: `keel.return` in `ctx.storage`; sim `ctx.clock.advance` (k.ctx) | testing/return-opening:6, testing/return-opening:7, testing/return-opening:8 |
| k.deploy: "a `diag` whose `frames` start at that file: at most 5"; k.server Log: `<path>:<line>:<col>` | server/diag-frames-0095:4, server/deploy-frames-source-map:3, server/privacy-diag-frames-0095:4 |
| k.scaffold Codemods: `place <module> --to <deployable> --adapter <adapter>` | scaffold/topology-deploy-files:2, scaffold/peer-key-0091:3 |
| k.testing: `fire`, `renderRoute`, k.forms `form(schema)` | testing/render-route-stores-0093:6, testing/a11y-e1821-autocomplete:5 |
| k.persist Server saves: `commitStores(ctx, factory, fn)` | server/commit-stores-retry:3, server/commit-stores-save-events:3 |
| k.router: "`createRouter(routes, { ctx, history, mode? })`" | forms/fixtures.ts:2 |
| k.forms: a blank optional field is a missing key of the parsed input | forms/blank-optional-0091:5 |
| k.forms Validation: validated on blur | forms/issue-text:3 |
| k.component / k.check: E1405 and its fix | check/E1405-top-level-prop-read:4 |
| k.check: E1509 prefix collision rule reads routes and schema | check/E1509-prefix-collision:2 |
| k.shell: "Cargo writes `Cargo.lock` there on the first build; it is committed and not generated." | scaffold/shell-files:4 |
| k.return: "other links are ignored" | testing/return-link-intake:7 |
| k.a11y: "`focusOrder()` (harness handles): focusable element ids in order, less disabled and hidden ones." | testing/a11y-focus-order:4 |
| k.opening Stored value: the `keel.return` value in `ctx.storage` | testing/return-chains:13 |
| k.testing: `fire`, `renderRoute` | server/render-route-shared-copy-0093:5 |
| k.hosting Allowed origins: `createApp({ allow })`, `host` | server/hosting-0087:10 |
| k.server: `err` JSON `{ ok: false, error: { code, message, data } }` | services/network-failure:11 |
| k.evidence: `security.json` holds "the `csp.txt` text for each `client` one"; peer origin from k.hosting | cli/security-csp-txt:3 |
| k.sim: "The seed is `seed`, else `KEEL_SEED`, else 1337" | cli/evidence-fixture.ts:4 |
| k.schema `piiPaths`: array items `*` | cli/evidence-pii-coverage:2 |
| k.services: `ctx.net.fetch`; k.hosting: credentials `include` to another origin | cli/hosting-peer-binding:6 |

## Plumbing (57): accept

Fixture layouts (`check/module-support.ts`, `cli/compat-support.ts`, `server/topology-fixtures.ts` `routes.json` `{ data, hash }`, `cli/topology-modules.ts`), compiled-op seams of `@keel/runtime-dom/ops` (`list`, `match`, `template`, `clone`, `text`; `runtime-dom/*` 6 lines), `@keel/ui/css` helpers (`compileStyles`, `contrast`; `ui/fixtures.ts`, `aria-states-css`, `responsive-media`), in-process scaffold ops (`scaffold/fixtures.ts`, `place-support.ts`, `project-deploy-files`, `turbo-emission-deploy-files`, `dockerfile-storage`), `cli/fixtures.ts` `run(argv, io)`, `createApp` rejecting with the code in its message (`server/e1552`, `e1553`, `e1558`, `api-routes-0086`, `identity-e1579`), test-built inputs and answers (`testing/return-chains` lines 10 to 12, 14, 15; `return-opening` 8; `return-link-intake` 5, 6; browser report bodies in `server/security-report-log`), harness element conventions (`testing/fire-focus-0091`, `state-active-sort-mixed`), and diagnostics found by text or position in fixtures (`cli/topology-e1558-*`, `E1559`, `E1562`, `a11y-ledger-claims`, the JSON Schema node walks).

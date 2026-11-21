# RFC 0180: k.testing: `renderRoute` with `app` runs a `node` page as the build serves it

Status: accepted (ADR-0202). From walkthrough finding L3-1 (`tasks/p1/walkthrough-findings.md`); the fault itself is fixed in 58649bd1.

## Decisions
- D1: `renderRoute(id, { app, routes, ... })` takes `app`, a `createApp` result (`ServerApp`, k.server), and then runs the page as a built `node` page runs: no client router. It GETs the page's URL through `app.fetch` and resumes the answer on `ctx` as `resumeDocument` does. This is document mode. Without `app` the harness renders through the client router, as now (router mode).
- D2: the harness learns the page's deployable from the test, not from the topology: a test passes `app` built for the deployable that serves the page. The rejected alternatives: a `topology` option read by the harness, or `keel test` reading `topology.ts`. Either would make `@keel/testing` build a server app, a dependency cycle (`@keel/server` tests depend on `@keel/testing`), and either way the test needs the app's `ctx` and peers to agree with the page.
- D3: when each mode applies. Document mode is for a page a `node` deployable serves (a `static` one's page too, which has no action, E1553). Router mode is for a page a `client` deployable serves, a native shell (`shell`) and a test of the router itself. A page served by a `node` deployable and tested without `app` is W1723 in `keel check`: the route id must be a literal, and its module prefix must name a module the topology puts in a `node` deployable. It is a warning, since a router-mode test of such a page still checks its components.
- D4: `fire` on a submit in document mode. The `<Form>` runs k.mount Form: invalid values show their errors and nothing is sent. Valid values are POSTed `application/x-www-form-urlencoded` (the named controls and the submitter's, as the browser sends) with `sec-fetch-site: same-origin` and the caller cookie to `app`. A 303 is followed with a GET, as a browser does. The answer replaces the page and is resumed, a 422 `keel.fields` document too, and `fire` resolves once that resume has settled. In router mode `fire` on a submit calls the action in process, as now.
- D5: a `Link` click and the handle's `navigate(href)` to a path `app` answers with a document load that document the same way. `documents()` lists every document navigation in both modes (k.mount Testing); in document mode those to `app` are made, the rest only recorded. `location().entries` counts the loaded documents.
- D6: `state` (module stores set in the test's graph) and `shell` have no meaning when the page comes from a server: with `app`, either rejects with E1722 before any request. Server state is seeded through `ctx.storage`, as `createApp` reads it (k.server Server state).
- D7: k.testing goes from `conformance-covered` to `implemented` until its four new clauses, in the ledger at `none`, are covered. k.mount's Testing sentence names the exception and gains no clause. Nothing becomes `frozen`.

## Problem
A page a `node` deployable serves runs in the browser with no router: the build gives it the resume entry, islands only (`packages/compiler/src/vite.ts`, `resumeEntry`). So its `<Form>` posts natively (k.mount Form, `packages/router/src/Form.ts`), and what the reader sees after a submit is the server's answer document: the 422 re-render with the submitted values and errors, or the target after a 303 (`packages/server/src/internal/runAction.ts`).

`renderRoute` always mounts the client router (`createRouterWith` in `packages/testing/src/renderRoute.ts`), and the `<Form>` there calls the action in process and sets `keel.fields` errors on the client. The answer document is never built under test. The walkthrough's receipts form passed its `renderRoute` test ("refuses an amount with three decimals" sets `invalid: true`), while the built app cleared the field and showed no error: the 422 document dropped the values and the message (L3-1). Every app test passed over a broken path.

`resumeDocument(html, { routes })` can resume a `createApp` document, and k.testing has a clause joining the two on one ctx. But a test has to fetch, follow redirects and resume by hand at each step, and nothing tells an author to.

## Proposal
k.testing Harness, a new bullet: with `app`, `renderRoute` runs a built `node` page as D1, D4 and D5 say; without it, the router renders. Rules gain E1722 (D6) and W1723 (D3). k.mount Testing: `documents()` navigations are not made "but one to `app` under `renderRoute` with `app`".

For an app author: a test of a node page reads `const app = await createApp({ topology, routes, ctx }); const t = await renderRoute('receipts.new', { routes, app, ctx })`. `fire`, `find`, `a11y` and `route()` read the resumed document, so they meet the markup a browser gets.

## Alternatives
- **A `topology` option, or `keel test` reading `topology.ts`.** Rejected (D2): a dependency cycle, and a second place that builds the server app.
- **Document mode by default, with the harness making its own `createApp`.** Rejected: same cycle, and tests that seed `ctx.storage` or peers need the app they built.
- **Keep router mode and document `resumeDocument` steps in the skill.** Rejected: four manual steps per submit, and the harness would keep passing where the build fails.
- **An error, not a warning, for a node page tested without `app`.** Rejected: router-mode tests of a node page's components stay useful, and an error would force `app` into every unit test.

## Spec diff
Applied in this commit:
- **k.testing** (status `implemented`, D7): Harness gains the `app` bullet; Rules gain E1722 and W1723. Conformance gains clauses 15 to 18.
- **k.mount**: the Testing sentence names the exception (no clause; its status stays).
- **Map**: the k.testing row reads `implemented`.
- **Ledger**: `k.testing#15` to `#18` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0180`, from the spec text alone, in `packages/testing/conformance/` (W1723 may sit with the check fixtures in `packages/check/conformance/`):
- k.testing 15: a fixture module `f` in a `node` deployable, its page holding a `<Form>` whose action answers `keel.fields` `{ amount: 'Too many decimals' }` for a schema-valid amount. `renderRoute` with `app` from `createApp` on the test's ctx; a valid submit leaves the amount field `invalid`, holding the submitted value, its error text that message, and `documents()` holds one POST whose body is exactly the named fields. An invalid submit shows the schema error and the action records no call.
- k.testing 16: the same with an action answering `ok(href)` to another page: `route().id` is the target's, `location().entries` is 2, and the target's loader ran once through `app`.
- k.testing 17: the same page without `app`: a submit records no document and the `keel.fields` answer sets the field's error in process.
- k.testing 18: `app` with `state`, and `app` with `shell`, each reject with E1722 and `app` receives no request. W1723 fires on `renderRoute('f.page', { routes })` in a test file of a project whose topology puts `f` in a `node` deployable; it does not with `app`, nor when `f` is in a `client` deployable.
Spec topics: `pnpm spec k.testing`, `pnpm spec k.mount`; for context `pnpm spec k.forms`, `pnpm spec k.server`, `pnpm spec k.resume`.

## Build
- `@keel/testing`: `RouteRenderOptions.app` (typed by a structural `{ fetch(req: Request): Promise<Response> }`, so no dependency on `@keel/server`); document mode on the `resumeDocument` path; the submit, follow and replace loop; E1722.
- `@keel/check`: W1723, reading the topology statically as E1552's reader does, and its `EXPLANATIONS` entry.
- `apps/household` and golden apps: node pages' form tests pass `app`.
- Docs: the keel-testing skill (`renderRoute` with `app`), the scaffold's node test template.

## Known limits
- W1723 reads literal route ids only.
- A document from another origin, or a path `app` does not answer, is recorded and not loaded.

## Migration
None: unreleased.

## Token impact
k.testing 6,005 to 7,500 characters (1,875 tokens), at the section budget, with the new text trimmed to fit; k.mount +60 characters. No budget moves.

# RFC 0215: std.sessions: a session of a served page replays through its app

Status: implemented (ADR-0237), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends std.sessions (API, a new Served pages paragraph, Commands, Conformance) and the std map row. From `apps/sessions` and `apps/golden-2` under `keel test` (backlog 1029).

## Decisions
- D1: `replay` and `minimize` gain `serve`, the std.multi shape: a function of the replay ctx resolving a `createApp` result made on it. With it the base is rendered with `renderRoute` and `app` (k.testing), so the page runs as its `node` deployable serves it. Replay gains the mode; the emitted test is not the only bridge, so the run `to-test` uses to prove a reproduction is the run the test makes.
- D2: `keel session replay|minimize|to-test` pick the mode from the deployable serving `route.id`: `node` replays with `serve`; `client` and `static` keep the router. `serve` builds the app as the generated entry does: `topology`, `deployable`, every placed module's routes, the identity source; no runners, peers, assets or `std` config.
- D3: loader data and actions are not replayed from the recording. They run in the app over the sim ctx, whose storage starts empty. The recording holds no net exchange and no server state, and gains none.
- D4: in the `app` form the recorded `state` is not applied (E1722 forbids `state` with `app`); each store starts as the served document resumes it.
- D5: the recording holds no user and gains none. `--user <id>` on the three commands, and `user` on `replay` and `minimize`, render the base signed in as that id (k.user Testing), in either mode. The emitted test writes `user: "<id>"` only when `--user` was given.
- D6: a base that resumes as another route (a guard's redirect) is E2003 for the base, `unapplied` `-1`, with the message `base route <id> redirected to <other id>`. No new code.
- D8: the emitted file of a `node` page is `test/session-<fingerprint>.test.ts` in the project folder, where the hand-written `app` tests live (golden-2's, household's, `apps/sessions`' own), not under the module. k.boundary Reach counts a non-server-only file under `modules/<id>/` of a `node` module as client-reachable, a test file too, so a file there importing `identity.server.ts` is E1004, as k.boundary says it should be. A file outside every module is not client-reachable and may import server-only files. No boundary exception is added.
- D9: `serve` gets the replay ctx with its clock at `at` and its random stream unread; app and page then draw from that one stream, so two replays are equal, and the stream's position after a replay is not part of the result. A served session's server data comes only from its recorded inputs replayed through the app, never from `state`.
- D7: W1723 is unchanged. The emitted file of a `node` page passes `app`; a hand-written router-mode `renderRoute` of a node page keeps the warning.

## Problem
`keel test` in `apps/sessions` reports six W1723 and in `apps/golden-2` one. W1723 (k.testing) is a literal `renderRoute` id of a `node` deployable's module with no `app`: such a page should be rendered as its deployable serves it.
- Two of the six are files `keel session to-test` wrote: `apps/sessions/modules/ops/test/session-fb142676235c.test.ts` and `session-9a20c4b36977.test.ts`. The emitter (`packages/std-sessions/src/toTest.ts`) always writes `renderRoute(<id>, { routes, params, search, state, ctx })`, and `apps/sessions` has one deployable, `sessions`, a `node` one.
- Four are hand-written, in `apps/sessions/test/homeRecording.test.ts`: they render `ops.home` through a router over test manifests whose loaders fail, to show the recorder takes the router's error events.
- golden-2's one is hand-written: `apps/golden-2/test/signedInSession.test.ts` renders `accounts.signin` (the `api` deployable, `node`) with `user` and no `app`, though the file builds the app it would pass.

The emitter cannot change alone. std.sessions defines `replay` for router mode only, and `to-test` replays the session (redacted with `expose`) and writes a file only when that replay reproduces the fingerprint. A file in the `app` form proved by a router-mode replay would claim a reproduction nobody ran. The spec also says nothing of how an emitted test builds an app, what becomes of the recorded `state` (which `renderRoute` with `app` rejects, E1722), or how a signed-in page is reached, since a recording keeps no `user` and a page of a `node` deployable never learns one (k.guards Client answers `/__keel/user` for a `client` deployable's router only).

## Proposal
### Replay with `serve`
`replay(session, { routes, redact?, serve?, user? })`. With `serve` the replay makes its sim ctx of `seed`, advances it to `at`, calls `serve(ctx)` once and renders the base with `renderRoute(route.id, { routes, params, search, ctx, app })`. Guards, loaders and actions then run in the app over `ctx.storage`, which starts empty; submits are posted and followed, links load documents, as k.testing's `app` form does. Inputs apply as in router mode: `fire`, `nav` through `navigate`, `net` through `setOnline`, with the same skipping of an input the previous one produced. `minimize` takes the same options and calls `serve` once per run, so every run starts from an empty server.

`serve` is std.multi's name and shape (`openGroup` and `replayGroup` take `serve(ctx)`), here narrowed to a `createApp` result, because `renderRoute`'s `app` needs one and `user` needs its signer binding on `ctx` (E1724).

### What determinism the recording gives
The session holds the seed (when the recording ctx had one), the base route and the inputs with their clock times. Under `serve` the app and the page share the ctx's clock and random (k.mount Testing), so two replays of one session are equal. `serve` is called with the clock at `at` and the random stream unread; the app draws from the stream while it serves, so what is left of it after the replay is not specified. The recorded run's server state, loader answers and user are not in the session. A session whose error needs them does not reproduce: `replay` reports E2004 and `to-test` writes nothing, as now. That is the honest result. A session recorded against production data can only be replayed against data the test supplies, and `to-test` gives the developer a file to add that data to.

### Recorded state
`state` is not applied with `serve`. `renderRoute` with `app` rejects `state` (E1722) because the served document carries its stores in `#k-state`; seeding the page's client stores over that would render a page no server sent. The recorded `state` is a browser's view of its stores, not server storage, so it cannot seed `ctx.storage` either. A served session's server data comes only from its recorded inputs replayed through the app: a recorded submit runs its action. A test that needs data the session did not write adds it by hand.

### The user
A recording keeps no `user` (k.user: no `tx` `meta`; std.sessions keeps no identifier), and this RFC adds none: a user id is an identifier the recording is built not to hold. `--user <id>` is the developer's choice of an id to sign the page in as, a test account's. It is passed as `renderRoute`'s `user`, in router mode too (k.user Testing defines `user` with and without `app`). The page's own requests then carry `x-keel-user` for it, no `identify` runs, and the harness's cookie jar holds the caller cookie the app mints, never a recorded one. A guarded base replayed without `--user` redirects: E2003 for the base names the route it landed on, so the fix is plain.

### The emitted test
For a `node` deployable `to-test` writes `test/session-<fingerprint>.test.ts` beside `topology.ts`, with the app in the test body:
```ts
// Session: fb142676235c, seed 0
import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { record } from "@keel/std-sessions/record";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import topology from "../topology.ts";
import { routes as opsRoutes } from "../modules/ops/routes.ts";

const routes = routeTable(opsRoutes, sessionsRoutes);

test("session fb142676235c", async () => {
  const ctx = createCtx({ mode: "sim", seed: 0 });
  ctx.clock.advance(1794262903390);
  const app = await createApp({ topology, deployable: "sessions", routes, ctx });
  const rec = record(ctx);
  const h = await renderRoute("ops.home", { routes, params: {}, search: {}, ctx, app });
  ctx.clock.advance(557);
  await h.fire("ops.home.limits", { type: "click" });
  expect(rec.errors()).toEqual([]);
  h.dispose();
});
```
`routes` is the table of every module the deployable places (an app module's `routes.ts`, a stdlib module's package `./routes`), joined with `routeTable` in `topology.ts` order when there are several, as above for `apps/sessions`. `identity` is imported from `../identity.server.ts` when the project has one. The file sits in the project's `test/` folder, where the apps' hand-written `app` tests already build their apps and import server-only files (`apps/household/test/serve.ts`, `apps/golden-2/test/signedInSession.test.ts`). Under `modules/<id>/test/` of a `node` module it would be client-reachable (k.boundary Reach) and its identity import E1004. The router form stays under `modules/<route module>/test/`. Runners, peers, assets and the `std` config are left out: a runner works on a schedule the session does not hold, a peer is another deployable the test would have to build, and assets and `std.json` are build output. A session that needs one of them does not reproduce and gets no file. The file holds no `state`, so it holds no recorded store value; the inputs carry exactly what the router form carries.

### What stays W1723
W1723 is unchanged. After the build the two emitted files in `apps/sessions` are rewritten by `to-test` in the `app` form. The four hand-written cases in `homeRecording.test.ts` and golden-2's `signedInSession.test.ts` are fixed by hand: each builds or can build `createApp` over its own route table, and passing it as `app` is W1723's fix. A case that cannot take `app` keeps its warning, which is what W1723 is for.

## Alternatives
- **The emitted test is the only bridge; replay stays router-mode.** `to-test` would prove a reproduction in one mode and write a test in another: a submit is an in-process action in one and a POST with a document swap in the other, and the file could fail where the proof passed. Rejected.
- **Replay loader data from recorded net exchanges.** The session would hold every loader answer, personal data among it, past what `redact` and `.pii()` cover. Rejected on k.privacy grounds and for the size of every session.
- **Seed `ctx.storage` from the recorded `state`.** The recorded state is the browser's stores, not `keel.store.<id>` server records; writing one into the other invents server state.
- **Record a `signedIn` flag or the user.** The browser of a node page does not know its user; learning it would add a request to every recording page, and the id is an identifier the recording keeps out.
- **A fixed placeholder user whenever the project has an identity source.** Signs in visitor pages that redirect a signed-in person (a sign-in page) and so breaks their replays.
- **A k.boundary exception for test files, or for emitted ones, under a `node` module.** A second notion of reach for one emitter; the project `test/` folder already holds such tests.
- **A `@keel/testing` helper that builds a deployable's app from `topology.ts`.** A kernel addition for one emitter; the scaffold's node route test already writes `createApp` inline.

## Spec diff
Applied in this commit.
- std.sessions (to `implemented` until its conformance and build land): API `replay` and `minimize` take `serve?` and `user?`, and `unapplied` is `-1` for the base; a new Served pages paragraph; Commands gain `--user`, the mode by deployable adapter and what `serve` builds, and three bullets defining the `to-test` file in each form; Conformance gains four clauses (#16 to #19), after RFC 0213's #14 and #15.
- Map (`spec/std/README.md`): the std.sessions row reads `implemented`.
- k.testing, k.user and k.mount are unchanged: W1723, E1722, `user` and the one-browser harness are used as written.
- No glossary term, no section, no code. No budget moves.

## Conformance diff
By the `conformance-writer`, from the spec text, in `packages/std-sessions/conformance/` (it imports `@keel/server` and `@keel/testing`, which a std package may):
- `to-test-served.test.ts`: std.sessions#16 and #19, over a fixture project with a `node` deployable `api` and a buggy page, and its `client` twin.
- `replay-served.test.ts`: std.sessions#17.
- #16's text names the file `test/session-<fingerprint>.test.ts` and adds no E1004 with an `identity.server.ts` in the fixture; its header quotes it again.
- `replay-served-user.test.ts`: std.sessions#18, a fixture whose guard admits only `u1` and redirects to `a.signin`.
- Existing cases keep their text: `to-test.test.ts` and `to-test-redaction.test.ts` cover the router form, which is unchanged for `client` fixtures. The writer checks whether their fixture projects place the page on a `node` deployable; such a fixture now gets the `app` form, and the writer moves it to a `client` deployable or asserts the `app` form.

## Migration
None. No app is released; the two emitted files are written again.

## Token impact
- Spec: std.sessions grows by about 900 tokens, within the 3,400-token section budget. The map is unchanged in size.
- `@keel/std-sessions`: `replay` gains a branch and the emitter a second form; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the four clauses. 3. Build:
- `packages/std-sessions/src/replay.ts`, `minimize.ts`, `ReplayResult.ts`, `internal/replayRun.ts`: `serve` and `user`; the base redirect as `unapplied` `-1`.
- `packages/std-sessions/src/internal/commandRun.ts`, `commandJob.ts`, `CommandJobInput.ts` and the job file `runJob` writes: the deployable's adapter, `--user` in the command's input schema (`command.ts`), the job importing `topology.ts`, the placed modules' routes and `identity.server.ts` to build `serve`; `unappliedText` for the redirect.
- `packages/std-sessions/src/toTest.ts`: the `node` form.
- `apps/sessions/modules/ops/test/session-*.test.ts`: removed, and written again by `keel session to-test` as `apps/sessions/test/session-*.test.ts`.
- `apps/sessions/test/homeRecording.test.ts` and `apps/golden-2/test/signedInSession.test.ts`: pass `app`.
- Docs: `packages/std-sessions/README.md`, the `keel-testing` and `keel-compliance` skills where they show `to-test`, a changeset, `tasks/BACKLOG.md`.

## For the operator
1. **Replay gains the `app` mode, not only the emitted test.** Recommended: yes; `to-test` proves what it writes.
2. **No recorded user, `--user` instead.** Recommended: yes; the nightly Action passes no `--user`, so a session of a guarded node page reports E2003 there and files no issue. Giving the Action a test user is a later choice.
3. **Runners, peers and `std` config are left out of the replay app.** Recommended: yes; a session that needs them does not reproduce and gets no file.

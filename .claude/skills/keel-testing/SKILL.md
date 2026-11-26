---
name: keel-testing
description: "Test and check Keel code: @keel/testing render, renderRoute (stores pages too), fire, settle, find, a11y, focusOrder, sim ctx and net routes, properties, explore, simulate, prove, std-statecharts chart, ledger rungs; E170x, E1706, E1708-E1710, E1715-E1719, E1722, E1726, E1727, E1728, E1729, E1730, E1732, E1733, W1733, W1608, W1723, E1108"
---

# Testing and correctness

Signatures: `keel docs k.testing`, `k.model`, `k.sim`, `k.prove`, `k.ledger`, `std.statecharts`; a code: `keel docs --for E1704`. `keel test` prints no `console.log`: assert, or run `vitest`.

## Components and routes

Address elements by **id only**; never query the DOM (E1701).

```ts fragment
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { routes } from "../modules/todos/routes.ts";

test("adds a todo", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route(new URL("/api/*", location.href).href, () => new Response("[]"));
  const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
  await r.fire("todos.add", { type: "click" });
  expect(r.find("todos.count").text).toBe("1 open");
});
```
- `render(Comp, { props, state: [[store, value]], ctx })` renders one component; `renderRoute(id, { routes, params, search, state, ctx, caller })` runs guards and loaders, then renders the chain; `{ url }` replaces `params` and `search`. `r.navigate(todos.href(id, params))` moves on.
- `fire(id, event)`: `click`, `input { value }`, `change { value? }`, `keydown { key }`, `submit`, `focus`, `blur`. A `<Form>` has no id: `submit` at its submit button goes to the form with the button as submitter, as `click` does; elsewhere it is dispatched at the element. It resolves once effects, resources and actions are quiet (no timers), as `await r.settle()` does.
- `keydown` goes to the focused element: an unfocused focusable target is focused first; a container of the focused element passes it on; else E1719. `change { value }` picks a `<select>` option (`input`, `change`); else E1726.
- `find(id)` is `{ id, role, name, text, state }`, never a node. `state(store)` is a value, `state()` every store by id. `a11y()` is the role, name, state tree; `focusOrder()` lists ids in tab order. An unknown id is E1705 (nearest ids listed). A render made in a test, `beforeEach` or `afterEach` is disposed at its end; one in `beforeAll` is yours to `dispose()`.
- Props and `state` parse first (`schema.invalid`). A loader or action naming `stores` runs over the harness `ctx.storage`, one request per navigation or submit: `createApp` on one ctx reads them.
- The harness ctx is sim (seed `KEEL_SEED`, default 1337): `ctx.clock.advance(ms)` moves time, `ctx.net.route(url, handler)` answers requests.
- Between tests: `store.snapshot()`, `store.restore(base)` in `afterEach`.
- A page a `node` deployable serves is tested as the build serves it: `const app = await createApp({ topology, routes, ctx }); const t = await renderRoute(id, { routes, app, ctx })`. The page is requested from `app` and resumed, no router; a `<Form>` submit (`await t.fire('fs.save', { type: 'submit' })`, `fs.save` its button) is POSTed to `app` and its answer (a 422 with the values and errors, or a 303's target) replaces the page. Seed server state in `ctx.storage`; `state` or `shell` with `app` is E1722, no `app` W1723.
- A recorded session of such a page replays so, `replay(session, { routes, serve: (ctx) => createApp({ topology, deployable, routes, ctx }), user })` runs guards, loaders and actions in the app over empty sim storage, ignoring the recorded `state`; a guarded page needs `user`, or its redirect is E2003.
- Two users: two harnesses over one `app` and `ctx`, each with `routes: () => import("./webRoutes.ts")` (exports `routes`), so each has its own client modules; read a store by id, `t.state()["shopping.copy"]`. With a table both share client stores (E1720).
- `shell: true` runs the page as in a native shell: `t.documents()` lists what the external browser opened, `t.returnLink(url)` delivers a return link. Without `user`, a shell run sends `GET /__keel/user` at start and after each mount answer: route it to `app.fetch`, or pass `user`.
- `h.requests()` lists what the page sent, `{ method, url, headers }` (header names only), in order: with `app` or `shell` that browser's own, otherwise every fetch on `ctx` while the handle is open. An unrouted, dropped or offline request fails nothing: assert the log whole, `expect(page.requests()).toEqual([{ method: 'GET', url, headers: ['accept'] }])`. With `identity.ts` a route test imports it and passes it, as the built entry does: `import mount from '../identity.ts'`, `renderRoute(id, { routes, mount })`; the router then reads `/__keel/user` (not with `user`) and matches no page under the mount. Without `mount` no read is sent and `keel check` flags the test (E1730); `mount` with `app` is E1722.
- A passing `renderRoute` per page runs axe-core, token contrast and reversed focus order and makes `a11y:` claims; E1703, E1804, E1820, E1821 fail it. E1702: role or name differs from `a11y.json`. Without `artifacts` a render takes `.keel/a11y.json` and `tokens.ts`; given, those alone (`{}`: none).

## Properties, exploration, simulation, proof

```ts
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { invariant, store, transaction } from "@keel/store";
import { explore, properties, simulate } from "@keel/testing";
import { prove } from "@keel/testing/prove";
import { expect, test } from "vitest";

const Count = s.object({ n: s.int({ min: 0, max: 9 }) });
const count = store(Count, { n: 0 }, { id: "demo.count" });
invariant(count, (v) => v.n >= 0);
const inc = transaction(count, "demo.inc", s.object({}), (v) => (v.n < 9 ? { n: v.n + 1 } : v));
const dec = transaction(count, "demo.dec", s.object({}), (v) => (v.n > 0 ? { n: v.n - 1 } : v));

test("every reachable state keeps the invariant", () => {
  expect(explore([inc, dec]).complete).toBe(true);
});
test("a transaction is deterministic and undoable", async () => {
  await properties(inc, { runs: 100, seed: 7 });
});
test("it holds for every state the schemas allow", async () => {
  expect((await prove([inc, dec])).proven).toHaveLength(2);
});
test("a fetch survives drops, delays and 503s", async () => {
  await simulate(
    async ({ ctx, run }) => {
      ctx.net.route("https://api.test/*", () => new Response("ok"));
      const res = await ctx.net.fetch(new Request("https://api.test/n")).catch(() => null);
      await run();
      expect(res === null || res.status === 200 || res.status === 503).toBe(true);
    },
    { runs: 100, seed: 7 },
  );
});

// A server app under `simulate` takes the run's `ctx`; faults make some requests 500.
const c = contract("notes", { "notes.page": { path: "/notes" } });
const post = action(c, "notes.page", { input: s.object({}) }, async () => ok(null));
const routes = manifest(c, { "notes.page": { component: () => document.createElement("main"), POST: post } });

test("a POST to the app replays to the same trace", async () => {
  await simulate(
    async ({ ctx, run }) => {
      const app = await createApp({ topology: topology({ web: { modules: ["notes"], adapter: "node" } }), routes, ctx });
      const headers = { origin: "http://localhost", "sec-fetch-site": "same-origin" };
      await app.fetch(new Request("http://localhost/notes", { method: "POST", body: new URLSearchParams(), headers }));
      await run();
      await app.close();
    },
    { runs: 100, seed: 7 },
  );
});
```
- `properties(Comp | tx, { runs: 100, seed })`: a component renders without throwing, matches `a11y.json`, has no axe violations and renders equally under one seed. A transaction's output parses, every `invariant(store, fn)` (from `@keel/store`, beside the store) holds, and `undo` restores. A plain-string `id` prop is generated id-shaped. E1704 carries the seed, run and shrunk case (`props`, `payload`, `state` in its `fix`); replay with `KEEL_SEED=<n>`.
- `explore(txs, { from, payloads, depth, maxStates })` is synchronous and visits every state of one store, checking its invariants. Give `payloads: { 'demo.add': [...] }` for a transaction whose payload schema is not finite (E1710). E1708 (thrown) an invariant broke (`data.snapshot` replays the shortest path); E1709 `maxStates` reached or a closed form that did not close. With a `depth` bound `complete` is `false` when states lie past it: assert `states.length` and `depth`, or `complete` only for the closed form.
- A server store factory (`savedStores()`) creates reactive primitives: call it in a scope, `scope(() => undefined).run(() => savedStores())` (`@keel/reactive`; else E1203).
- `simulate(scenario, { runs, seed, horizon, replay, law, budget })` runs the scenario, in the run's async context, under generated delays, drops, `lost` responses, 503s, storage failures and offline windows. When no work of the run is pending, `simulate` moves the clock to the next deadline or offline window edge, up to the horizon, so a scenario awaits a job's effect, a statement or a delayed request directly (no helper moves the clock); a harness call resolves on a turn where nothing else of the run is pending. Pending work is every asynchronous resource but a promise made outside held work (a real timer, a hash, a file read) until Node closes it; held work until delivered, in start order once no thread-pool request is pending; and a harness call not stalled on `ctx.net`; work waiting on `ctx.clock` is parked. `run()` waits to the horizon, `run(ms)` exactly `ms` (integer 0 to 600,000, else `schema.invalid`), `run(0)` drains work now, `horizon: 0` leaves the clock to `ctx.clock.advance`. A capability's sim factory gets `hold(label, start)` only for work that answers through something made outside the run, never around a clock wait. A sim ctx outside `simulate` is never driven. E1727: the scenario waits on nothing the run can move (raise `horizon` or `run(ms)`); E1728: held work waits on the sim clock, the run's real-time budget is spent with work in flight (`the budget ran out with work in flight: <labels>`; `budget` ms, else the test's timeout less a tenth, else 300,000 ms; never shrunk or replayed; mid-shrink the failure so far, `shrunk until the budget ran out`), or work outlives the scenario past the budget (`work outlived the scenario`: `app.close()`, `clearInterval`); E1729: two replays of one `SimRun` differ in trace, final storage and store values included (unseen work, or state kept across runs): the law check (on in `keel test`, `law` overrides; passing runs replayed after the last within the budget, `checked` counting them; `law: false` only for a scenario that counts its calls) or a failing run's two replays; `fix` shows `recorded:` and `replayed:`, the entries with values reduced to type and size. An `import()` in app code is I/O the run neither waits for nor orders by seed (W1608): import statically. E1727 and E1728 reach the operator as E1704 with the shrunk `SimRun`; `{ replay: simRun }` reruns it; an empty `SimRun` makes any sim ctx driven.
- `prove(txs)` from `@keel/testing/prove` (Node, optional peer `z3-solver`) proves the invariants by induction for every state and payload, for functions in the fragment (no calls to other functions, loops or reassignment). E1715 outside the fragment (use `explore`; a format field such as `line` in the store's schema has no sort, so store `s.string()` and keep the format in the form's schema); E1716 counterexample (strengthen the invariant), E1717 no verdict within `rlimit`, E1718 `z3-solver` missing.

## State charts

```ts
import { s } from "@keel/schema";
import { chart, coverage } from "@keel/std-statecharts";
import { explore } from "@keel/testing";
import { expect, test } from "vitest";

export const saveChart = chart("demo.save", {
  data: s.object({ tries: s.int({ min: 0, max: 3 }) }),
  start: { tries: 0 },
  events: { save: s.object({}), failed: s.object({}), saved: s.object({}) },
  guards: { canRetry: (d) => d.tries < 3 },
  actions: { count: (d) => ({ tries: d.tries + 1 }) },
  initial: "idle",
  states: {
    idle: { on: { save: "saving" } },
    saving: { on: { saved: "idle", failed: [{ to: "saving", guard: "canRetry", do: "count" }, { to: "gaveUp" }] } },
    gaveUp: { final: true },
  },
});

test("no state is unreachable or stuck", () => {
  const r = explore(Object.values(saveChart.events));
  expect(r.complete).toBe(true);
  expect(coverage(saveChart, r)).toEqual({ unreached: [], dead: [] });
});
```
A flow with states is a `chart` in a client-safe file; the id is the store id. It compiles to a store and one transaction per event, so `explore(Object.values(c.events))` is its closed form; `properties` covers every event. `keel check` reports E2751-E2755 (all literals, no spreads or computed keys). A format value in `start` or a fixture is `formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` (`@keel/schema`; E1108).

## Ledger rungs

A passing test credits every public export its body, or a helper it calls in its own file or a relative import, names. A component only passed to `properties` or `render` through a probe file is no call: the test names the component (`render(Chart, ...)`) to credit it. Rungs, highest held: `example` (a passing test), `probabilistic` (100-run `properties`, `simulate` or fast-check `fc.assert`, literal or imported seed; `fast-check` in `devDependencies` for a plain function), `exhaustive` (`explore` given `from`, `payloads` or `depth`), `proven` (closed `explore`, awaited `prove`, or an `expectTypeOf` test), `monitored` (a transaction run in production, read from `.keel/monitored.json`, which `keel session monitor <url>` writes). `keel ledger --diff`: E1706 a lower rung than committed or more `unsafe`. `keel test` writes `reports/tests/run.json` (keep it out of git); rungs need it (W1733). A spec clause's item is `<section>#<8 hex of its text>`; a conformance file cites one per header line: `// Spec: <section>, clause "<bullet>"` (inner `"` as `\"`), and any other `// Spec:` line is E1732; two bullets of one section with one text are E1733. A negative type test (`test/<name>.test-d.ts`, `// @ts-expect-error <what must not compile>` lines) is type-checked by `keel check`, never run, gives no rung; its expectations count as `negativeTypes`. `render` types callback props (a missing one does not compile) and schema props `unknown` (they parse at run time), so a negative type test of a schema prop calls the component, `Chart({ ... })`.

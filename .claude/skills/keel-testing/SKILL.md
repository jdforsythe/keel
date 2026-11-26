---
name: keel-testing
description: "Test and check Keel code: @keel/testing render, renderRoute (stores pages too), fire, settle, find, a11y, focusOrder, sim ctx and net routes, properties, explore, simulate, prove, std-statecharts chart, ledger rungs; E170x, E1706, E1708-E1710, E1715-E1719, E1722, E1726, E1727, E1728, E1729, E1730, E1732, E1733, W1733, W1608, W1723, E1108"
---

# Testing and correctness

Exact signatures: `keel docs testing` lists them: `keel docs k.testing`, `k.model`, `k.sim`, `k.prove`, `k.ledger`, `std.statecharts`; a code: `keel docs --for E1704`. Run with `keel test`.

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
- `render(Comp, { props, state: [[store, value]], ctx })` renders one component; `renderRoute(id, { routes, params, search, state, ctx, caller })` runs guards and loaders first and renders the chain; `{ url }` replaces `params` and `search`. `r.navigate(todos.href(id, params))` moves on (`todos` is the module's contract).
- `fire(id, event)`: `click`, `input { value }`, `change { value? }`, `keydown { key }`, `submit`, `focus`, `blur`. A `<Form>` has no id: `fire(<its submit button's id>, { type: 'submit' })` submits it. It resolves once effects, resources and actions are quiet (no timers). `await r.settle()` does the same with no event.
- `keydown` goes to the focused element: an unfocused focusable target is focused first; the container of the focused element passes it on; else E1719. `change { value }` picks a `<select>` option (`input`, `change`); else E1726.
- `find(id)` is `{ id, role, name, text, state }`, never a node. `state(store)` is a value; `state()` is every store by id. `a11y()` is the role, name and state tree; a labelled input's id comes from it. `focusOrder()` lists ids in tab order. An unknown id is E1705 (nearest ids listed). A render made in a test or its `beforeEach`/`afterEach` is disposed at its end, pass or fail; one made in `beforeAll` is yours to `dispose()`.
- Props and `state` parse first (`schema.invalid`, nothing renders). A loader or action naming `stores` runs over the harness `ctx.storage`, one request per navigation or submit, so a `node` page is tested like any other; `createApp` on one ctx reads its saves.
- The harness ctx is always sim (seed `KEEL_SEED`, default 1337). `ctx.clock.advance(ms)` moves time; `ctx.net.route(url, handler)` answers requests.
- Between tests: `const base = store.snapshot()` and `store.restore(base)` in `afterEach`.
- A page a `node` deployable serves is tested as the build serves it: `const app = await createApp({ topology, routes, ctx }); const t = await renderRoute(id, { routes, app, ctx })`. The page is requested from `app` and resumed with no router; a `<Form>` submit is POSTed to `app` and its answer (a 422 with the values and errors, or a 303's target) replaces the page. Seed server state through `ctx.storage`; `state` or `shell` with `app` is E1722. Without `app` such a test is W1723.
- A recorded session (std.sessions-served) of such a page replays the same way: `replay(session, { routes, serve: (ctx) => createApp({ topology, deployable, routes, ctx }), user })` runs guards, loaders and actions in the app over empty sim storage and does not apply the recorded `state`; a guarded page needs `user`, or its redirect is E2003.
- Two users: two harnesses over one `app` and `ctx`, each with `routes: () => import("./webRoutes.ts")` (exports `routes`), so each page has its own client modules; read its store by id, `t.state()["shopping.copy"]`. With the table both share client stores (E1720).
- `renderRoute(id, { routes, shell: true })` runs the page as in a native shell: `t.documents()` lists what the external browser opened, `t.returnLink(url)` delivers a return link after the page opened it (`keel docs k.return`). Without `user`, a shell run sends one `GET /__keel/user` at start and one after each mount answer: route it to `app.fetch`, or pass `user` and none is sent.
- `h.requests()` lists what the page sent, `{ method, url, headers }` with header names only (no value, no body), in order: with `app` or `shell` that browser's own, otherwise every fetch on `ctx` while the handle is open. An unrouted, dropped or offline request is logged and fails nothing: assert the request log whole, e.g. `expect(page.requests()).toEqual([{ method: 'GET', url, headers: ['accept'] }])`, which fails for a client-only app that has `identity.ts` (its first entry is `GET /__keel/user` with `accept` and `x-keel`). In a project with `identity.ts`, a route test imports it and passes it, as the built entry does: `import mount from '../identity.ts'`, `renderRoute(id, { routes, mount })`; the router then reads `/__keel/user` (unless `user` is given) and matches no page under the mount. Without `mount` no read is sent; `keel check` flags that test (E1730, fix: pass `mount`); `mount` with `app` is E1722. Nothing loads before a test file.
- A passing `renderRoute` per page runs axe-core, token contrast and reversed focus order, and makes the page's `a11y:` claims; E1703, E1804, E1820 and E1821 fail it. E1702: role or name differs from `a11y.json`. A render given no `artifacts` takes `.keel/a11y.json` and `tokens.ts`; given `artifacts`, those alone (`{}`: none).

## Properties, exploration, simulation, proof

```ts
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
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
```
- `properties(Comp | tx, { runs: 100, seed })`: a component renders without throwing, matches `a11y.json`, has no axe violations and renders equally under one seed. A transaction's output parses, every `invariant(store, fn)` (declared beside the store, from `@keel/store`) holds, and `undo` restores. A failure is E1704 with the seed, run and shrunk case; replay with `KEEL_SEED=<n>`.
- `explore(txs, { from, payloads, depth, maxStates })` is synchronous and visits every state of one store, checking its invariants. Give `payloads: { 'demo.add': [...] }` for a transaction whose payload schema is not finite (E1710). E1708 an invariant broke (`data.snapshot` replays the shortest path); E1709 `maxStates` reached or a closed form that did not close. E1708 throws; a run that returns found no broken invariant. With a `depth` bound `complete` is `false` when states lie past it: assert `states.length` and `depth` instead, or `complete` only for the closed form.
- A server store factory (`savedStores()`) creates reactive primitives, so a test calls it inside a scope: `scope(() => undefined).run(() => savedStores())` (`scope` from `@keel/reactive`, E1203 otherwise).
- `simulate(scenario, { runs, seed, horizon, replay, law, budget })` runs the scenario, in the run's async context, under generated schedules of delays, drops, `lost` responses, 503s, storage failures and offline windows. While the scenario is pending, `simulate` moves the run's clock to the next deadline or offline window edge on each turn where no work of the run is pending, up to the horizon, so a scenario awaits a job's effect, a statement or a delayed request directly and sees the time it was answered; no helper moves the clock, and a harness call resolves on a turn where nothing else of the run is pending. Pending work is every asynchronous resource other than a promise the run made outside held work (a real timer, a hash, a file read) until Node closes it, but not one a garbage collection destroys (a synchronous call's job); held work until delivered, in start order once no thread-pool request is pending; and a harness call not stalled on `ctx.net`; and work waiting on `ctx.clock` is parked, not pending. `run()` waits to the horizon, `run(ms)` to exactly `ms` after the call (integer 0 to 600,000, else `schema.invalid`), `run(0)` drains work at the current time, `horizon: 0` leaves the clock to the scenario's `ctx.clock.advance`. A capability's sim factory gets `hold(label, start)` only for work that answers through something made outside the run; never around a clock wait. A sim ctx outside `simulate` is never driven. E1727: the scenario waits on nothing the run can move (raise `horizon` or `run(ms)`); E1728: held work waits on the sim clock, the run's real-time budget is spent with work in flight (`the budget ran out with work in flight: <labels>`, oldest first, or `none`; `budget` ms, else the test's timeout less a tenth from the test's start, else 300,000 ms; never shrunk or replayed, never changes a trace; spent mid-shrink: the failure so far, `shrunk until the budget ran out`), or work outlives the scenario past the budget (`work outlived the scenario`: close what it opened, `app.close()`, `clearInterval`); E1729: on the law check (on in `keel test`, `law` overrides; passing runs replayed after the last within the budget, `checked` counting them; `law: false` only for a scenario that counts its calls) or a failing run's two replays, two traces of one `SimRun` differ, final storage and store values included (unseen work, or state kept across runs). A module load by `import()` in app code is I/O the run neither waits for nor orders by seed (W1608): use a static import. E1727 and E1728 reach the operator as E1704 with the shrunk `SimRun`; `{ replay: simRun }` reruns it, and an empty `SimRun` makes any sim ctx a driven one.
- `prove(txs)` from `@keel/testing/prove` (Node, optional peer `z3-solver`) proves the invariants by induction for every state and payload, for functions in the fragment (no calls to other functions, loops or reassignment). E1715 outside the fragment (use `explore`): `reduce` and loops are outside it, so a sum is held by `explore` and a seeded property; a format field (`line`) anywhere in the store's schema has no sort, so store `s.string()` and keep the format in the form's schema; E1716 counterexample (the invariant may need strengthening), E1717 no verdict within `rlimit`, E1718 `z3-solver` missing.

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
A flow with states (editing, saving, retrying) is a `chart` in a client-safe file; the id is the store id. It compiles to a store and one transaction per event, so `explore(Object.values(c.events))` is its closed form and every event passes `properties`. `keel check` reports E2751-E2755 on a bad declaration; all literals, no spreads or computed keys. A format value in `start` or a fixture is `formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` (`@keel/schema`; E1108 when the literal does not parse).

## Ledger rungs

Every public export is credited when a passing test's body, or a helper it calls in its own file or a relative import, names it. Rungs, highest held: `example` (a passing test), `probabilistic` (100-run `properties`, `simulate` or fast-check `fc.assert`, with a literal or imported seed; `fast-check` goes in `devDependencies` for a property of a plain function), `exhaustive` (`explore` given `from`, `payloads` or `depth`), `proven` (closed `explore`, awaited `prove`, or an `expectTypeOf` test), `monitored` (a transaction run in production, read from `.keel/monitored.json`, which `keel session monitor <url>` writes). `keel ledger --diff`: E1706 a rung lower than committed or more `unsafe`. `keel test` writes the run's report to `reports/tests/run.json` (each test file's sha, each test's line and state); keep `reports/` out of git. Rungs need it (W1733). A spec clause's item is `<section>#<8 hex of its text>`; a conformance file cites one per header line, `// Spec: <section>, clause "<bullet>"` (inner `"` as `\"`), and any other `// Spec:` line is E1732; two bullets of one section with one text are E1733. A negative type test (`test/<name>.test-d.ts`, `// @ts-expect-error <what must not compile>` lines) is type-checked by `keel check`, never run, gives no rung; the ledger counts its expectations as `negativeTypes`. `render` types a component's callback props, so a missing one does not compile; it types schema props `unknown` (they parse at run time), so a negative type test of one calls the component, `Chart({ ... })`.

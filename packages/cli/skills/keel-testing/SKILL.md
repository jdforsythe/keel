---
name: keel-testing
description: "Test and check Keel code: @keel/testing render, renderRoute (stores pages too), fire, settle, find, a11y, focusOrder, sim ctx and net routes, properties, explore, simulate, prove, std-statecharts chart, ledger rungs; E170x, E1706, E1708-E1710, E1715-E1719, E1722, E1726, W1723"
---

# Testing and correctness

Exact signatures: `keel docs k.testing`, `k.model`, `k.sim`, `k.prove`, `k.ledger`, `std.statecharts`; a code: `keel docs --for E1704`. Run with `keel test`.

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
- `fire(id, event)`: `click`, `input { value }`, `change`, `change { value }`, `keydown { key }`, `submit`, `focus`, `blur`. It resolves once effects, resources and actions are quiet (no timers). `await r.settle()` does the same with no event.
- A key goes to the focused element: `keydown` at a focusable element without focus focuses it first (blur, focus, then the key); at the container of the focused element it reaches that element; at an element that cannot take focus it is E1719. `change { value }` on a `<select>` picks that option (`input` then `change`); E1726 elsewhere or for a disabled option.
- `find(id)` is `{ id, role, name, text, state }`, never a node. `state(store)` is a value; `state()` is every store by id. `a11y()` is the role, name and state tree; a labelled input's id comes from it. `focusOrder()` lists ids in tab order. An unknown id is E1705 (nearest ids listed). A render made in a test, `beforeEach` or `afterEach` is disposed when the test ends, after `afterEach`, pass or fail, and restores seeded stores; no `dispose()` needed. One made in `beforeAll` is yours to `dispose()` in `afterAll`.
- Props and `state` parse first (`schema.invalid`, nothing renders). A loader or action naming `stores` runs over the harness `ctx.storage`, one request per navigation or submit, so a `node` page is tested like any other; `createApp` on one ctx reads its saves.
- The page is the production page: a thrown loader or action shows `unexpected` in the alert, `errorElement` and `Form` error.
- The harness ctx is always sim (seed `KEEL_SEED`, default 1337). `ctx.clock.advance(ms)` moves time; `ctx.net.route(url, handler)` answers requests.
- Between tests: `const base = store.snapshot()` and `store.restore(base)` in `afterEach`.
- A page a `node` deployable serves is tested as the build serves it: `const app = await createApp({ topology, routes, ctx }); const t = await renderRoute(id, { routes, app, ctx })`. The page is requested from `app` and resumed with no router; a `<Form>` submit is POSTed to `app` and its answer (a 422 with the values and errors, or a 303's target) replaces the page. Seed server state through `ctx.storage`; `state` or `shell` with `app` is E1722. Without `app` such a test is W1723.
- Two users: two harnesses over one `app` and `ctx`, each with `routes: () => import("./webRoutes.ts")` (exports `routes`), so each page has its own client modules; read its store by id, `t.state()["shopping.copy"]`. With the table both share client stores (E1720).
- `renderRoute(id, { routes, shell: true })` runs the page as in a native shell: `t.documents()` lists what the external browser opened, `t.returnLink(url)` delivers a return link after the page opened it (`keel docs k.return`). Without `user`, a shell run (or one given `mount`) sends one `GET /__keel/user` at start and one after each mount answer: route it to `app.fetch`, or pass `user` and none is sent.
- A passing `renderRoute` per page runs axe-core, token contrast and reversed focus order, and makes the page's `a11y:` claims; E1703, E1804, E1820 and E1821 fail it. E1702: role or name differs from `a11y.json`.

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
- With no options and every transaction named, `explore` is the closed form: `complete: true` means every state is covered.
- `simulate(scenario, { runs, seed, horizon, replay })` runs the scenario under generated schedules of delays, drops, `lost` responses, 503s, storage failures and offline windows. `run()` settles and steps the clock to each `after` deadline and each offline window's start and end within the horizon, so after it the net is online unless a window reaches past the horizon. A failure is E1704 with the shrunk `SimRun`; `{ replay: simRun }` reruns it.
- `prove(txs)` from `@keel/testing/prove` (Node, optional peer `z3-solver`) proves the invariants by induction for every state and payload, for functions in the fragment (no calls to other functions, loops or reassignment). E1715 outside the fragment (use `explore`), E1716 counterexample (the invariant may need strengthening), E1717 no verdict within `rlimit`, E1718 `z3-solver` missing.

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
A flow with states (editing, saving, retrying) is a `chart` in a client-safe file; the id is the store id. It compiles to a store and one transaction per event, so `explore(Object.values(c.events))` is its closed form and every event passes `properties`. `keel check` reports E2751-E2755 on a bad declaration; all literals, no spreads or computed keys.

## Ledger rungs

Every public export is credited when a passing test's body, or a helper it calls in its own file or a relative import, names it. Rungs, highest held: `example` (a passing test), `probabilistic` (100-run `properties` or `simulate` with a literal or imported seed), `exhaustive` (`explore` given `from`, `payloads` or `depth`), `proven` (closed `explore`, awaited `prove`, or an `expectTypeOf` test), `monitored` (a transaction run in production, read from `.keel/monitored.json`, which `keel session monitor <url>` writes). `keel ledger --diff`: E1706 a rung lower than committed or more `unsafe`.

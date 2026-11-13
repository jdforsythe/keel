---
name: keel-testing
description: "Test Keel components, routes and transactions with @keel/testing: render, renderRoute, fire, settle, properties, a11y, sim ctx and net routes; E170x"
---

# Testing with @keel/testing

Spec: `pnpm spec k.testing`. Address elements by **id only**; never query the DOM.

```ts
const t = render(Comp, { props, state: [[store, value]], ctx })
await t.fire('todos.add', { type: 'click' })   // also input {value}, change, keydown {key}, submit, focus, blur
t.find('todos.count').text      // { id, role, name, text, state }, never a node
t.state(store)                  // t.state() = all stores by id
t.a11y()                        // role/name/state tree
await t.settle()                // flush after a resource resolves, no event
t.dispose()                     // restores seeded stores
const r = await renderRoute('todos.list', { routes, params: { listId }, search: {}, state: [], ctx })
```
- `routes` is the manifest; guards and loaders run before it resolves. Props and `state` parse first (`schema.invalid`, nothing renders).
- Labelled inputs: find the id from `r.a11y()` by label, then `fire(id, { type: 'input', value })`.
- `fire` resolves after effects, resources and actions go quiet (no timers, else `keel.unexpected`).
- Harness ctx is always sim (`KEEL_SEED`, default 1337). Use `createCtx({ mode: 'sim', seed })`; advance time with `ctx.clock.advance(ms)`; fake the network with `ctx.net.route(new URL('/api/*', location.href).href, req => new Response(...))` (a handler may return `app.fetch(req)` of a real `createApp`).
- Reload data between tests: `const base = store.snapshot()` and `store.restore(base)` in `afterEach`.

**Properties:** `await properties(Comp | transaction, { runs: 100, seed })`. Components: no throw, a11y matches, no axe violations, deterministic. Transactions: output parses, every `invariant(store, fn)` holds, `undo` restores. Replay with `KEEL_SEED=<n>`.

**Reachable states and faults:** `explore([tx1, tx2], { from, payloads, depth })` visits every state a store reaches and checks its invariants (E1708 with a replayable snapshot); with no options and every transaction named it is the closed form, `proven`. `await simulate(async ({ ctx, run }) => { ... await run() ... }, { runs: 100, seed })` runs a scenario under generated schedules of delays, drops, 503s and offline windows. Rungs: `proven` needs a closed `explore` or type-level tests, `exhaustive` an `explore` run, `probabilistic` 100-run `properties` or `simulate`, `monitored` a `.keel/monitored.json` from `keel session monitor`.

**Errors:** E1701 selector/DOM query in a test · E1702 role/name differs from `a11y.json` · E1703 axe violation · E1704 property failed (seed, run, shrunk case) · E1705 unknown id (3 nearest listed) · E1706 ledger rung lowered.

Every export is named in a test; 100-run properties lift the ledger to `probabilistic`. Fix by code: `keel explain E1704`.

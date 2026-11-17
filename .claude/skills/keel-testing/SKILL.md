---
name: keel-testing
description: "Test Keel components and routes with @keel/testing: render, renderRoute (stores pages too), fire, settle, find, a11y, focusOrder, sim ctx and net routes; E170x"
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
const r = await renderRoute('todos.list', { routes, params: { listId }, search: {}, state: [], ctx, caller })
await r.navigate(routes.href('todos.show', { id }))
```
- `routes` is the manifest; guards (given `caller`, default `''`) and loaders run before it resolves. Props and `state` parse first (`schema.invalid`, nothing renders).
- A loader or action naming `stores` runs its factory over the harness ctx's `ctx.storage` (one request per navigation or submit), so a `node` deployable's page is tested like any other; it and `createApp` on one ctx read each other's saves. `state` holds no factory store.
- Labelled inputs: find the id from `r.a11y()` by label, then `fire(id, { type: 'input', value })`.
- `fire` resolves after effects, resources and actions go quiet (no timers, else `keel.unexpected`).
- A rendered route is the production page: a thrown page, loader or action shows `unexpected` in the alert, `errorElement` and `Form` error. Read the thrown text from the ctx's `error` reports (`observe`).
- Harness ctx is always sim (`KEEL_SEED`, default 1337). Use `createCtx({ mode: 'sim', seed })`; advance time with `ctx.clock.advance(ms)`; a test that creates a `real` ctx under a window calls `ctx.dispose()` when done (it removes the ctx's `online`/`offline` listeners); fake the network with `ctx.net.route(new URL('/api/*', location.href).href, req => new Response(...))`.
- A server log line: `createApp({ log: { format: 'json', write } })` (k.server Log). A saved store: `await ctx.storage.get('keel.store.<id>')` is JSON whose `state` is the store's value.
- Between tests: `const base = store.snapshot()` and `store.restore(base)` in `afterEach`.

**A11y:** a passing `renderRoute` per page (axe-core, token contrast) makes its `a11y:` claims; E1703/E1804/E1821 fail it. `t.focusOrder()`: ids in tab order.

**Errors:** E1701 selector/DOM query in a test · E1702 role/name differs from `a11y.json` · E1703 axe violation · E1705 unknown id (3 nearest listed) · E1719 `focus` on an unfocusable element. Properties, `explore`, `simulate`, rungs: keel-correctness.

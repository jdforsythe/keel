---
name: keel-api
description: "Build a Keel data API: node api module, API routes, @keel/services endpoints/service client, service({ module }), hydrate view stores, createApp server tests, OpenAPI services; E1510, E1511, E1512, E1113, E165x"
---

# API module + client

Spec: `pnpm spec k.api`, `k.services`, `k.server`. Deployables `web` (client), `api` (node; owns the data). Loaders and actions with `stores`: keel-server.

**API route:** `routes.ts` (plain `.ts`): `'api.lists': { api: true, path: '/api/lists', loader: loadBoard }` (no `component`, else E1510; the server answers it with JSON whatever `accept` says; not in a `client` deployable: E1511), then `routes.actions({ 'api.lists': { POST: postList } })`. Bodies are `application/json` Results (`keel.fields` 422). An API route's action declares `output` and returns `ok(value)`; the value is parsed by it before any save and answered as `{ ok: true, value }`; a write with nothing to say is `output: s.object({})`, `ok({})`. A page's action declares none (E1512 either way); `output` holds no `s.secret` (E1113). An API route's guard, loader and action also get `bearer: Secret<string> | undefined`, the `Authorization: Bearer` token (pages get `undefined`); the app checks it (keel-compliance). A loader or action denies with `return err({ code: 'keel.denied', message, data: null })`, answered 403 like a guard's denial. A guard's result reaches no handler, so check `bearer` (`tokens(ctx).check`) in the loader or action that uses the token's row, once; a guard check suits a route that only admits, and a handler that also needs the row checks again.

**Cycle:** `routes.ts` and an action returning `ok(routes.href(...))` import each other; import `routes.ts` first (tests too).

**Between modules:** `service({ module: 'api', schema })` (module in `deps`, route in its `public.routes`).

**Client:** `endpoints({ lists: { method: 'GET', path: '/api/lists', output: BoardReply, errors: { 422: FieldsReply } } })`; `service({ base, schema })` per call: base `new URL(url).origin` in `*.server.ts`, `location.origin` in components (a literal absolute URL in client code is E1571). `await api(origin).lists({}, ctx)` (a write: `{ body, bearer }`, `bearer` a `Secret<string>`): `Result<Out, ApiError>`, never a throw; never `ctx.net.fetch` in app code (E1651). Bodies: GET `{ id, results: { 'api.lists': { ok: true, value } } }`; action `{ ok: true, value }`. An OpenAPI document: `keel scaffold service <module> --openapi openapi.json` writes `<Id>Api.schema.ts` and `api.server.ts` (generated, read-only).

**View store:** only `hydrate = transaction(view, 'todos.hydrate', BoardView, (_s, d) => d)` changes it; after a write, re-read through the service and commit `tx(hydrate, value)` (an app helper; Keel exports no `syncAfter`). Pushed updates: keel-realtime; offline and concurrent writes: keel-writes; build and hosting: keel-deploy.

**Tests:** `app = await createApp(...)` (sim ctx); `app.fetch(new Request(url, { method, headers: { accept: 'application/json', 'content-type': 'application/json' }, body }))`. Client tests route sim `ctx.net` `/api/*` to `app.fetch`; on a ctx no `createApp` bound, `service({ module })` sends to `http://<module>.keel.invalid/api/*`.

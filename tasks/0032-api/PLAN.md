# Task 0032: golden app 1 with a real API

**Spec:** k.server, k.services, k.router, k.module · **Gate:** G2 · **Branch:** jdforsythe/test-impl · **Package:** apps/golden-1

## Deliverables
- [x] Second deployable `api` (adapter `node`, module `api`) beside `web` (client, `todos`) in `topology.ts`
- [x] `api.suggestions` route at `/api/suggestions`: `loadSuggestions.server.ts`, `SuggestionsApi.ts`
- [x] Client declares the endpoint with `@keel/services` (`suggestions.service.ts`, `SuggestionsReply.schema.ts`); `Suggestions.tsx` calls the typed client with its `ctx` (no `ctx.net.fetch` in app code)
- [x] `server.ts` + script `api` (`node server.ts`, port 4181, `@hono/node-server`); Vite dev/preview proxy `/api`; dev stub deleted
- [ ] `keel check` golden test green (blocked: 0027 D25, compiler E1004)
- [ ] Evals rerun (not started)

## Steps
1. [x] Design recorded: 0027 D22-D26.
2. [x] Implement api module, client service, server entry, proxy; tests on sim net with the real wire body.
3. [x] Verify: golden-1 tests, build, end to end (curl + smoke through the preview proxy).
4. [ ] Compiler E1004 fix (separate task, conformance first) -> golden test green.
5. [ ] Rerun golden-1 evals.

## Decisions
- D1: see tasks/0027-golden-app/PLAN.md D22-D26 (module `api` instead of `todos` in two deployables; plain `.ts` route component; endpoint output is the k.server runtime `Result` envelope; client built at call time; E1004 blocker; `server.ts` passes only its own deployable to `createApp`).
- D2: `pnpm check` 2026-11-06: only `@keel/check#check` fails, on the untracked `packages/check/test/mutants.test.ts` (biome; not this task's file, another session's work). structure-lint, generate, docs-freshness, budgets ok.
- D3 (D-next, data behind the API): the `api` module (node deployable) owns the board. `board.ts` (`api.board`, invariant beside it) and the transactions `api.addList|addTodo|toggleTodo|editTodo` moved from `todos` to `modules/api/`; `server.ts` passes `expose: [board]` (module-level store, process-shared). Routes (one route per path; actions by verb, k.router E1502): `api.lists` `/api/lists` (GET loader `loadBoard` -> `ok({ lists, todos, canUndo })`, POST `postList` ListDraft), `api.listTodos` `/api/lists/:listId/todos` (POST `postTodo` TodoDraft; unknown list `keel.notFound`), `api.todo` `/api/todos/:todoId` (POST `postEdit` TodoDraft; duplicate title in the list `keel.fields { title }`), `api.todoToggle` `/api/todos/:todoId/toggle` (POST `postToggle`), `api.undo` `/api/undo` (POST `postUndo` -> `board.undo()`, empty log is a no-op), `api.suggestions` unchanged. Every action returns `ok(null)`; runtime requests get `{ ok: true, value: null }`. Action-only routes render `ActionApi.ts`, `api.lists` renders `BoardApi.ts` (plain `.ts`, D23). Route ids are not the brief's `api.createList`/`api.addTodo`/...: `api.lists` GET and POST share a path, and route ids equal to transaction names would read as the same thing.
- D4 (D-next): `canUndo` added to the lists body (`BoardView`): the undo log lives on the server, so the client cannot otherwise disable Undo when there is nothing to undo.
- D5 (D-next, client): `todos` keeps a thin store `todos.view` (`view.ts`, `BoardView`) changed only by `todos.hydrate` (`hydrate.ts`, replaces the state). `todos.service.ts` declares the endpoints (`todos`: `lists`, `createList`, `addTodo`, `toggleTodo`, `editTodo` with `errors: { 422: FieldsReply }`, `undo`); output schemas `BoardReply`, `ActionReply`, `FieldsReply`, `BoardView` are `*.schema.ts` (E1104); `todosApi()` builds the client at call time (`location`, D24 of 0027). `refreshView(ctx)` = `lists` then `tx(hydrate)`; loaders `loadIndex` (new, on `todos.index`), `loadList`, `loadTodo` call it then pick by id (`keel.notFound`). Route actions `createList`/`createTodo`/`updateTodo` call the endpoints and return `ok(null)` (router revalidation re-runs the loader, which re-reads) or `ok(href)`; `updateTodo` passes the api's 422 `keel.fields` body on to the Form. Pages read `todos.view`.
- D6 (D-next, revalidation): no router API added. A public `router.revalidate()` on the instance would not help: the instance lives in the generated entry and `renderRoute`, and components (TodoRow's checkbox, AppShell's Undo) cannot reach it; a component-facing revalidate would be new spec surface (RFC). Instead the one mechanism is `refreshView`: Forms reach it through the router's `ok(null)` revalidation (the loaders call it), TodoRow and AppShell through `syncAfter(ctx, write)` (await the write, then `refreshView`). Stale loader `data` (a list heading after undoing that list's creation) stays until the next navigation. tasks/0014-router unchanged.
- D7 (D-next, kernel bug, found here): `@keel/services` sends bodies as JSON but server actions only decoded FormData (every service POST with a body was 422). Fixed in `@keel/server` (tasks/0028-server D24, k.server Request flow clause, changeset `server-json-action-body`).
- D8 (D-next): `node server.ts` loads `modules/api/board.ts` without the compiler, so the module-level store has no scope (E1203). `board` is created with `scope(() => undefined).run(() => store(...))` (k.reactive `scope.run` returns the value); the compiler leaves it alone (callee is not `store`). `server.ts` and `vite.config.ts` read `KEEL_API_PORT` (default 4181).
- D9 (D-next, tests): `test/simApi.ts` routes sim `ctx.net` `/api/*` to the real api deployable (`createApp(...).fetch` over `api.board`), so client tests get real `Result` bodies; `sent` records requests. `api.test.ts`: `properties()` on the four api transactions, the invariant via `board.check`, loaders and actions directly, every endpoint over `createApp(...).fetch` incl. undo, 422 and 404, document views. `routes.test.ts`: create list -> follow link -> a second `renderRoute` with an empty `todos.view` and a new client finds the list (refresh). evals/tasks/golden-1/TASK.md gained a Data ownership paragraph; its Files/Model lists and `pass.ts` (`modules/todos/board.ts`, transaction property targets) still describe the client-only baseline (not updated: eval design is a separate decision).

## Verification
- [x] `pnpm test --filter golden-1`: ok 31 tests, 0 failed
- [x] `pnpm --filter golden-1 build`: built
- [x] `pnpm --filter golden-1 check` clean; `node tooling/ledger.mjs --diff --scope golden-1` ok
- [x] `curl -s -H 'accept: application/json' http://localhost:4181/api/suggestions` -> `{"id":"api.suggestions","results":{"api.suggestions":{"ok":true,"value":[{"title":"Bread"},{"title":"Eggs"},{"title":"Milk"}]}}}`
- [x] `tooling/smoke/interact.mjs` against `vite preview` (port 4182: 4180 was held by an older preview): list page text ends `Suggestions\nBread\nEggs\nMilk`, no page errors
- [ ] `pnpm --filter @keel/cli test`: golden test fails with 7 x E1004 (D25); green after 9a5b8c1
- [x] D-next (data behind the API, 2026-11-06): `pnpm test --filter golden-1` ok 46 tests; `pnpm --filter golden-1 build` built; `pnpm --filter golden-1 check` clean; `pnpm check` ok; `pnpm --filter @keel/cli test` ok 92 (golden check green); `pnpm --filter @keel/server test` ok 75; `node tooling/ledger.mjs --diff --scope golden-1:` ok 120/120
- [x] `node tooling/smoke/persist.mjs` against `KEEL_API_PORT=4183 node server.ts` + `KEEL_API_PORT=4183 vite preview --port 4182` (4181 held by another process): create list, reload, open, add todo, reload, toggle, undo, reload: ok 8 steps; api log shows `POST /api/lists`, `POST /api/lists/<id>/todos`, `POST /api/todos/<id>/toggle`, `POST /api/undo`, all 200

## Next action
Restart the long-running api (4181) and rebuild the 4180 preview: both still serve the pre-D3 code (no `/api/lists`). Decide whether evals/tasks/golden-1 Files/Model and `pass.ts` move to the api-owned layout (D9); then rerun the evals.

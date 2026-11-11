# Golden app 1 (API-backed)

Build `apps/golden-1/`: the todo app of the client-only brief, but the data lives behind an API, with a `digest` module that counts the board in the background. Two deployables in `topology.ts`: `web` (`adapter: 'client'`, module `todos`) and `api` (`adapter: 'node'`, modules `api` (deps `todos`) and `digest`). Use only kernel APIs from the spec slice; read a section with `pnpm spec <id>`. Edit nothing outside `apps/golden-1/`. Scaffold with `scaffold('project', { workspace: true })` (CLI, from `apps/`: `keel scaffold project golden-1 --workspace`, which writes `apps/golden-1/`; keep its `index.html`, `vitest.config.ts`). If the slice leaves an API unspecified, report `blocked: <section> <question>`; invent nothing.

## Behavior (UI unchanged)
- `/` (`todos.index`): lists with open-todo counts; a Form adding a list.
- `/lists/:listId` (`todos.list`, search `filter`: `all|active|done`, optional): filtered todos, filter links, a Checkbox per todo toggling done, a Form adding a todo, `Suggestions` (`resource`, `Match` on loading, error message, ready titles).
- `/lists/:listId/todos/:todoId/edit` (`todos.edit`): Form editing a todo; success navigates to `todos.list`. Guard `editable` (`guard({ redirect: 'todos.index' }, fn)`, held as `guard: editable`) denies when `ctx.storage` `todos.readOnly` is `"1"`, redirecting to `todos.index`.
- Unknown `listId`/`todoId`: loader returns `err` `keel.notFound`; `ListError` renders.
- Layout `todos.shell` (`AppShell`): `main`, home Link, Undo Button (disabled when nothing can be undone).

## Architecture
- `api` owns the board as server state (k.server, RFC 0044): `board.ts` makes store `api.board` (`Board { lists, todos }`, initially empty) with an `invariant` beside it (ids unique, every `todo.listId` names a list); each transaction file exports a factory binding `api.addList|addTodo|toggleTodo|editTodo` to a board (pure; new ids arrive in the payload, minted with `ctx.random.id`; unknown or duplicate id leaves state unchanged); `boardStores.ts` returns the board and its bound transactions. Every api loader and action declares `stores: boardStores` and records `tx` meta `{ caller }`.
- Routes, one per path, actions by verb; responses are the k.server runtime `Result` JSON body:
  - `api.lists`: `/api/lists`, GET loader returns `{ lists, todos, canUndo }`; POST creates a list (`ListDraft`).
  - `api.listTodos`: POST `/api/lists/:listId/todos` (`TodoDraft`; unknown list is `keel.notFound`).
  - `api.todo`: POST `/api/todos/:todoId` (edit; a duplicate title in the list is `keel.fields { title }`).
  - `api.todoToggle`: POST `/api/todos/:todoId/toggle`.
  - `api.undo`: POST `/api/undo` (`undoWhere` this caller's last entry; nothing of the caller's is a no-op); `canUndo` is true when the log's last entry is the caller's.
  - `api.suggestions`: GET `/api/suggestions` (fixed titles).
- No hand-written server: `keel build` writes `dist/api/server.mjs` (k.topology Build); script `api` runs it with `--experimental-webstorage --localstorage-file=.api.storage`. `vite.config.ts` is `defineConfig({ plugins: [keel()] })`: `keel dev` serves every deployable on one origin. `api/module.ts` lists `api.lists` in `public.routes`.
- `digest` (deps `api`, `todos`, `@keel/std-jobs`, `@keel/std-schedules`; capabilities `clock`, `random`, `storage`, `net`; std.jobs, std.schedules, k.topology Runners):
  - `Digest.schema.ts` `{ open: s.int({ min: 0 }), done: s.int({ min: 0 }), at: s.number() }`, kept in `ctx.storage` key `digest.latest` (`LATEST_KEY`, `readLatest`: zero counts at 0 before the first count or when unparseable; `writeLatest`).
  - Job `digest.recount` (`recount.server.ts`, input `RecountInput` `{}`): reads `GET /api/lists` through `boardApi = service({ module: 'api', schema: board })` (`board.service.ts`, output `ListsReply`), counts open and done todos, writes them with `at` the `ctx.clock` time; the api's error is its `err`.
  - `jobs.server.ts` `queue({ 'digest.recount': recount })`; `schedules.server.ts` `digest.hourly` (`0 * * * *`, `UTC`, job `digest.recount`, input `{}`); `runners.server.ts` `[jobs, schedules]`.
  - Routes: `digest.show` `GET /digest` (`loadDigest`), `digest.refresh` `POST /digest/refresh` (`refresh`: `jobs.enqueue(ctx, 'digest.recount', input)`), `digest.feed` `GET /digest/feed` (`feedDigest`, a live loader: the stored digest, then each different one, read every 1,000 ms of `ctx.clock`). Components `DigestApi` (`digest.counts`, `digest.open`, `digest.done`) and `RefreshApi` (`digest.action`), plain `.ts` with `Props`.
- Splitting `digest` into its own `node` deployable edits `topology.ts` alone (`api: { modules: ['api'] }`, `digest: { modules: ['digest'] }`).
- `todos`: a `@keel/services` client for all six endpoints (built at call time, base `location.origin`; `Suggestions` calls it with its `ctx`, never `ctx.net.fetch`); a view store `todos.view` changed only by one transaction `todos.hydrate` (replaces the state); loaders re-read the board (`GET /api/lists`) and hydrate, then pick by id; route actions post through the client and return `ok(null)` (revalidation re-reads) or `ok(href)`; the edit action passes the api's 422 `keel.fields` on to the Form. Components that cannot revalidate (`TodoRow` toggle, `AppShell` Undo) write then re-read via a `syncAfter(ctx, write)` helper.

## Files (exactly these)
```
apps/golden-1/{package.json,tsconfig.json,vite.config.ts,tokens.ts,topology.ts}   scripts: check (tsc, biome, keel check), test, build, dev, api
apps/golden-1/modules/api/{module,routes}.ts
apps/golden-1/modules/api/{board,boardStores,addList,addTodo,toggleTodo,editTodo,ActionApi,BoardApi,SuggestionsApi}.ts  and  TodoIdParams.schema.ts
  (ActionApi, BoardApi, SuggestionsApi: plain .ts components, no JSX, each exporting Props for render and typing its first parameter `Infer<typeof Props>`)
apps/golden-1/modules/api/{loadBoard,loadSuggestions,postList,postTodo,postEdit,postToggle,postUndo}.server.ts
apps/golden-1/modules/todos/{module,routes,editable.guard,view,hydrate,refreshView,syncAfter,todosApi}.ts
apps/golden-1/modules/todos/{todos,suggestions}.service.ts
apps/golden-1/modules/todos/{TodoList,Todo,Board,BoardView,BoardReply,ActionReply,FieldsReply,ListDraft,TodoDraft,Suggestion,SuggestionsReply,ListParams,ListSearch,TodoParams}.schema.ts
apps/golden-1/modules/todos/{loadIndex,loadList,loadTodo,createList,createTodo,updateTodo}.server.ts
apps/golden-1/modules/todos/{AppShell,ListsPage,ListPage,TodoRow,EditTodoPage,ListError,Suggestions}.tsx
apps/golden-1/modules/digest/{module,routes,boardApi,LATEST_KEY,readLatest,writeLatest,DigestApi,RefreshApi}.ts  and  board.service.ts
apps/golden-1/modules/digest/{Digest,RecountInput,ListsReply}.schema.ts
apps/golden-1/modules/digest/{recount,jobs,schedules,runners,loadDigest,feedDigest,refresh}.server.ts
apps/golden-1/test/{api,board,components,routes,digest}.test.ts  and  test/{simApi,apiRoutes}.ts
```

## Tests (`@keel/testing` only; ids only)
- `test/simApi.ts` serves the real api deployable (`createApp(...).fetch` over `apiRoutes`, the `api` and `digest` routes merged as the generated entry merges them; sim ctx) behind sim `ctx.net` `/api/*`, recording requests, so client tests see real bodies.
- `api.test.ts`: `properties()` on the four `api` transactions; the invariant; every endpoint through `createApp().fetch` (runtime JSON), including 404, 422 (a field error, and an empty JSON body, which decodes as `{}`), undo. Import a module's `routes.ts` before any of its `*.server.ts`.
- `board.test.ts`: `properties(hydrate)`. `components.test.ts`: `properties()` for `TodoRow` and `Suggestions`; Suggestions loading to ready and to error on a sim 500; Undo disabled/enabled.
- `digest.test.ts`: the schemas and views; `readLatest`/`writeLatest`; `recount` through `boardApi` (success, and an api 500 storing nothing); `refresh` enqueues; served with its runners: refresh, the hourly schedule, the event-stream feed, a job enqueued before `close()` running after the next start.
- `routes.test.ts`: the former examples (filter, notFound, readOnly, invalid add focuses title, duplicate title error) plus a `renderRoute` refresh test: create a list, then a second `renderRoute` with an empty `todos.view` (new client, same api) still shows it.

## Acceptance (checked by `pass.ts`)
1. Every file above exists.
2. `pnpm check` clean, budgets included; `keel check` in `apps/golden-1` (`node ../../packages/cli/src/bin.ts check`) clean (the app's `check` script runs it too; the root `check.injected10` budget copies `apps/golden-1`, so kernel diagnostics in the app overflow it).
3. `pnpm test --filter golden-1` green.
4. `properties(` covers `addList addTodo toggleTodo editTodo hydrate TodoRow Suggestions`; `invariant(` in `api/board.ts`; `stores:` in the api `*.server.ts` files.
5. Ledger scope `golden-1:`: every item at rung example or better; `pnpm ledger --diff --scope golden-1:` clean. Verify with `node packages/cli/src/bin.ts ledger --scope golden-1:`: no item may be at rung `none`; a page or error component reached only through `renderRoute` is not evidence, so `render` it (or call the loader/schema) in a test too.
6. `unsafe(` count 0; no `any`, casts, `!`, `@ts-ignore`.
7. `pnpm --filter golden-1 build` green.
8. Quiet output within `tooling/budgets.json`.
9. No `server.ts`. The hidden in-process split suite passes: topologies A (`api: [api, digest]`) and B (`api: [api]`, `digest: [digest]`) served with `createApp` under sim ctxs of seed 1, in-process peers; one script through `api` (a list, three todos, a toggle, a refresh, the feed across the hourly run, a restart while `digest.recount` waits on its board read) gives equal transcripts after id normalization; in B every `/digest` request is forwarded and every board read goes through the peer; after the restart the queue is empty and the digest is current.
10. Built processes (`splitBuilt.ts`): two copies differing only in `topology.ts`; `keel build` and `keel check` clean in each; A has `deploy/api/Dockerfile` alone, B `api` and `digest` with peers in `compose.yaml`; the `node` deployables served from `dist/<name>/server.mjs` (one `KEEL_SECRET`, `KEEL_ORIGIN` the entry's URL) answer one HTTP script through `api` with equal normalized transcripts; SIGTERM exits 0 within 10 s; B's `digest` restarted on its storage answers the same `GET /digest`; without `KEEL_SECRET`, one E1560 line and exit 1.

Manual proof, not graded: `tooling/smoke/persist.mjs` (create list, reload, add todo, toggle, undo, reload).

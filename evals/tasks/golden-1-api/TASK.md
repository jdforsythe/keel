# Golden app 1 (API-backed)

Build `apps/golden-1/`: the todo app of the client-only brief, but the data lives behind an API. Two deployables in `topology.ts`: `web` (`adapter: 'client'`, module `todos`) and `api` (`adapter: 'node'`, module `api`, deps `todos`). Use only kernel APIs from the spec slice; read a section with `pnpm spec <id>`. Edit nothing outside `apps/golden-1/`. Scaffold with `scaffold('project', { workspace: true })` (keep its `index.html`, `vitest.config.ts`). If the slice leaves an API unspecified, report `blocked: <section> <question>`; invent nothing.

## Behavior (UI unchanged)
- `/` (`todos.index`): lists with open-todo counts; a Form adding a list.
- `/lists/:listId` (`todos.list`, search `filter`: `all|active|done`, optional): filtered todos, filter links, a Checkbox per todo toggling done, a Form adding a todo, `Suggestions` (`resource`, `Match` on loading, error message, ready titles).
- `/lists/:listId/todos/:todoId/edit` (`todos.edit`): Form editing a todo; success navigates to `todos.list`. Guard `editable` denies when `ctx.storage` `todos.readOnly` is `"1"`, redirecting to `todos.index`.
- Unknown `listId`/`todoId`: loader returns `err` `keel.notFound`; `ListError` renders.
- Layout `todos.shell` (`AppShell`): `main`, home Link, Undo Button (disabled when nothing can be undone).

## Architecture
- `api` owns the board: store `api.board` (`Board { lists, todos }`, initially empty) with an `invariant` beside it (ids unique, every `todo.listId` names a list), created in an explicit `scope(() => undefined).run(...)` so `node server.ts` can load it. Pure transactions `api.addList|addTodo|toggleTodo|editTodo` (new ids arrive in the payload; unknown or duplicate id leaves state unchanged).
- Routes, one per path, actions by verb; responses are the k.server runtime `Result` JSON body:
  - `api.lists`: `/api/lists`, GET loader returns `{ lists, todos, canUndo }`; POST creates a list (`ListDraft`).
  - `api.listTodos`: POST `/api/lists/:listId/todos` (`TodoDraft`; unknown list is `keel.notFound`).
  - `api.todo`: POST `/api/todos/:todoId` (edit; a duplicate title in the list is `keel.fields { title }`).
  - `api.todoToggle`: POST `/api/todos/:todoId/toggle`.
  - `api.undo`: POST `/api/undo` (`board.undo()`, empty log is a no-op).
  - `api.suggestions`: GET `/api/suggestions` (fixed titles).
- `server.ts`: `createApp({ topology, routes, ctx, deployable: 'api', expose: [board], log })` with `@hono/node-server`, port from `KEEL_API_PORT` (default 4181); script `api`. `vite.config.ts` proxies `/api` to it in dev and preview.
- `todos`: a `@keel/services` client for all six endpoints (built at call time, base `location.origin`; `Suggestions` calls it with its `ctx`, never `ctx.net.fetch`); a view store `todos.view` changed only by one transaction `todos.hydrate` (replaces the state); loaders re-read the board (`GET /api/lists`) and hydrate, then pick by id; route actions post through the client and return `ok(null)` (revalidation re-reads) or `ok(href)`; the edit action passes the api's 422 `keel.fields` on to the Form. Components that cannot revalidate (`TodoRow` toggle, `AppShell` Undo) write then re-read via a `syncAfter(ctx, write)` helper.

## Files (exactly these)
```
apps/golden-1/{package.json,tsconfig.json,vite.config.ts,tokens.ts,topology.ts,server.ts}   package scripts check/test/build/api
apps/golden-1/modules/api/{module,routes}.ts
apps/golden-1/modules/api/{board,addList,addTodo,toggleTodo,editTodo,ActionApi,BoardApi,SuggestionsApi}.ts
apps/golden-1/modules/api/{loadBoard,loadSuggestions,postList,postTodo,postEdit,postToggle,postUndo}.server.ts
apps/golden-1/modules/todos/{module,routes,editable.guard,view,hydrate,refreshView,syncAfter,todosApi}.ts
apps/golden-1/modules/todos/{todos,suggestions}.service.ts
apps/golden-1/modules/todos/{TodoList,Todo,Board,BoardView,BoardReply,ActionReply,FieldsReply,ListDraft,TodoDraft,Suggestion,SuggestionsReply}.schema.ts
apps/golden-1/modules/todos/{loadIndex,loadList,loadTodo,createList,createTodo,updateTodo}.server.ts
apps/golden-1/modules/todos/{AppShell,ListsPage,ListPage,TodoRow,EditTodoPage,ListError,Suggestions}.tsx
apps/golden-1/test/{api,board,components,routes}.test.ts  and  test/simApi.ts
```

## Tests (`@keel/testing` only; ids only)
- `test/simApi.ts` serves the real api (`createApp(...).fetch` over `api.board`, sim ctx) behind sim `ctx.net` `/api/*`, recording requests, so client tests see real bodies.
- `api.test.ts`: `properties()` on the four `api` transactions; the invariant; every endpoint through `createApp().fetch` (runtime JSON), including 404, 422, undo.
- `board.test.ts`: `properties(hydrate)`. `components.test.ts`: `properties()` for `TodoRow` and `Suggestions`; Suggestions loading to ready and to error on a sim 500; Undo disabled/enabled.
- `routes.test.ts`: the former examples (filter, notFound, readOnly, invalid add focuses title, duplicate title error) plus a `renderRoute` refresh test: create a list, then a second `renderRoute` with an empty `todos.view` (new client, same api) still shows it.

## Acceptance (checked by `pass.ts`)
1. Every file above exists.
2. `pnpm check` clean, budgets included.
3. `pnpm test --filter golden-1` green.
4. `properties(` covers `addList addTodo toggleTodo editTodo hydrate TodoRow Suggestions`; `invariant(` in `api/board.ts`.
5. Ledger scope `golden-1:`: every item at rung example or better; `pnpm ledger --diff --scope golden-1:` clean.
6. `unsafe(` count 0; no `any`, casts, `!`, `@ts-ignore`.
7. `pnpm --filter golden-1 build` green.
8. Quiet output within `tooling/budgets.json`.

Manual proof, not graded: `tooling/smoke/persist.mjs` (create list, reload, add todo, toggle, undo, reload).

# Golden app 1 (client-only)

Build `apps/golden-1/`: a todo app, client-only (`topology.ts`: one deployable, `adapter: 'client'`; the compiler generates the `mount` entry). Use only kernel APIs from the spec slice; read a full section with `pnpm spec <id>` (k.schema k.errors k.reactive k.store k.ctx k.component k.runtime k.router k.forms k.ui k.testing k.module k.server k.scaffold k.check). Edit nothing outside `apps/golden-1/`. Prefer `keel scaffold`/`keel codemod` for structure. If the slice leaves an API you need unspecified, stop and report `blocked: <section> <question>`; do not invent one.

## Behavior
- `/` (`todos.index`): every list with its open-todo count; a Form adding a list.
- `/lists/:listId` (`todos.list`, search `filter`: `all|active|done`, optional): the list's todos filtered by `filter`, filter links, a Checkbox per todo toggling done, a Form adding a todo, and `Suggestions`.
- `/lists/:listId/todos/:todoId/edit` (`todos.edit`): a Form editing a todo; success navigates to `todos.list`. Guard `editable` is a stub: denies when `ctx.storage` key `todos.readOnly` is `"1"`, redirecting to `todos.index`.
- Unknown `listId` or `todoId`: the loader returns `err` `keel.notFound`; `ListError` renders.
- Layout `todos.shell` (`AppShell`): a `main`, a home Link, and an Undo Button that undoes the last transaction from the store log; disabled when the log is empty.
- `Suggestions`: a `resource` whose fetcher closes over the component's third parameter `ctx` and calls `ctx.net.fetch` for `GET /api/suggestions` directly (E1651 is not enforced until k.services is implemented), rendered with `Match` on `loading`, `error` (message text), `ready` (titles).

## Model
- Store `todos.board` in `board.ts`: `Board { lists: TodoList[], todos: Todo[] }`, initially empty. `invariant` beside it: ids unique, every `todo.listId` names a list.
- Transactions `todos.addList`, `todos.addTodo`, `todos.toggleTodo`, `todos.editTodo`: pure; new ids arrive in the payload (actions mint them with `ctx.random.uuid()` and call `tx`; actions are exempt from E1301). A component calling `tx` exports `uses = [...]` beside `Props` (`TodoRow`: `toggleTodo`). Each keeps the invariant for every generated payload: an unknown or duplicate id returns the state unchanged.
- Form schemas: `ListDraft { name: string 1-60 }`, `TodoDraft { title: string 1-120, priority: low|normal|high }`. POST actions `createList`, `createTodo`, `updateTodo`; `updateTodo` returns `keel.fields` `{ title }` when the title duplicates another todo in the list.
- UI: base elements only, style props from tokens, a11y-required props, explicit ids on every element a test touches.

## Files (exactly these)
```
apps/golden-1/package.json   name "golden-1"; scripts check/test/build: keel check|test|build
apps/golden-1/tsconfig.json  extends ../../tsconfig.base.json
apps/golden-1/{vite.config.ts,tokens.ts,topology.ts}   tokens: fg/bg/accent/danger with light and dark
apps/golden-1/modules/todos/{module.ts,routes.ts,editable.guard.ts}
apps/golden-1/modules/todos/{TodoList,Todo,Board,ListDraft,TodoDraft,Suggestion}.schema.ts
apps/golden-1/modules/todos/{board,addList,addTodo,toggleTodo,editTodo}.ts
apps/golden-1/modules/todos/{loadList,loadTodo,createList,createTodo,updateTodo}.server.ts
apps/golden-1/modules/todos/{AppShell,ListsPage,ListPage,TodoRow,EditTodoPage,ListError,Suggestions}.tsx
apps/golden-1/test/{board,routes,components}.test.ts
```

## Tests (`@keel/testing` only; ids only; sim ctx via `render(..., { ctx })`, net fixtures via `sim.net.route`)
- `properties()` at default runs for all four transactions and for `TodoRow` and `Suggestions`.
- Examples: undo restores the prior state; `filter=done` shows only done todos; unknown `listId` renders `ListError`; readOnly redirects to `todos.index`; invalid add-todo sends nothing and focuses the title; duplicate title shows the `keel.fields` error; `Suggestions` goes loading to ready, and to error on a sim 500.

## Acceptance (checked by `pass.ts`)
1. Every file above exists.
2. `pnpm check` clean, budgets included.
3. `pnpm test --filter golden-1` green.
4. `properties(` covers each transaction, `TodoRow`, `Suggestions`; `invariant(` in `board.ts`.
5. Ledger: every export under `modules/` (except `module.ts`, `routes.ts`, `Props`, `uses`) is named in a test (rung `example` or better); `node tooling/ledger.mjs --diff` clean.
6. `unsafe(` count 0; no `any`, casts, `!`, `@ts-ignore`.
7. Quiet `check` and `test` output within `tooling/budgets.json` output budgets; never `--verbose`.

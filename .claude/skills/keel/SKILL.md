---
name: keel
description: "Build a Keel app: schemas, stores, components, routes, forms, tests; use when writing app code in apps/ or modules/"
---

# Building a Keel app

**Spec:** never guess; `pnpm spec <id>` (k.schema, k.router, k.server, ...). Unspecified API: stop, report `blocked: <what is missing>`.

**Files** (one export each, name = export):
- `*.schema.ts`: `s.object(...)`; `type T = s.infer<typeof T>`; validate with `T.parse(x)` (no `decode`).
- Store file: `store(...)`, pure `transaction(...)`, `invariant(store, fn)` beside it; ids prefixed by module (`todos.board`).
- `Foo.tsx`: default `(props, slots?, ctx?)`, `export const Props = s.object(...)`, `export const uses = [tx]` if it calls `tx`; never destructure props. `<If when>`, `<For each key="id">`, `<Match on>`, never `&&`. Layout: `{props.children?.()}`.
- `*.server.ts`: `loader({ output, params?, search?, stores? }, fn)`, `action({ input, params?, stores? }, fn)`; schemas are the route's own; never annotate `fn`.
- `*.guard.ts`: `export const auth = guard({ redirect: 'app.login' }, fn)`; route holds the value (`guard: auth`).
- `routes.ts`: `export const routes = manifest({...})`, then `routes.actions({ 'todos.list': { POST: createTodo } })` (never `actions` in an entry: E1505). Links only via `routes.href(id, params?, search?)` (own module's). `<Form action={routes.href('todos.list', { listId })}>`; pending: `f.pending()`. Action redirect: `return ok(routes.href(...))`.
- Route `title`: `title: (p) => p.data.text.showTitle`, a message from the route's loader data (a path route only; a layout has none).
- Values on screen: `formatMoney`, `formatDate`, `formatDuration` or `formatNumber` with the route's `props.params.locale`; never `toLocaleString`.
- Page text: a message set loaded by the route's loader (`await Set.load(params.locale)`), read as `props.data.text.<key>`.
- `tokens.ts`: `defineTokens`; style props take token names only (no `class`, no `styles()`). `<Button id="x.save">Save</Button>` (text is children).
- `topology.ts`: `topology({ web: { modules, adapter: 'client' } })` (`host: '<node deployable>'` makes that server serve the client; `keel build` writes it to `dist/<name>/`); `module.ts`: `module({ id, deps, capabilities, public })`.

**Rules:** no throw/try (use `Result`, `attempt`); no `Date.now`, `Math.random`, `fetch`, `localStorage`, DOM (use `ctx`); ids from `ctx.random.id('Todo')`; no `any`, casts, `!`, `@ts-ignore`.

**Tests:** `render(C, { props, state, ctx })`, `await t.fire(id, { type: 'click' })`, `t.find(id)`; `await renderRoute(id, { routes, params, ctx })`; `properties(C | tx)`. Ids only, never the DOM; every export named in a test.

**Scaffold:** `keel scaffold project <name> --workspace`, then `pnpm install` at the root.

**Output:** fix by code (`keel explain <code>`); no `--verbose`.

**More:** skills keel-testing, keel-forms, keel-api (node api, `stores`, services).

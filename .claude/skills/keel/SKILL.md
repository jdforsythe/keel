---
name: keel
description: "Build a Keel app: schemas, stores, components, routes, guards, tokens, topology and modules; use when writing app code in apps/ or modules/"
---

# Building a Keel app

**Spec:** never guess; `pnpm spec <id>` (k.schema, k.router, k.server, ...). Unspecified API: stop, report `blocked: <what is missing>`.

**Files** (one export each, name = export):
- `*.schema.ts`: `s.object(...)`; `type T = s.infer<typeof T>`; validate with `T.parse(x)` (no `decode`).
- Store file: `store(...)`, pure `transaction(...)`, `invariant(store, fn)` beside it; ids prefixed by module (`todos.board`).
- `Foo.tsx`: default `(props, slots?, ctx?)`, `export const Props = s.object(...)`, `export const uses = [tx]` if it calls `tx`; never destructure props. `<If when>`, `<For each key="id">`, `<Match on>`, never `&&`. Layout: `{props.children?.()}`.
- `*.server.ts`: `loader({ output, params?, search?, stores? }, fn)`, `action({ input, params?, stores? }, fn)`; schemas are the route's own; never annotate `fn`.
- `*.guard.ts`: `export const auth = guard({ redirect: 'app.login' }, fn)`; route holds the value (`guard: auth`).
- `routes.ts`: `export const routes = manifest({...})`, then `routes.actions({ 'todos.list': { POST: createTodo } })` (never `actions` in an entry: E1505). Links only via `routes.href(id, params?, search?)` (own module's). Action redirect: `return ok(routes.href(...))`.
- `tokens.ts`: `defineTokens`; style props take token names only (no `class`, no `styles()`). `<Button id="x.save">Save</Button>` (text is children).
- `topology.ts`: `topology({ web: { modules, adapter: 'client' } })`; `module.ts`: `module({ id, deps, capabilities, public })`.

**Rules:** no throw/try (use `Result`, `attempt`); no `Date.now`, `Math.random`, `fetch`, `localStorage`, DOM (use `ctx`); ids from `ctx.random.id('Todo')`; no `any`, casts, `!`, `@ts-ignore`; never import a `@keel/*` entry with an `internal` path segment, tests included (E1576).

**Scaffold:** `keel scaffold project <name> --workspace`, then `pnpm install` at the root.

**Output:** fix by code (`keel explain <code>`); no `--verbose`.

**More skills:** keel-forms, keel-text (messages, formats, `title`), keel-testing, keel-correctness (`properties`, `explore`, `chart`), keel-compliance (`.pii`, policy), keel-api, keel-server (`stores`), keel-deploy, keel-realtime, keel-writes, keel-widgets.

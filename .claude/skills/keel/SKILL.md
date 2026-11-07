---
name: keel
description: "Build a Keel app: schemas, stores, components, routes, forms, tests; use when writing app code in apps/ or modules/"
---

# Building a Keel app

**Spec:** never guess an API. `pnpm spec <id>` prints a section (ids: k.schema k.errors k.reactive k.store k.ctx k.component k.runtime k.router k.forms k.ui k.testing k.module k.server k.check). If the API you need is not specified, stop and report `blocked: <what is missing>`.

**Files** (one export per file, filename = export name):
- `*.schema.ts`: schemas only (`s.object`, `s.error`); `type T = s.infer<typeof T>`.
- `*.store.ts`: `store(...)`, `transaction(...)` (pure), `invariant(...)`; ids prefixed by module id (`todos.board`).
- Component `Foo.tsx`: default export `(props, slots?, ctx?)`, plus `export const Props = s.object(...)` and `export const uses = [tx, ...]`. Props are getters; never destructure. Use `<If>`, `<For key>`, `<Match>`, not `&&`. Give controls explicit ids. Render layout children with `{props.children?.()}`.
- `*.server.ts`: `loader({ output, params?, search? }, fn)`, `action({ input, params? }, fn)` (route's own schemas, `fn` unannotated); `*.guard.ts`: `guard(...)`.
- `routes.ts`: `manifest({...})`; navigate with `href(id, params)` only.
- `tokens.ts`: `defineTokens({...})`; style props take token names, never raw values. UI from `@keel/ui`.
- `topology.ts`: `topology({ web: { modules: [...], adapter: 'client' } })`.
- `module.ts`: `module({ id, deps, capabilities, public })`.

**Rules:** no throw or try/catch (use `Result`, `attempt`); no `Date.now`, `Math.random`, bare `fetch`, `localStorage`, DOM APIs (use `ctx`); no `any`, casts, `@ts-ignore`.

**Tests:** `render(Comp, { props, state, ctx })`, `t.fire('todos.add', { type: 'click' })`, `t.find(id)`, `t.state(store)`; `await renderRoute(id, {...})`; `properties(Comp | transaction, { runs: 100 })`. `renderRoute` needs `routes` (the manifest) and `h.settle()` to flush. Resources fetch with `new Request(new URL('/api/x', location.href))`, never a relative URL. Never query the DOM. Every export is named in a test.

**Scaffold:** then `pnpm install` at the root (workspace: `keel scaffold project <name> --workspace`).

**Output:** `pnpm check`, `pnpm test` print compact output; read the trailer, fix by code (`keel explain <code>`), no `--verbose`.

**Domain skills:** keel-testing, keel-api (API-backed apps: service client, hydrate tx, `syncAfter`), keel-forms.

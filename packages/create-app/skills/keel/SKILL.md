---
name: keel
description: "Read first in a Keel app: app shape, one export per file, the rules, the commands, and which Keel skill to load next; E1104, E1108, E1013, E1015, E1005, E1065, E1155, E1401, E1403, E1407, E145x, E1501, E1515, E1601, W1608, E1301, E1751, E1752, E1757, E1760, E1761"
---

# Building a Keel app

**Reading path.** `keel docs` lists areas, `keel docs <area>` an area's sections, `keel docs <id>` one (`k.router`), `keel docs --for <code, name or term>` finds them; `keel explain <code>` its fix. A std section opens once its package is listed and installed (E1065). An API no section describes: stop, report `blocked: <what is missing>`. TS2688 or TS2875 in an E1751: kit types did not resolve; report `blocked: kit types`, never edit `node_modules`.

**Shape.** App code lives in modules, `modules/<id>/`. `pnpm create @keel/app <folder>` starts with module `app`, route `app.home` at `/`, to build on or delete. Each file has one export and is named after it (E1752); a component file may also export `Props` and `uses`.
- `module.ts`: `export default module({ id, deps, capabilities, public: { exports } })` (`@keel/compiler`). Route ids, store ids, transaction names and error codes start with the module id (E1155).
- `topology.ts`: `export default topology({ web: { modules: ['todos'], adapter: 'client' } })` (`@keel/server`).
- `*.schema.ts`: schemas live only here (E1104). `T.parse(x)` returns a `Result`; there is no `decode`. `s.array(item)` and `s.record(value)` take one argument.
- `Name.tsx`: default export `(props)` or `(props, ctx: Ctx)` (E1407); never destructure props (E1401). Use `If`, `For key`, `Match`/`Case`, never `&&` or `?:` around elements (E1403).
- `<id>.contract.ts`: `contract('<id>', { 'id.name': { path } | { method, path, output } })` (`@keel/router/contract`). `routes.ts`: `manifest(<id>, { 'id.name': { component } | { loader } | { action } })`, every entry bound (E1515). Link only with `<id>.href(id, params?, search?)` (E1501).
- Stores: `store(schema, initial, { id })`, read by key, `store.get('items')`, `transaction(store, 'mod.name', Payload, fn)`, written only by `tx(t, payload)`; `invariant(store, fn)` beside it; a component lists the transactions it calls in `uses` (E1301).
- `*.server.ts`: `loader(<id>, 'id.name', decl, fn)` and `action(...)`; `*.guard.ts`: `guard({ redirect }, fn)`.
- `tokens.ts`: `export const tokens = brandTokens` (`@keel/ui/brand`) styles every page on brand; style props only where a page differs (keel-client).

```tsx
import { For } from '@keel/runtime-dom'
import { type Infer, s } from '@keel/schema'
import { Box } from '@keel/ui'

export const Props = s.object({ items: s.array(s.object({ id: s.id('Todo'), title: s.string() })) })

export default function TodoList(props: Infer<typeof Props>) {
  return (
    <Box as="ul" id="todos.list" direction="column" gap="2">
      <For each={props.items} key="id">
        {(t) => <Box as="li">{t.title}</Box>}
      </For>
    </Box>
  )
}
```

**Rules.**
- Failures: `err(E.make(data))`, never `throw` (E1451); bugs `defect('text')`, values in `data` (E1455); catch: `attempt(fn, expect)` (E1452); JSON by `Prefs.parseJson` (E1457); never drop a `Result` (E1453).
- No `Date`, `Math.random`, `crypto.randomUUID`, `fetch`, `setTimeout` or `localStorage` (E1601): use `ctx.clock`, `ctx.random.id('Todo')`, `ctx.storage`, a `service` for HTTP (E1651). An `import()` is W1608, unseen by `simulate`: import statically.
- No `any`, casts, `!` or `@ts-ignore` outside `unsafe(reason, fn)` (E1757), whose reason, 8 words or more, says why the escape holds (E1760). A claim that a call must not compile is a negative type test: `test/<name>.test-d.ts`, each `// @ts-expect-error <what must not compile>` one claim, imported by nothing (E1761); no `@keel/*` import with an `internal` segment (E1576). Import a `modules/` file by a relative path (E1013); code outside the project is a workspace package, never a relative path out of it (E1015).
- A format value written in source is `formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` (`@keel/schema`), else E1108.

**Commands.** `keel check` · `keel test` · `keel build` · `keel dev` · `keel review origin/main..HEAD` · `keel scaffold project|module|route|component|store|service <name>` (`route app.about`: `/about`) · `keel codemod rename|move|place` over hand edits.

**Libraries.** A module lists one in `deps` by scoped name (`'@acme/charts'`); `keel check` checks it as the app's; to write one: keel-library.

**Skills.** An example's block holds several exports; in an app each is a file.
- keel-client: components, pages, forms, redirects, widgets, tables, text.
- keel-server: loaders, actions, server stores, guards, bearer, identity, API routes, services.
- keel-data: durable storage, concurrent and offline writes, conflicts, realtime, workflows.
- keel-testing: component and route tests, sim ctx, properties, invariants, rungs.
- keel-deploy: `keel build`, env, hosting, shells.
- keel-compliance: personal data, secrets, tokens, the content security policy, evidence.
- keel-escapes: reading `keel review`, each escape by danger and novelty.
- keel-library: a library other apps install.
- keel-errors: failures, `expect`, retry, rollback, an SDK.

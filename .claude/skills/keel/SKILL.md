---
name: keel
description: "Read first in a Keel app: app shape, one export per file, the rules, the commands, and which Keel skill to load next; E1104, E1155, E1401, E1403, E145x, E1505, E1601, E1301, E1752, E1757"
---

# Building a Keel app

**Reading path.** `keel docs <id>` prints one spec section (`keel docs k.router`); `keel docs --for <code>` the section that owns a code; `keel explain <code>` the meaning and fix. An API no section describes: stop and report `blocked: <what is missing>`.

**Shape.** App code lives in modules, `modules/<id>/`. Each file has one export and is named after it (E1752); a component file may also export `Props` and `uses`.
- `module.ts`: `export default module({ id, deps, capabilities, public })` (`@keel/compiler`). Route ids, store ids, transaction names and error codes start with the module id (E1155). See `keel docs k.module`.
- `topology.ts`: `export default topology({ web: { modules: ['todos'], adapter: 'client' } })` (`@keel/server`). See `k.topology`.
- `*.schema.ts`: schemas live only here (E1104). `T.parse(x)` returns a `Result`; there is no `decode`. See `k.schema`.
- `Name.tsx`: default export `(props, slots, ctx?)`; never destructure props (E1401). Use `If`, `For key`, `Match`/`Case`, never `&&` or `?:` around elements (E1403). See `k.component`.
- `routes.ts`: `export const routes = manifest({...})`, then `routes.actions({...})`, never `actions` in an entry (E1505). Link only with `routes.href(id, params?, search?)` (E1501). See `k.router`.
- Stores: `store(schema, initial, { id })`, `transaction(store, 'mod.name', Payload, fn)`, written only by `tx(t, payload)`; `invariant(store, fn)` beside it; a component lists the transactions it calls in `uses` (E1301). See `k.store`.
- `*.server.ts`: `loader` and `action`; `*.guard.ts`: `guard({ redirect }, fn)`. See `k.server`, `k.guards`.

```tsx
import { For } from '@keel/runtime-dom'
import { type Infer, s } from '@keel/schema'
import { Box } from '@keel/ui'

export const Props = s.object({ items: s.array(s.object({ id: s.id('Todo'), title: s.string() })) })

export default function TodoList(props: Infer<typeof Props>) {
  return (
    <Box as="ul" id="todos.list" gap="2">
      <For each={props.items} key="id">
        {(t) => <Box as="li">{t.title}</Box>}
      </For>
    </Box>
  )
}
```

**Rules.**
- Failures are values: return `err(...)`, never `throw` (E1451); wrap throwing code in `attempt`, never `try` (E1452); never drop a `Result` (E1453).
- No `Date`, `Math.random`, `fetch`, `setTimeout` or `localStorage` (E1601): use `ctx.clock`, `ctx.random.id('Todo')`, `ctx.net`, `ctx.storage`.
- No `any`, casts, `!` or `@ts-ignore` (E1757). Never import a `@keel/*` path with an `internal` segment (E1576).

**Commands.** `keel check` · `keel test` · `keel build` · `keel dev` · `keel scaffold project|module|route|component|store <name>` · `keel codemod rename|move|place`: prefer scaffold and codemods to hand edits.

**Skills.** Their examples put several exports in one block; in an app each is its own file.
- keel-client: components, pages, forms, action redirects (`ok(href)`), widgets, tables, text.
- keel-server: loader and action signatures, server stores, guards, bearer, identity, API routes, services.
- keel-data: durable storage, concurrent and offline writes, conflicts, realtime, workflows.
- keel-testing: component and route tests, sim ctx, properties, invariants, rungs.
- keel-deploy: `keel build`, env, hosting, shells.
- keel-compliance: personal data marks, secrets, tokens, the content security policy, evidence.

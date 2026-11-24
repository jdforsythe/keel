# k.scaffold: Scaffold and codemods
status: implemented

**Operations.** Every structural edit is one operation. It computes a complete edit set from the project's artifacts (`.keel/ids.json`, `routes.json`, `deps.json`, module manifests), never from text search, and applies it atomically: all files or none. The same operations are MCP tools (k.cli). `--dry-run` prints the edit set as unified diffs and writes nothing. An edit set is `{ files, created, changed, removed }`: the tree after the operation and the sorted paths it creates, changes, deletes; a dry run returns the same.
```sh
keel scaffold project shop
keel scaffold module orders
keel scaffold route orders.show --path /orders/:id
keel scaffold route orders.about --path /about --no-loader
keel scaffold component orders/OrderCard
keel scaffold store orders.cart
keel scaffold transaction orders.cart.addItem
keel scaffold service orders --openapi openapi.json
keel scaffold service geo --base https://geo.example.com --reason 'place lookup'
keel scaffold shell tauri --id com.acme.shop
keel codemod rename OrderCard OrderTile
keel codemod move OrderCard --to catalog
keel codemod add-field Order note 'string.optional'
keel codemod place digest --to jobs --adapter node
```

**Generators.** Each emits spec-conformant files only:
- `project`: `package.json`, `.gitignore`, `tokens.ts`, `topology.ts` (`--adapter client|node|static`, default `client`), `vite.config.ts`, module `app`, generated turbo, CI and deploy files (k.deploy), agent files (k.explain); `--workspace` (an app inside the Keel monorepo) adds `vitest.config.ts` instead of turbo, CI, agent files. No `index.html`; the deployable has `styles: ['@keel/ui/fonts']`. `keel scaffold project <name>` writes under `<name>/`.
- `module`: `modules/<id>/module.ts`, `<id>.contract.ts` and `routes.ts`; adds the module to `topology.ts`.
- `route`: contract entry and binding (k.contract), `*.server.ts` loader, page component, route test; with `--no-loader` no loader file, and a binding of `component` alone; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path, file?, api?, method?, 'no-loader'? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; `method` without `api`, or `no-loader` with `api`, is E1052.
- `component`: `<Name>.tsx` with a `Props` schema and a property test (k.testing).
- `store` / `transaction`: `*.schema.ts`, store or transaction file, invariant test.
- `service`: a client of an API no app module serves (k.services): `modules/<id>/<Id>Api.schema.ts` and `api.server.ts`, with `@keel/services` in `package.json` (Service).
- `shell`: a native shell on a `client` deployable, `shells` in `topology.ts` and the shell's packages in `package.json` (k.scaffold-shell).

**Codemods.**
- `rename` (component, route, store, transaction, schema, field, module) updates the declaration, file name, every import, `href()` call (free or a contract's), `uses:` list, element-id prefix, test, contract entry and binding.
- `move` relocates a file to another module, updating imports and manifests: a module gains each `deps` entry the move makes it need (k.module E1152) and loses each entry the move leaves unused (E1165).
- `place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes.
- `add-field` adds a field to a schema and to every initial state, fixture, and form `initial` that constructs it. Optional fields need no data; required fields take `--default`.

**Service.** `keel scaffold service <module>` takes `--openapi <file>` or `--base <url>`, one of them. Input `{ id, base?, schema?, service?, reason? }`: `base` alone, or `schema` and `service` together (the two sources of k.openapi, whose `base` literal is the URL); anything else is E1052.
- `--openapi`: both files as k.openapi generates them, read-only.
- `--base`: an absolute `http` or `https` URL with no query, fragment or credentials (else E1052). `<Id>Api.schema.ts` exports `<Id>Api = endpoints({})` and `api.server.ts` exports `api = service({ base: '<url>', schema: <Id>Api })`; both are the author's to edit.

Both forms add `@keel/services` to `dependencies` at the version of `@keel/server` when it is absent. Where the module's deployable is `client`, `api.server.ts` ships (k.boundary), so the operation declares the URL's origin as well: `origins.connect` of that deployable in `topology.ts` gains `'<origin>': '<reason>'` (k.origins), `reason` from `--reason <text>`, and without one it is E1358. An origin that deployable already declares needs no `reason`, and `topology.ts` is not changed. A `reason` with nothing to declare (the module's deployable is not `client`, or the origin is declared) is E1052. An origin or reason k.origins refuses, or a 17th `connect` origin, is E1353 naming E1590.

**Turbo emission.** Any operation adding or removing a module or package regenerates `turbo.json`, CI workflows and deploy files (k.deploy) from the task graph and topology (ADR-0009). Generated files are read-only (E1005).

**Guarantee.** If `keel check` was clean before an operation, it is clean after; for `shell`, once its packages are installed and `keel build` ran (k.scaffold-shell). Otherwise nothing is written and E1353 reports the first diagnostic the edit set would introduce.

**Refresh.** In a project holding a `.keel/` artifact `keel build` writes, an applied operation then refreshes what `keel check` reads: after `keel build`'s check, it writes the `.keel/` artifacts and generated deploy files `keel build` writes, from the new tree. It builds no bundle and writes nothing under `dist/`. It prints nothing while it runs and no W1005 for an artifact it rewrites; a diagnostic of the refresh follows the edit lines and the edits stay written. The one trailer adds `artifacts`, the files the refresh wrote: `ok scaffold route 2 created, 2 changed, 0 removed, 7 artifacts, 0 errors`. `--dry-run`, a project with no such artifact, and `shell`, refresh nothing.

**Rules.** E1351 target id already exists (fix: use a codemod) · E1352 id violates naming: route, store and transaction ids are dotted lowerCamel, prefixed by the module id; components PascalCase; deployable names as k.topology E1552 · E1353 operation aborted, would break check; nothing written · E1354 `add-field` of a required field without `--default` while constructors exist · E1355 Keel block not one start and one end line · W1356 agent file stale or block malformed (`keel docs --sync`) · E1357 write through a symlink out of the project · E1358 `service` in a module of a `client` deployable whose origin that deployable does not declare under `connect`, with no `reason`; names the deployable and the origin (no fix: pass `--reason`, or `codemod place` the module on a `node` deployable) · E1359 `shell` with no one `client` deployable to take it (k.scaffold-shell). A failing input schema, unknown target, or missing `topology.ts` reports k.cli E1052; an unknown operation E1051.

**Conformance.**
- Each generator run in a fresh project leaves `keel check` and `keel test` clean.
- `rename A B` then `rename B A` restores a byte-identical tree.
- After `rename`, no import, `href()` call, `uses:` entry or element id names the old name.
- `--dry-run` writes nothing and prints the diff a following apply writes.
- An operation whose edit set would introduce a diagnostic writes no file and reports E1353.
- Running a generator twice reports E1351 the second time, writing nothing.
- After `scaffold module`, `turbo.json` equals the generator's output for the new graph.
- `keel scaffold project <name>`, with or without `--workspace`, writes only under `<name>/`.
- `place b --to y --adapter node` then `place b --to x` restores a byte-identical tree; neither writes outside `topology.ts`, `deploy/`, CI workflows.
- With `node` deployables `api` and `my-api`, `deploy/compose.yaml` sets `KEEL_PEER_MY_API` for `api`; `place b --to apiEdge --adapter node` is E1352 and writes nothing.
- `scaffold route` with `method` and no `api` is E1052 and writes nothing; with `api` and `method: 'POST'` it adds an API write entry, its binding and its handler.
- `scaffold project` writes a <= 600-token block naming `keel docs`, `keel explain`, skill paths, without `pnpm spec`, `spec/` or `--workspace`; `CLAUDE.md` `@AGENTS.md\n`; copies equal to `keel docs <name>`; with `--workspace`, none.
- `--sync` restores an edited block and copy, keeps text outside the block, reruns as no-op; creates absent files; keeps a `CLAUDE.md`, linked or not.
- `keel check`: fresh, no W1356; an edited or removed copy or edited block, one W1356 there; no block, none. Unclosed block: `--sync` E1355, exit 1, writes nothing.
- `keel scaffold project p` and `keel scaffold project p --workspace` write no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`.
- Each project below holds module `orders`. In a `--adapter node` project, `service { id: 'orders', base: 'https://api.example.com' }` creates exactly `modules/orders/OrdersApi.schema.ts` (one export, `OrdersApi = endpoints({})`) and `modules/orders/api.server.ts` (one export, `api = service({ base: 'https://api.example.com', schema: OrdersApi })`), neither with a generated first line; it changes `package.json` alone, which gains `@keel/services` at the version of `@keel/server`; `keel check` and `keel test` are clean.
- In the default project that input with `reason: 'order list'` also changes `topology.ts`: `web` has `origins: { connect: { 'https://api.example.com': 'order list' } }` and its other properties as before, and `keel check` is clean; with `base: 'https://api.example.com/v2'` the key is still `https://api.example.com`.
- In the default project, with no `reason`, that input and the `{ id, schema, service }` form are each E1358 naming `web` and `https://api.example.com`, nothing written; with `connect` already declaring that origin, each applies without a `reason` and leaves `topology.ts` byte-identical, and with one is E1052.
- E1052, nothing written: a `reason` in the `node` project; `base` with `schema` and `service`; none of the three; a `base` of `ftp://a.example`, `/v1`, `https://a.example/?q=1` or `https://u:p@a.example`.
- In the default project, each is E1353 naming E1590, nothing written: `base: 'http://api.example.com'` with a `reason`; a `reason` of 201 characters; an origin that would be the 17th under `connect`. In the `node` project `base: 'http://internal:8080'` applies.
- `route { id: 'orders.about', path: '/about', 'no-loader': true }` creates the page component and the route test alone, adds the contract entry, and binds `'orders.about'` to `{ component }`: no `*.server.ts` file is created and `routes.ts` gains no loader import; `keel check` and `keel test` are clean in the default and the `node` project. With `api: true` it is E1052, nothing written.
- In a project where `keel build` ran and `keel check` is clean, each generator applied by `keel scaffold` leaves `keel check` clean with no E1005, every file under `dist/` byte-identical, no W1005 in its output and a trailer whose `artifacts` is above 0; `keel scaffold service orders --base https://api.example.com --reason r` in the default project is one of them. With `--dry-run`, and in a project `keel build` never ran in, no file under `.keel/` is written and the trailer has no `artifacts`.
- `move F --to c`, `F` the only file of `a` importing from `b`, removes `b` from `a`'s `deps` and adds it to `c`'s; a module `d` whose one import from `a` was `F` gains `c` and loses `a`; `keel check`, clean before, is clean after, with no E1165.

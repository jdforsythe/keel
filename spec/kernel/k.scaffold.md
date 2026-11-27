# k.scaffold: Scaffold and codemods
status: conformance-covered
**Operations.** Every structural edit is one operation. It computes a complete edit set from the project's artifacts (`.keel/ids.json`, `routes.json`, `deps.json`, manifests), never from text search, and applies it atomically: all files or none. The same operations are MCP tools (k.cli). `--dry-run` prints the edit set as unified diffs and writes nothing. An edit set is `{ files, created, changed, removed }`: the tree after the operation and the sorted paths it creates, changes, deletes; a dry run returns the same.
```sh
keel scaffold project shop
keel scaffold module orders
keel scaffold route orders.show --path /orders/:id
keel scaffold route orders.about --path /about --no-loader
keel scaffold component orders/OrderCard
keel scaffold store orders.cart
keel scaffold transaction orders.cart.addItem
keel scaffold service orders --openapi openapi.json --name gitHub
keel scaffold service geo --base https://geo.example.com --reason 'place lookup'
keel scaffold shell tauri --id com.acme.shop
keel codemod rename OrderCard OrderTile
keel codemod move OrderCard --to catalog
keel codemod add-field Order note 'string.optional'
keel codemod place digest --to jobs --adapter node
```

**Generators.** Each emits conformant files:
- `project`: `package.json`, `.gitignore`, `tokens.ts`, `topology.ts` (`--adapter client|node|static`, default `client`), `vite.config.ts`, module `app`, generated turbo, CI and deploy files (k.deploy), the route `app.home` at `/` with its page and test, and agent files (k.explain), as k.create Files lists for each adapter; each `@keel/*` entry at exactly the running tool's version, the Versions rule of k.create and the rules of k.create-manager; `--workspace` adds `vitest.config.ts` and a first test, `test/app.test.ts` (the module's routes name `app` and hold none), instead of turbo, CI, agent files. No `index.html`; the deployable has `styles: ['@keel/ui/fonts']`. `keel scaffold project <name>` writes under `<name>/`.
- `module`: `modules/<id>/module.ts`, `<id>.contract.ts` and `routes.ts`; adds the module to `topology.ts`.
- `route`: contract entry and binding (k.contract), page component, route test (one without `app` passes `identity.ts`'s default export as `mount` when the project has it, k.testing), and a `*.server.ts` loader when a `node` deployable lists the module or `--loader` asks for one (in a module only `client` deployables list it runs in the browser, k.boundary, and the run prints the `scaffold.note` `note <file> the loader runs in the browser and its file ships in the client bundle`, json `{ kind, path, note }`, `note` the sentence after the file); with `--no-loader`, or by default elsewhere, no loader file and a binding of `component` alone. Without `--path` the path is `/` and the id's segments after the module, each in kebab case, joined by `/` (`app.about` `/about`, `orders.orderHistory` `/order-history`, `orders.list.recent` `/list/recent`), never a param; an id the contract already holds is E1351 naming that id, not `--path`; a derived path another route holds is E1351 naming that route, fix `--path <path>`; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path?, file?, api?, method?, loader?, 'no-loader'? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; `method` without `api`, `loader` or `no-loader` with `api`, or both, is E1052.
- `component`: `<Name>.tsx` with a `Props` schema and a property test (k.testing).
- `store` / `transaction`: `*.schema.ts`, store or transaction file, invariant test.
- `service`: a client of an API no app module serves (k.services): `modules/<id>/<Name>Api.schema.ts` and `api.server.ts`, with `@keel/services` in `package.json` (k.scaffold-service).
- `shell`: a native shell on a `client` deployable, `shells` in `topology.ts` and the shell's packages in `package.json` (k.scaffold-shell).
- `library`: a library package under `<base>/` (k.library-pack Scaffold).

**Codemods.**
- `rename` (component, route, store, transaction, schema, field, module) updates the declaration, file name, every import, `href()` call (free or a contract's), `uses:` list, element-id prefix, test, contract entry and binding.
- `move` relocates a file to another module, updating imports and manifests: a module gains each `deps` entry the move makes it need (k.module E1152) and loses each entry the move leaves unused (E1165).
- `place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes.
- `add-field` adds a field to a schema and to every initial state, fixture, and form `initial` that constructs it. Optional fields need no data; required fields take `--default`.

**Turbo emission.** Any operation adding or removing a module or package regenerates `turbo.json`, CI workflows and deploy files (k.deploy) from the task graph and topology. Generated files are read-only (E1005).

**Guarantee.** If `keel check` was clean before an operation, it is clean after; for `shell`, once its packages are installed and `keel build` ran (k.scaffold-shell). Otherwise nothing is written and E1353 reports the first diagnostic the edit set would introduce.

**Refresh.** In a project holding a `.keel/` artifact `keel build` writes, an applied operation then refreshes what `keel check` reads: after `keel build`'s check, it writes those artifacts and the generated deploy files from the new tree. It builds no bundle and writes nothing under `dist/`. It prints nothing while it runs and no W1005 for an artifact it rewrites; a diagnostic of the refresh follows the edit lines and the edits stay written. The one trailer adds `artifacts`, the files the refresh wrote (`7 artifacts`). `--dry-run`, a project with no such artifact, and `shell`, refresh nothing.

**Links.** Before its first write, an operation's edit set (E1357; `keel docs --sync` too, k.docs) is judged against the real path of the project root, and a shell's files (E1585, k.shell Files) against that real path joined with `deploy/<name>/<shell>/`, so a link among those folders refuses them. A target refuses the whole set when it is a symbolic link, an existing file with more than one hard link, wherever its other names are, or a path whose nearest existing ancestor's real path, joined with the rest of the path, is outside the root; an ancestor that cannot be read, a dangling link among them, counts as outside. Paths are compared by segment, so `proj-evil` beside `proj` is outside it; a link that resolves back inside is followed. The judgement is made once: a link made between it and the write is followed.

**Rules.** E1351 target id already exists (fix: use a codemod) · E1352 id violates naming: route, store and transaction ids are dotted lowerCamel, prefixed by the module id; components PascalCase; a service `name` lowerCamel; deployable names as k.topology E1552 · E1353 operation aborted, would break check; nothing written · E1354 `add-field` of a required field without `--default` while constructors exist · E1355 Keel block not one start and one end line · W1356 agent file stale or block malformed (`keel docs --sync`) · E1357 a write a link carries out of the project (Links) · E1358 `service` with an origin to declare and no `reason` (k.scaffold-service) · E1359 `shell` with no one `client` deployable to take it (k.scaffold-shell). A failing input schema, unknown target, or missing `topology.ts` reports k.cli E1052; an unknown operation E1051. A generator's E1052 for a missing input names a line formed from the project: the first module in sorted order (`app` without one; `keel scaffold route app.about` in a fresh app), for `transaction` that module's first store (`cart` without one), for `service` `--base https://a.test`, with `--reason geo` where E1358 asks for one; run as written, it succeeds.

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
- `keel scaffold project p` writes `modules/app/HomePage.tsx` and `modules/app/home.route.test.ts`, and `keel test` in `p` after its install passes that one test.
- `keel scaffold project p` and `keel scaffold project p --workspace` write no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`.
- In the default project `route { id: 'app.about' }` binds `/about`, writes no `*.server.ts` and leaves `keel check` and `keel test` clean; with `loader: true` it writes `modules/app/loadAbout.server.ts`; in the `node` project `{ id: 'app.about' }` writes it; `{ id: 'app.start' }` beside a route at `/start` is E1351 holding `--path`; `loader` with `no-loader` is E1052.
- `route { id: 'orders.about', path: '/about', 'no-loader': true }` creates the page component and the route test alone, adds the contract entry, and binds `'orders.about'` to `{ component }`: no `*.server.ts` file is created and `routes.ts` gains no loader import; `keel check` and `keel test` are clean in the default and the `node` project. With `api: true` it is E1052, nothing written.
- In a project where `keel build` ran and `keel check` is clean, each generator applied by `keel scaffold` leaves `keel check` clean with no E1005, every file under `dist/` byte-identical, no W1005 in its output and a trailer whose `artifacts` is above 0; `keel scaffold service orders --base https://api.example.com --reason r` in the default project is one of them. With `--dry-run`, and in a project `keel build` never ran in, no file under `.keel/` is written and the trailer has no `artifacts`.
- `move F --to c`, `F` the only file of `a` importing from `b`, removes `b` from `a`'s `deps` and adds it to `c`'s; a module `d` whose one import from `a` was `F` gains `c` and loses `a`; `keel check`, clean before, is clean after, with no E1165.
- With `identity.ts` beside `topology.ts` and `orders` on a `client` deployable, `route { id: 'orders.about', path: '/about' }` writes a route test that imports `identity.ts`'s default export as `mount` and passes it to `renderRoute`; `keel check` reports no E1730 and `keel test` passes it. In the default project it holds no `mount`.
- `keel docs --sync` in a project whose `AGENTS.md` is a hard link to a file outside it, and in one whose `.claude` is a symbolic link to a folder `proj-evil/.claude` beside the project `proj`, each reports exactly one E1357 and writes nothing; with `.claude` a symbolic link to a folder inside the project, it writes through it.
- `route --loader` where only `client` deployables list the module prints the `note` line and its `scaffold.note` record; on `node`, neither.
- A generator's E1052 line, run as written, succeeds.

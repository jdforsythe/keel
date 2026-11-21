# k.scaffold: Scaffold and codemods
status: implemented

**Operations.** Every structural edit is one operation. It computes a complete edit set from the project's artifacts (`.keel/ids.json`, `routes.json`, `deps.json`, module manifests), never from text search, and applies it atomically: all files or none. The same operations are MCP tools (k.cli). `--dry-run` prints the edit set as unified diffs and writes nothing. An edit set is `{ files, created, changed, removed }`: the tree after the operation and the sorted paths it creates, changes, deletes; a dry run returns the same.
```sh
keel scaffold project shop
keel scaffold module orders
keel scaffold route orders.show --path /orders/:id
keel scaffold component orders/OrderCard
keel scaffold store orders.cart
keel scaffold transaction orders.cart.addItem
keel scaffold service orders --openapi openapi.json
keel codemod rename OrderCard OrderTile
keel codemod move OrderCard --to catalog
keel codemod add-field Order note 'string.optional'
keel codemod place digest --to jobs --adapter node
```

**Generators.** Each emits spec-conformant files only:
- `project`: `package.json`, `.gitignore`, `tokens.ts`, `topology.ts` (`--adapter client|node|static`, default `client`), `vite.config.ts`, module `app`, generated turbo, CI and deploy files (k.deploy), agent files (k.explain); `--workspace` (an app inside the Keel monorepo) adds `index.html` and `vitest.config.ts` instead of turbo, CI, agent files. `keel scaffold project <name>` writes under `<name>/`.
- `module`: `modules/<id>/module.ts`, `<id>.contract.ts` and `routes.ts`; adds the module to `topology.ts`.
- `route`: contract entry and binding (k.contract), `*.server.ts` loader, page component, route test; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path, file?, api?, method? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`, and without `api` it is E1052.
- `component`: `<Name>.tsx` with a `Props` schema and a property test (k.testing).
- `store` / `transaction`: `*.schema.ts`, store or transaction file, invariant test.
- `service`: endpoint schemas from OpenAPI and the service file (k.openapi): `modules/<id>/<Id>Api.schema.ts` and `api.server.ts`; schemas are generated, read-only.

**Codemods.**
- `rename` (component, route, store, transaction, schema, field, module) updates the declaration, file name, every import, `href()` call (free or a contract's), `uses:` list, element-id prefix, test, contract entry and binding.
- `move` relocates a file to another module, updating imports and both manifests.
- `place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes.
- `add-field` adds a field to a schema and to every initial state, fixture, and form `initial` that constructs it. Optional fields need no data; required fields take `--default`.

**Turbo emission.** Any operation adding or removing a module or package regenerates `turbo.json`, CI workflows and deploy files (k.deploy) from the task graph and topology (ADR-0009). Generated files are read-only (E1005).

**Guarantee.** If `keel check` was clean before an operation, it is clean after. Otherwise nothing is written and E1353 reports the first diagnostic the edit set would introduce.

**Rules.** E1351 target id already exists (fix: use a codemod) · E1352 id violates naming: route, store and transaction ids are dotted lowerCamel, prefixed by the module id; components PascalCase; deployable names as k.topology E1552 · E1353 operation aborted, would break check; nothing written · E1354 `add-field` of a required field without `--default` while constructors exist · E1355 Keel block not one start and one end line · W1356 agent file stale or block malformed (`keel docs --sync`) · E1357 write through a symlink out of the project. A failing input schema, unknown target, or missing `topology.ts` reports k.cli E1052; an unknown operation E1051.

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

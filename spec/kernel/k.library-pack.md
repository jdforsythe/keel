# k.library-pack: Library publishing
status: proposed

**Package.** A library (k.library) publishes, as its `package.json` `files`: `module.ts`, `src/`, `unsafe/` when it has one, `dist/` (its `tsc` build, which Node imports), `.keel/ledger.json` and its `README.md`. Each `exports` key maps `keel` to the source file, then `types` and `default` to the built files; `publishConfig.exports`, where a package has one, keeps `keel` at the source path. The `@keel/*` packages it imports are `peerDependencies`. Its root `tokens.ts` is not published: an app checks the library against its own.

**Own folder.** In a folder whose `package.json` has `"keel": "library"`, `keel check`, `keel test` and `keel ledger` read the root `module.ts` as the manifest of the folder's one module, `src/` and `unsafe/` as that module's code, `test/` and co-located tests as its tests, and the root `tokens.ts` as its tokens. Every k.library rule holds there; E1162 does not, since the folder is no app's install.

**Pack.** `keel pack`, run in a library's folder, runs `keel check`, then `keel test`, then `keel ledger --write .keel/ledger.json`. It stops at the first step that fails, reports one E1164 whose message names the step (`check`, `test` or `ledger`), and writes no file. On success it prints one summary record (`docs/OUTPUT.md`) whose `counts` are `{ unsafe, hostElements, exports }` of the ledger it wrote. `keel pack --check` runs the same steps and writes nothing; it is E1164 naming `ledger` when `.keel/ledger.json` is missing or its `unsafe`, `hostElements` or `exports` differ from the ones `keel ledger --write` would write. Run outside a library's folder, either is one E1164 naming `kind`. A tarball is made by the package manager, whose `prepack` runs `keel pack --check`.

**Scaffold.** `keel scaffold library <name>`, `<name>` a scoped package name `@<scope>/<base>` of lowercase letters, digits and `-`, writes folder `<base>/` in the working directory, holding:
- `package.json`: `name`, `version` `0.1.0`, `"type": "module"`, `"keel": "library"`, `exports` `{ ".": { "keel": "./src/index.ts", "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" } }`, the `files` of Package, `scripts` `{ "build": "tsc -p tsconfig.build.json", "check": "keel check", "test": "keel test", "prepack": "tsc -p tsconfig.build.json && keel pack --check" }`, and `peerDependencies` `@keel/ui` and `@keel/compiler` at the running `@keel/cli`'s version, with `@keel/cli` and `@keel/testing` beside them in `devDependencies`;
- `module.ts`: `id` the base in lowerCamel (`keel-charts` gives `keelCharts`), `deps: []`, `capabilities: []`, `public: { exports: ['Example'] }`;
- `src/index.ts` re-exporting `Example`; `src/Example.tsx`, a component whose props are `{ id: string }` and which renders one `Text` with id `` `${props.id}.text` ``; `test/Example.test.ts`, rendering it and finding `<id>.text`;
- `tokens.ts` as `keel scaffold project` writes it, `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`.
An existing `<base>/` is E1351 and a `<name>` of another form E1352 (k.scaffold); either writes nothing.

**Rules.** E1164 `keel pack`: the step it names failed (`check`, `test`, `ledger`), or the folder is no library (`kind`); nothing is written.

**Conformance.**
- `keel scaffold library @acme/keel-charts` writes `keel-charts/` whose `package.json` has `"keel": "library"` and whose `module.ts` has `id: 'keelCharts'`; with its dependencies installed, `keel pack` there exits 0 and writes `.keel/ledger.json` with `unsafe` 0 and `hostElements` 0, after which `keel pack --check` exits 0.
- `keel scaffold library charts` and `keel scaffold library @acme/Charts` are each one E1352 and write nothing; run twice with `@acme/charts`, the second run is one E1351 and writes nothing.
- In that scaffolded library, a test made to fail makes `keel pack` report one E1164 whose message names `test`, and no `.keel/ledger.json` is written; `<text />` in `src/Example.tsx` makes it report one E1805 and one E1164 naming `check`.
- In that scaffolded library, after `keel pack`, adding `Host` to `src/Example.tsx` makes `keel pack --check` report one E1164 naming `ledger` and leaves `.keel/ledger.json` unchanged; `keel pack` then writes `hostElements` 1.
- `keel pack` in a folder whose `package.json` has no `keel` field is one E1164 naming `kind`.

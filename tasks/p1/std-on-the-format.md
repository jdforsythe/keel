# The stdlib on the library format (RFC 0163 slice 4)

The recipe one `@keel/std-*` package follows to become a library (k.library, k.library-pack). Written from the `@keel/std-headless` pilot; the pilot is part done, so the steps after "Where the pilot stands" are the plan, not yet proven.

## Steps done in the pilot

1. **Baseline first (1 min).** Before touching the package, from each `apps/*` and `examples/*`: `node ../../packages/cli/src/bin.ts check` and `... test`, saved per project; at the root `node packages/cli/src/bin.ts ledger --write .fixtures/ledger-before.json` (`.fixtures/` is ignored; a path outside the worktree is refused). Baseline: every project 0 errors, 0 warnings, tests green; root ledger `unsafe` 13, `hostElements` 1, `libraries` `{ "@example/library-charts": { unsafe 0, hostElements 1 } }`.
2. **`package.json` (5 min).** `"keel": "library"` after `type`; `exports["."]` `{ keel, types, default }` with `keel` first, all at `./src/index.ts` in the monorepo; `publishConfig.exports["."]` `{ keel: ./src/index.ts, types: ./dist/src/index.d.ts, default: ./dist/src/index.js }`; `files` `["module.ts", "src", "dist", ".keel/ledger.json", "docs", "README.md"]` (add `unsafe` when the package has one); `dependencies` removed, every `@keel/*` package `src/` imports moved to `peerDependencies` and repeated in `devDependencies`, with `@keel/cli` added to `devDependencies` for the `keel` bin; `pnpm install --offline`.
3. **`module.ts` (5 min).** At the root: `id` the prefix the package's chart, store and transaction ids already use (`headless`), checked against every app and example module id (none held it); `deps` the `@keel/std-*` packages `src/` imports; `capabilities` what `src/` uses of `ctx`; `public.exports` every name `src/index.ts` exports. `tsconfig.json` `include` gains `module.ts`.
4. **The app's reading, in the package's own folder (10 min).** `node ../cli/src/bin.ts check` in `packages/std-headless`. Its findings over `src/` are exactly what an app reports at `node_modules/@keel/std-headless/...` once a module lists the package in `deps` (proved by listing it in golden-2's `recipes` `deps`: the same 30 findings, plus E1005 for the app's stale `.keel/deps.json`).
5. **E1104 (5 min, done).** Named schemas moved to `src/internal/<name>.schema.ts`, one export each: `none` (openChart, toastChart), `activeIndex` and `count` (optionsChart).

## Where the pilot stands

Done: steps 1 to 5. Not done, in order:
1. E1161, 8 sites: the wrapping `Box` in Combobox, Dialog, Disclosure, Menu, Tabs, Toaster takes `` `${id}.root` ``; Combobox's empty `Text` takes `` `${id}.empty.content` ``; `internal/content.ts` takes the option part id as a new first parameter and its `Text` takes `` `${part}.content` ``, callers passing `l.partId(key)`. These add ids; no existing id changes. Spec std.headless Ids and std.options part tables gain the `root` and `content` parts.
2. E1156, 2 sites (`ctx.clock` in Toaster and listChart): `capabilities: ["clock"]`.
3. E1453, 13 sites (`tx(...)` results discarded): `void tx(...)`.
4. E1451, `internal/checkKeys.ts` throws E2801, which std.headless specifies as a throw at render: move the throw into `unsafe/keyFault.ts` inside `unsafe("<justification>", () => { throw ... })`, with an `unsafe/unsafe.ts` helper that does not itself `throw` (std-messages' helper does, which the app's reading reports as E1451). The root ledger's `unsafe` goes 13 to 14; `files` and `tsconfig*.json` gain `unsafe`.
5. E1758, 2 sites (`toLocaleLowerCase()` in typeahead): `toLocaleLowerCase("und")`; std.options' "case-insensitive, `toLocaleLowerCase`" made exact.
6. Own-folder test findings: the own-folder `keel check` reads every code file, `conformance/` included, with the app's test rules: E1701 (DOM queries), E1453, and E1751 type errors (`../conformance/fixtures.ts` not found by the type pass). `conformance/` cannot be edited outside an `rfc:` PR. Decide: the own-folder reading limited to `module.ts`, `src/`, `unsafe/`, `test/` and co-located tests, as k.library-pack Own folder words it (a `@keel/cli` change), and `test/` rewritten to app test rules; or the stdlib's suites kept out of `keel test`'s reading.
7. List `@keel/std-headless` in `deps` of the modules that import it: golden-2 `recipes` (CatalogPage, BoxShell), household `app` (RecordingNote) and `shopping` (ShoppingList). None lists it today, though they import it; regenerate their `.keel/` artifacts with `keel test`.
8. `keel pack` in `packages/std-headless`; re-run step 1's commands and compare; `pnpm test` in std-headless, check, compiler, cli; root `pnpm build` and `pnpm check --quiet`.

## Decisions taken

- `.keel/ledger.json` is not committed for a package under `packages/` (`.gitignore` already holds `packages/*/.keel/`, as it holds `packages/*/docs` that `docs-pack.mjs` writes at `prepack`). `prepack` is `tsc -p tsconfig.build.json && node ../../tooling/docs-pack.mjs && keel pack`, which writes it after its check and test steps; `keel pack --check` on a clean checkout would only report it missing. The package's `check` script gains `keel check`, so the app's reading of the package runs in `pnpm check`. Wiring `keel pack` into CI is the operator's call.
- `@keel/std-statecharts` is a peer, like the kernel packages: k.library-pack refuses any `@keel/*` package the files import in `dependencies`.

## Surprises

- No app lists `@keel/std-headless` in `deps`, though four modules import it: an unmarked std package imported unlisted is read by nobody's check. Every other std package should be grepped for the same gap.
- The app's reading reports far more than E1161: E1104, E1156, E1451, E1453, E1758 in the pilot. Expect every package's own-folder `keel check` to find app rules the kernel-style source never met.
- The own-folder reading takes in `conformance/` and `test/`.
- A std package's `unsafe/unsafe.ts` helper that throws on an empty reason is itself E1451 under the app's reading.

## The other 25, as known so far

Groups as RFC 0163 Build order gives them; run the own-folder `keel check` first in each to size the work.
- data: db, postgres (has `module.ts`), offline (has `unsafe/`), conflicts (registers through std-sessions), channels (has `module.ts`), live.
- jobs: jobs (has `module.ts`; registers from its entry: move to `./tools`), schedules (has `module.ts`), workflows (has `module.ts`), statecharts (has `unsafe/`; std-headless depends on it, so it goes first or with the pilot).
- ui: tables, messages (has `unsafe/`), i18n, text, tokens, money, temporal (each registers from its entry: move to `./tools`), geo, timings.
- tools: brands, report, sessions (has `module.ts`; registers from its entry), health (has `module.ts`).
- shells: capacitor, tauri: k.parity keeps them a closed exception (they import `@keel/router/internal`, and generated entries name them); RFC 0163 D8 still lists them among the stdlib libraries, so they take the format with E1576's shell allowance (slice 5).

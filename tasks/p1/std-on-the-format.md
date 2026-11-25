# The stdlib on the library format (RFC 0163 slice 4)

The recipe one `@keel/std-*` package follows to become a library (k.library, k.library-pack), proven on `@keel/std-headless`, and the grouping by which the other 25 move in parallel lanes. Paths are from the repository root; `keel` is `node <root>/packages/cli/src/bin.ts`.

## The recipe

Each step names its time on the pilot (27 source files). A lane runs one package at a time, in the order its group gives.

1. **Baseline (2 min).** In each `apps/*` and `examples/*` that imports the package (find them with `grep -rl "@keel/std-<x>" apps examples`, skipping `.keel/` and `node_modules/`): `keel check` and note the counts. At the root: `keel ledger --write .fixtures/ledger-before.json` (`.fixtures/` is ignored; a path outside the worktree is refused). Note `unsafe`, `hostElements`, `libraries`.
2. **`package.json` (5 min).**
   - `"keel": "library"` after `type`.
   - `exports`: every entry gains `keel` first, at its source (`{ "keel": "./src/index.ts", "types": "./src/index.ts", "default": "./src/index.ts" }`); `publishConfig.exports` the same keys with `types` and `default` at `./dist/src/<file>.d.ts` and `.js`, `keel` still at the source.
   - `files`: `["module.ts", "src", "unsafe", "dist", ".keel/ledger.json", "docs", "README.md"]` (drop `unsafe` while the package has none).
   - Every `@keel/*` package that `module.ts`, `src/` or `unsafe/` imports moves from `dependencies` to `peerDependencies` (`workspace:*`) and is repeated in `devDependencies`; `@keel/compiler` is a peer because `module.ts` imports it; `@keel/cli` joins `devDependencies` for the `keel` bin. Third-party runtime dependencies stay in `dependencies`.
   - `scripts.check` gains `&& keel check`, and `biome check` covers `unsafe` when it exists; `scripts.prepack` is `tsc -p tsconfig.build.json && node ../../tooling/docs-pack.mjs && keel pack`.
   - `pnpm install --offline`; commit `pnpm-lock.yaml` with it.
3. **`module.ts` (5 min).** Where none exists, at the root: `id` the prefix the package's store, chart and transaction ids already use, checked against every module id of `apps/*` and `examples/*` (E1166); `deps` the `@keel/std-*` packages `src/` imports; `capabilities` what `src/` reads of `ctx` (E1156 names any missing); `public.exports` every name `src/index.ts` exports. `tsconfig.json` `include` gains `module.ts` and `unsafe`; `tsconfig.build.json` `include` gains `unsafe`.
4. **The app's reading, in the package's folder (1 min to run).** `keel check` in `packages/std-<x>`. It reads `module.ts`, `src/`, `unsafe/`, `test/` and the root `tokens.ts` as an app holds the library installed, and nothing else: `conformance/` and tool configuration are not read (k.library-pack Own folder). Its findings over `src/` are what every app that lists the package in `deps` would report at `node_modules/@keel/std-<x>/...`. Fix them in the package (the table below) until it reports 0 errors.
5. **Entry registrations into `./tools` (10 min, where they exist).** An app's check imports a library only through its `./tools` export, never its entry (k.library-pack Package), so a registration that runs when the entry loads never runs in `keel check` or `keel build`: `s.register(...)` of a config or named schema, `formatter(...)`, `inspector(...)`, `clientStd(...)`, `registerSection(...)` at a file's top level. Give the package a `./tools` export (`src/tools/index.ts`) if it has none, and import from it each file that registers, so the registration runs from both. Find them with `grep -nE "^[a-zA-Z_][a-zA-Z0-9_.]*\(" packages/std-<x>/src -r | grep -v /tools/`.
6. **The apps list it (5 min).** Every module that imports the package lists it in `deps` (step 1's grep; three such gaps are known, in the groups below). Then `keel test` in each such app writes its `.keel/` again (E1005 until then); commit the `.keel/deps.json` it changes.
7. **Pack and prove (15 min).** In the package: `keel pack`, then `keel pack --check`. Again step 1's commands: every app and example `keel check` 0 errors, `keel test` green with no test count lower; the root ledger's `unsafe` up by the package's `unsafe(` calls and `libraries` gaining the package, `exports`, `clauses` and `rungs` unchanged. Then `pnpm test` in the package, root `pnpm build` and `pnpm check --quiet`. Do not run `pnpm ledger` in a lane.

## What the app's reading reports, and the fix

| Code | Where the pilot met it | Fix |
|---|---|---|
| E1104 | a named schema exported beside a component | one export per file: `src/internal/<name>.schema.ts` |
| E1161 | a wrapping `Box` with no `id`; a `Text` in a slot's `span`; a helper's element whose id comes from a string parameter | `` `${id}.root` `` on the wrapping `Box`; `` `${part}.content` `` on a slot's `span`; a helper takes a props object (`{ id, ... }`) as its first parameter and builds from `props.id`, since the reader reads `<p>.id` of a top-level function's first parameter, never a plain string parameter. Add each new part to the spec section's Ids or part table |
| E1156 | `ctx.clock` with `capabilities: []` | name the capability in `module.ts` |
| E1453 | `tx(...)` as a statement, a helper returning `tx(...)` called as a statement | `void tx(...)`; a helper typed `(): void => void tx(...)` |
| E1451 | a `throw` the spec names (E2801 at render) | the throw moves into `unsafe/<name>.ts` inside `unsafe("<reason of 8 words or more>", () => { throw ... })`; `src/` calls that function. The package's `unsafe/unsafe.ts` helper must not throw on an empty reason (that throw is itself E1451): `export function unsafe<T>(_reason: string, fn: () => T): T { return fn(); }`. The root ledger's `unsafe` rises by one per call; say so in the commit |
| E1758 | `toLocaleLowerCase()` with no locale | `toLocaleLowerCase("und")`, and the spec sentence says so |
| E1751 | a test importing `../conformance/<file>.ts` (not read, so not found) | the helpers the tests need move into `test/support.ts`; never edit `conformance/` |
| E1701 | `getElementById`, `querySelectorAll` in `test/` | read through the harness: `t.find(id)`, the ids of `t.a11y()` (shown), `find` throwing E1705 (not rendered), `t.state()["<store id>"]` (a chart's state). A node-identity assertion gives way to the focus the test already asserts (a node made again loses focus); an attribute with no harness read gives way to the behaviour it causes |
| E1453 in `test/` | `tx(...)` as a statement in a property | `void tx(...)` |
| E1164 (`keel pack`) | `peerDependencies` without `@keel/compiler` | add it (step 2) |
| S0014 (`pnpm check`) | an `unsafe(` call in a package whose range holds no cast | in a library's package a range holding any lifted code the app's reading makes (a `throw` too) satisfies S0014; in a package not yet marked `"keel": "library"` it does not, so mark the package first |

Expect the casts of kernel-style source to surface as E1757 under the app's reading, each moved into `unsafe/` with a reason (RFC 0163 slice 4), and E1801 in components.

## The pilot's result

`@keel/std-headless`: own-folder `keel check` 145 errors to 0 (30 in `src/`, 4 of them E1104; the rest in `test/` and `conformance/`); `keel pack --check` 1 unsafe, 0 hostElements, 19 exports; root ledger `unsafe` 13 to 14, `libraries` gains `@keel/std-headless` `{ unsafe 1, hostElements 0 }`, `exports`, `clauses`, `rungs` unchanged; golden-2 `recipes`, household `app` and `shopping` list it.

Two defects of the format were found and fixed on the way: the own-folder reading took in every code file of the folder, `conformance/` included (`packages/cli/src/internal/asInstalled.ts`, k.library-pack Own folder now says no other code file is read); and S0014 refused an `unsafe(` call holding a `throw` in a library's package, where the app's reading enforces every lifted code (`tooling/structure-lint.mjs`, k.unsafe).

## Decisions taken

- `.keel/ledger.json` is not committed for a package under `packages/` (`.gitignore` holds `packages/*/.keel/`, as it holds `packages/*/docs` that `docs-pack.mjs` writes at `prepack`). Wiring `keel pack` into CI is the operator's call.
- A `@keel/std-*` package the files import is a peer, never a dependency: k.library-pack refuses any `@keel/*` package in `dependencies`.
- `conformance/` stays outside the own-folder reading; the package's `test/` is held to the app's test rules.

## The other 25, in parallel lanes

Files every lane touches are its own `packages/std-<x>/` and its spec sections; the shared files are `pnpm-lock.yaml` (each lane changes only its package's importer block: on a merge conflict take either side and run `pnpm install --offline`), an app module's `deps` where the table names one, and that app's `.keel/deps.json` (generated: take either side, then `keel test` in the app). A lane that finds a defect of the format fixes it in `@keel/check` or `@keel/cli` with a test and says so; two lanes doing that merge in turn.

Own-folder `keel check` errors per package with the package marked `"keel": "library"` and, where it has none, a stub `module.ts` (`deps`, `capabilities` and `public` empty), less the stub's own finding; nothing else changed. The codes are the larger ones.

| Package | Errors (src + test) | Main codes | Entry registrations to move into `./tools` |
|---|---|---|---|
| std-statecharts | 6 (5 + 0, unsafe 1) | E1451 4, E1107, E1207 | none |
| std-workflows | 62 (25 + 36, unsafe 1) | E1453 30, E1576 10, E1751 9, E1551 5, E1451 4 | `inspector` in `internal/counted.ts` |
| std-jobs | 20 (9 + 11) | E1453 11, E1451 4, E1104 3, E1452 2 | `s.register` in `JobsConfig.ts`, `inspector` in `internal/snapshot.ts` |
| std-schedules | 12 (12 + 0) | E1451 6, E1576 3, E1452 2 | none |
| std-postgres | 68 (55 + 15) | E1451 22, E1452 19, E1453 15, E1759 9 | none |
| std-db | 54 (47 + 7) | E1451 20, E1452 20, E1759 7, E1751 6 | none |
| std-offline | 45 (35 + 9, unsafe 1) | E1453 11, E1751 10, E1156 10, E1451 7 | none |
| std-live | 2 (2 + 0) | E1451, E1156 | none |
| std-channels | 16 (13 + 2) | E1452 4, E1451 3, E1156 3, E1551 2 | `s.register` in `server/ChannelsConfig.ts` |
| std-conflicts | 8 (8 + 0) | E1451 3, E1104 2, E1452 2, E1207 | none |
| std-sessions | 227 (148 + 80) | E1453 40, E1759 33, E1452 32, E1451 31, E1104 29, E1751 23, E1601 9, E1002 8, E1107 7 | `s.register` (4 files), `formatter` (2), `inspector` in `record.ts`, `clientStd` in `SessionsConfig.ts` |
| std-i18n | 1 (1 + 0) | E1104 | `s.register` in `Locale.ts` |
| std-messages | 24 (10 + 13, unsafe 1) | E1751 13, E1451 7, E1106 2 | none |
| std-money | 5 (5 + 0) | E1104 2, E1451 2, E1016 | `s.register` in `Currency.ts`, `Money.ts` |
| std-temporal | 12 (12 + 0) | E1104 6, E1106 4, E1108, E1451 | `s.register` in `Instant.ts`, `TimeZone.ts`, `PlainDate.ts`, `Duration.ts` |
| std-text | 7 (7 + 0) | E1106 3, E1104 2, E1451 2 | `s.register` in `Slug.ts`, `Email.ts` |
| std-tables | 42 (10 + 31, unsafe 1) | E1701 23, E1751 8, E1451 7, E1252 3 | none |
| std-tokens | 14 (11 + 3) | E1759 4, E1105 4, E1104 3, E1106, E1607 | `s.register` in `Digested.ts` |
| std-geo | 3 (3 + 0) | E1104, E1607, E1452 | none |
| std-timings | 3 (3 + 0) | E1104 2, E1156 | `registerSection` in `timingsOf.ts` |
| std-brands | 0 | none | none |
| std-report | 6 (6 + 0) | E1104 4, E1452 2 | none |
| std-health | 6 (3 + 3) | E1104, E1161, E1513, E1002, E1701, E1004 | none |
| std-capacitor | 19 (18 + 1) | E1452 7, E1451 6, E1759 4, E1576 | none (slice 5) |
| std-tauri | 32 (31 + 1) | E1759 13, E1452 9, E1451 8, E1576 | none (slice 5) |

A count is a floor: E1751 type errors hide what lies behind them, and the casts of kernel-style source (E1757) show only once a file type-checks.

**Findings a lane cannot settle alone.** These are not lifted codes (an `unsafe(` call does not hide them) or are another slice's; the orchestrator decides each before the lane that meets it starts, and the decision goes into RFC 0163:
- E1106 (`s.format` in app code) in std-text, std-temporal, std-messages, std-tokens: defining a format type is these packages' purpose. Proposed: E1106 does not apply to a library's files (k.library).
- E1105, E1107 (`reveal` in client code, a secret's reach) in std-tokens, std-sessions, std-statecharts, std-workflows: proposed the same reading as E1106, or the code moves into `*.server.ts` files where it is server code.
- E1576 (an import of another package's `internal` entry) in std-workflows and std-schedules: the dependency gives it a public entry, or slice 5's allowance covers it.
- E1207 (`scope({ detached })`) in std-statecharts and std-conflicts: slice 5 moves E1207's stdlib sites into `unsafe/`; until then the lane leaves them and says so.
- E1513 (a `contract()` outside its file), E1002 and E1004 in std-health and std-sessions: read the site first; a refusal of a library's `./contract` is a defect of the format, fixed in `@keel/check` with a test.

**The lanes.** Each lane owns its packages' folders and spec files (`spec/std/std.<name>*.md`); no two share a hand-written file but for `pnpm-lock.yaml` and the app files named here.
1. **jobs:** std-statecharts, then std-jobs, std-workflows, std-schedules. About 100 errors. Moves registrations into `./tools` in std-jobs and std-workflows. Touches no app module.
2. **data:** std-postgres, std-db. About 122 errors. Slice 4b gave std-postgres its `module.ts` with `env`; keep it. Touches no app module.
3. **sync:** std-channels, then std-live; std-offline; std-conflicts. About 71 errors. Moves the registration in std-channels into `./tools`. Lists std-live and std-offline in `apps/golden-1/modules/todos/module.ts` (imported there, listed nowhere) and regenerates golden-1's `.keel/`.
4. **sessions:** std-sessions alone: 227 errors and the most registrations (`s.register`, `formatter`, `inspector`, `clientStd`).
5. **formats:** std-i18n, then std-money, std-temporal, std-text, std-messages, std-tokens, std-tables, std-geo, std-timings, std-brands, std-report, std-health. About 120 errors, most in std-tables' and std-messages' tests. Moves registrations into `./tools` in std-i18n, std-money, std-temporal, std-text, std-tokens and std-timings. Lists std-tables in `apps/golden-2/modules/recipes/module.ts` (imported, listed nowhere) and regenerates golden-2's `.keel/`. Starts after the E1106 decision.

Lanes 1 to 4 can start at once. At the end of slice 4 the `@keel/std-*` name pass of slice 1 is removed (the kind alone admits a package), and the orchestrator writes the golden apps' and examples' ledgers again, since their `unsafe` and `hostElements` now count the stdlib's.

Order within the stdlib: `std-statecharts` before `std-workflows` (and `std-headless`, done, already lists it as a peer); `std-i18n` before `std-messages`, `std-money`, `std-tables`, `std-temporal`, `std-text`; `std-temporal` and `std-jobs` before `std-schedules`; `std-channels` before `std-live`; `std-sessions` before `std-conflicts`. A package can move before the one it imports, since a library's `deps` may list an unmarked `@keel/std-*` package; the order only keeps a lane from fixing findings that its dependency's lane is also fixing.

Shells: `std-capacitor` and `std-tauri` stay a closed exception (k.parity: they import `@keel/router/internal`, and generated entries name them); they take the format with E1576's shell allowance in slice 5, not here.

## Lane 3 (sync) notes

- std-channels, std-live, std-offline, std-conflicts are marked `"keel": "library"`; own-folder `keel check` is 0 errors for channels and live, and E1207 alone (slice 5) for offline and conflicts, where `keel pack` refuses until it is lifted.
- A server file in a library is a `*.server.ts` file, and every importer of one is too (E1004 reads each other file as client code with no `topology.ts`): std-channels' `channelRoute.server.ts`, `index.server.ts` (the `./server` entry) and its tests that import it, named `*.server.test.ts`.
- Open: `public.exports` cannot name a library's `exports` subpath (`server` is no file stem: E1154 when listed, E1151 at `@keel/std-channels/server` imports in golden-1 and household when not). Fix belongs in `@keel/check` (`moduleChecks.ts`: count the `exports` subpath names as stems).
- Throws go through one `unsafe/` helper per package (`fault`, `outsideScope`, `raise`, `afterRejection`, `recovering`); `try/catch` and `.catch` become `attempt(fn)` where the error value is not rethrown.

## Lane 1 (jobs) notes

- `@keel/std-jobs`: own-folder `keel check` 20 to 0. The `jobs.queue` inspector registers from `./tools` by a side-effect import of `internal/snapshot.ts`; a package's unused `./module` export is removed (k.library-pack E1164: its `keel` target is no file under `src/` or `unsafe/`; `module.ts` ships through `files`).
- Declaration throws, a `try`/`catch` and a `.catch()` are fixed by `unsafe/refuse.ts` (a `never`-returning `refuse(message)` holding the throw) and `attempt`; the pattern repeats in each package.
- `./tools` carries a package's rules and the readers of its own domain other libraries' rules build on: std-jobs `keyFindings`, `runnersEdits`, `runnersFindings`; std-statecharts `chartCalls`, `literalShape`. Generic AST plumbing (`callsOf`, `editOf`, `lineCol`, `moduleFile`, `propOf`, `unwrap`) is each package's own `src/tools/internal/` file, not another library's surface; `asEvents` is copied into std-workflows' `unsafe/`.
- A package's `exports` subpath written whole (`./tools`, `./server`) is an entry, not a file: an import of it is no E1151 and needs no `public.exports` line (k.module E1151); E1152 still asks for the `deps` entry. `public.exports` lists file stems; a `./*` pattern reaches files and is judged by it.
- A library function that builds a store from its caller's schema (std-statecharts `chart`) is a store maker: E1107 judges each call of it in client code, every argument read as the state schema, and not the library's own `store` call (k.leave E1107). `s.enum` and `s.literal` arguments are values, not read.
- E1207 is lifted in a library's `unsafe/` ranges (k.check App code), not an app module's; std-statecharts' detached scope is `unsafe/detached.ts`.
- std-workflows' whole API is server code (std.workflows API, E2351), so its entry is `src/index.server.ts`, server-only: no `./server` subpath and no app import changes; its tests that import the entry are `*.server.test.ts` (the own folder has no `topology.ts`, so every other file is client code, E1004).

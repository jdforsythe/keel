# Walkthrough app findings

Working file for the orchestrator; it moves to `tasks/p1/` before merge. Each finding: what I tried, where, the command and its output, what I expected, whether docs or skills misled. Kinds: fault (framework behaves against its spec), docs (docs or skills gap), rough (works, but an app author trips on it).

## Layer 1

### L1-1 fault: a built node page has no stylesheet
- Tried: `pnpm build`, then `PORT=5211 KEEL_SECRET=... node dist/web/server.mjs` and `curl localhost:5211/`.
- Saw: the page's elements carry atomic classes (`<main id="app.start" class="k-p-4 k-gap-2">`), `dist/web/assets/` holds only `entry-*.js`, and the head has no `<link rel="stylesheet">`. The page renders unstyled.
- Expected: `keel docs k.ui` says "The compiler emits one atomic class per (prop, token, breakpoint, state) ... into one CSS file", and `keel docs k.head` says the head holds a stylesheet link for each `.css` file the entry chunk names.
- The scaffold's `index.html` imports `@keel/ui/fonts`; a node deployable never serves that file, so the brand fonts are absent too.

### L1-2 rough: the workspace scaffold's package.json cannot run `keel`
- Tried: `keel scaffold project household --workspace --adapter node`, then `pnpm build` with `"build": "keel build"`.
- Saw: the scaffold writes `"build": "vite build"`, no `dev` script, `"check": "tsc --noEmit && biome check modules test"` (no `keel check`) and no `@keel/cli` dependency. With `keel build` as the script, pnpm runs whatever `keel` is on `PATH` (`Error: unknown command "build" for "keel"` from an unrelated binary).
- Expected: scripts that call `keel build`, `keel dev`, `keel check`, and `@keel/cli` in `devDependencies`. Fixed in the app by adding both.

### L1-3 rough: a fresh scaffold's `check` and `test` scripts fail before the first test exists
- `pnpm check` on the fresh project: Biome prints `test internalError/io INTERNAL ... No such file or directory (os error 2)` because `test/` does not exist.
- `pnpm test` with no tests: `ok 0 tests, 0 failed, 0 skipped` then `[ELIFECYCLE] Test failed.` (vitest exits 1 on no files), while `keel test` exits 0 on the same tree.
- Expected: the scaffold writes a first test, or both runners agree.

### L1-4 docs: `keel explain E2406` does not know a code the docs cite
- `keel explain E2406` prints `E2406 is not a known code; keel docs --for E2406 lists spec lines citing it.`
- `keel docs k.head` and the `keel-client` skill both name E2406 (a literal in a route `title` with `@keel/std-messages`).

### L1-5 docs: `keel docs` points app authors to a repo-only command
- `keel docs` (the map) says `owner: pnpm spec --for <code>`. An app has no `pnpm spec`; the app-side command is `keel docs --for <code>`.

### L1-6 rough: `keel` with no arguments prints an error, not the commands
- `keel` prints `E1051 no command given; see keel docs k.cli` and exits 1. A command list would save a step.

### L1-7 docs: the coverage plan names `keel new`
- `tasks/p1/feature-coverage.md` layer 1 says `keel new`; the command is `keel scaffold project <name>` (`keel new` is E1051).

### L1-8 rough: `keel dev` and the build serve different documents for a node deployable
- `keel dev --port 5199` on the fresh project serves the scaffold's `index.html` (a header with the mark and the literal app name, an empty `#app`, the client entry). The built `server.mjs` renders the route on the server and ignores `index.html`. The header and its literal text appear in dev only.

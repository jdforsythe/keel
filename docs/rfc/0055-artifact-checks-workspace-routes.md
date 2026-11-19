# RFC 0055: `.keel/` artifacts in every project, no trusted hashes, and `routes.json` reported as unverified (W1005)

Status: implemented (ADR-0043)

## Problem
- **Red team 0143.** `check()` used the caller's `artifacts.hashes` whenever it was an object. `{}`, or a map without a compiled name, silenced E1005. Repro: `check([{ path: ".keel/ids.json", source: canonicalJson({ data, hash: hashOf(data) }) + "\n" }], { types: false, artifacts: { hashes: {} } })` returned `[]`. RFC 0050 called this trusted caller input. Nothing enforced that trust.
- **Red team 0144.** In a workspace, `keel check` from the root never compared an app's `.keel/` files. `readProject` and `codeFiles` took `.keel/` only at the cwd root, so `apps/<x>/.keel/*.json` were never read. Repro: at the repo root, `keel check apps/inspector` counted 26 files. Inside `apps/inspector` it counted 31. `check()` also checked nested `.keel/` dirs for self-consistency only (RFC 0050).
- **Red team 0139 (accepted gap of RFC 0050).** `routes.json` was compared only when no `modules/<m>/routes.ts` existed. Deriving it evaluates `routes.ts`, and k.check never evaluates app code. So a forged, self-consistent `routes.json` passed in every app with a routes manifest, and `keel check` said nothing.

## Proposal
1. **0143: no hash override.** `check()` always derives the expected hashes from sources. `artifacts.hashes` no longer reaches E1005.
   - **New option `project`.** The project files the hashes are derived from. The default is `files`. The cli passes the whole project, so `keel check .keel` still compares against every source.
   - **Fail closed.** A `.keel/<name>.json` the compiler does not write is E1005: `.keel/<name> is not among the compiled artifacts; remove it`. With no sources, every artifact with data is E1005.
   - **Why this and not "a missing name is E1005".** Both close the hole. Keeping a flat name-to-hash map does not fit item 2, where each project has its own hashes. Dropping the override is the smaller change.
2. **0144: every project holding a `.keel/`.** The project of `<dir>/.keel/<name>.json` is `<dir>`.
   - **The cli reads them.** `readProject` and `codeFiles` take `.keel/*.json` at any depth under the checked paths.
   - **`check()` groups them.** For each `<dir>`, it compiles the sources under `<dir>` (paths made relative to it) with `artifactHashes`, using `<dir>/topology.ts` when present. One compile per project, and only for projects with a checked artifact.
   - **Same answer from anywhere.** `keel check apps/a` from the root and `keel check` inside `apps/a` count the same files and report E1005 on the same artifacts.
3. **0139: option (a), report at check, catch at build.**
   - **compiler.** `artifactHashes` returns `null` for `routes.json` when a routes manifest exists. `null` means written by the compiler, but derived only by evaluating code.
   - **check: W1005.** A self-consistent, canonical `routes.json` whose expected hash is `null` is W1005: `.keel/routes.json not verified: routes.ts runs only in vite build`. A file that is not self-consistent is still E1005.
   - **build.** `vite build` evaluates every `routes.ts` and rewrites `routes.json`. When a prior `routes.json` differs from the evaluated one, the plugin warns W1005 (`differed from routes.ts; rewritten`) before the rewrite. A forged file never outlives a build, and the build says so.
   - **`keel build` shows it.** The binary hides Vite's output on success. It now prints the Vite lines that carry a Keel code (`keel: W1005 ...`, also E1006 and E1807 build warnings) to stderr. The exit code is unchanged.
   - **Why a warning at build, not E1005.** The build is how you regenerate, so it cannot fail on the file it rewrites. After the build the file is correct. A forged file only matters until then, and the warning names it.

## Alternatives
- **(b) Evaluate `routes.ts` in a sandbox inside check.** The compiler has no sandbox. `evaluateProject` bundles with esbuild and imports the result in Node, with full I/O, asynchronously. A `node:vm` evaluator would need its own module loader for `@keel/router` and app imports, and it breaks k.check "never evaluates app code" (rfc:0023). Rejected.
- **Keep `artifacts.hashes` and fail closed on a missing name.** It needs one map per project. That puts the project grouping in both the cli and `check()`.
- **Fail the build on a differing `routes.json`.** The build is the regenerate step: an edit to `routes.ts` with no dev server running would fail the next build every time.
- **Info instead of a warning at check.** A file that was not verified is something to act on before a release. That is a warning, and warnings do not change the exit code (k.check).
- **Project roots from `package.json` or `vite.config.ts`.** `keel check` does not read those files. The `.keel/` parent is where the writer put the files, which is the project by definition.

## Spec diff
- **k.compiler Artifacts.** "`keel check` recompiles the sources; a differing hash is E1005 (`routes.json` only without a `routes.ts`: it is evaluated)." becomes "`keel check` recompiles the project holding each `.keel/`; a differing hash or unknown file is E1005 (`routes.json` beside a `routes.ts` is W1005: it is evaluated)."
- **k.compiler Rules.** Adds "W1005 `routes.json` beside a `routes.ts`: unverified by `keel check`; `vite build` rewrites it, warning if it differed".
- **k.compiler Conformance.** Adds "Beside a `routes.ts`, a forged self-consistent `routes.json` is W1005 in `keel check` and in `vite build`, which rewrites it."
- **Editorial, to stay under 1,500 tokens.** Non-normative words are cut. The `vite.config.ts` example becomes "(`@keel/compiler/vite`)". Also cut: ": no virtual DOM, no diffing", "Text children become text nodes." (a conformance clause states it), "RFC 0024", "ADR-0006; ", "read by `check` and the harness", and the "fix:" tails of E1005 and E1049 (their `explain` entries carry the fix). The `For` sentence becomes "Reordered keyed `For` rows move, not re-create." (E1001 states the key rule). No rule changes.
- **k.cli.** Unchanged: `check [paths]` already covers "the `.keel/*.json` artifacts under `paths`". 0144 made the cli do what it says.

## Conformance diff
- **Added** `packages/cli/conformance/artifact-routes-w1005.test.ts`, written by conformance-writer from the spec text. It covers a forged `routes.json` beside a `routes.ts`: W1005 from the real binary, then the Vite plugin's build warning and the rewritten file.
- **Unchanged** `artifact-forged-e1005.test.ts`, `artifact-tamper-e1005.test.ts`, `compiler-keel-dir-tamper.test.ts` and the check fixtures: they stay green.
- **Unit tests.**
  - check (`rules.test.ts`, `mutants.test.ts`): the 0143 repro (`artifacts.hashes: {}` and a map missing the name are E1005), an unknown name, a nested project compared with its own sources, `project` used for derivation, and W1005.
  - cli (`workspace-artifacts.test.ts`, `mutation-io-fs.test.ts`): a temp workspace with two apps. `keel check apps/a` from the root and `keel check` in `apps/a` report the same file count, and a forged `apps/b/.keel/ids.json` is E1005 from the root. Also the Keel-coded line filter for `keel build`.
  - compiler (`routes-w1005.test.ts`): `artifactHashes` gives `null` for `routes.json` beside a manifest, and the plugin warns W1005 at build.

## Migration
- `check()` callers that passed `artifacts.hashes` to E1005: pass the project sources as `project` instead. The map is ignored.
- `keel check` at a workspace root now compares every app's `.keel/`. Rebuild stale apps.
- Apps with a `routes.ts` see one W1005 per `keel check` that includes `.keel/routes.json`. Exit codes are unchanged.
- `@keel/compiler` `artifactHashes` returns `Record<string, string | null>`.

## Token impact
- k.compiler: 1,500 to 1,495 tokens (additions offset by editorial cuts).
- W1005 explain: one entry.
- `keel check` on golden app 1 adds one W1005 line.

## Amendment (RFC 0059, backlog 0149, 0150, 0155)
- **W1005 now names what was not read.** `keel check` compares `routes.json` with the literal ids, paths, layouts, actions and guard redirects of `routes.ts` (`routeLiterals`, no evaluation). A mismatch is E1005. W1005 remains only for parts that are not literals.
- **The known limit is closed.** `keel build` writes `routes.json` when every deployable is `node` (`@keel/compiler/routes`).
- **Grouping reaches the rule compile.** `check()` compiles each project's code with its own topology, not only its artifacts.

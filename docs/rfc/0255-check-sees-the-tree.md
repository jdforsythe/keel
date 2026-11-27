# RFC 0255: k.derived: check sees the project as it is

Status: accepted (ADR-0293) by the orchestrator on 2026-11-26, to be confirmed by the operator. Adds k.derived (derived files, their readers, refresh, frozen runs, the derivation cache; W1018). Amends k.compiler (Artifacts, Build-time evaluation, E1005, W1005 reserved), k.compat (Surface version 3 without `sources`; the Sources paragraph removed; Base compares the derived surface), k.check (step 3, the sort note), k.a11y (Artifacts, Claims), k.ledger (the `a11y` order, W1731, two clauses), k.deploy, k.shell and std.tauri (deploy files are views), k.library-pack (`--check` becomes `--frozen`), k.contract (Static reading reports E1111 alone), the glossary (`derived file`) and the tools area. From `tasks/p1/TODO.md` W17 ("`keel check` refreshes its derived `.keel/` files before judging").

Personas: A2 and its agent form (edit, check, done), A7 (`keel test` after an edit), A3 (CI and committed files), A8 (the build is a function of the tree), F1 (the cost of changing this later); A6 through the ledger.

## Decisions
- D1: no command judges, tests or serves from a derived file's bytes on disk. Each reader takes the derivation of the tree it runs over. The files in `.keel/` and `deploy/` become views of the derivation, written for people, reviewers and tools.
- D2: every command that runs over a tree and is not frozen writes each view whose bytes differ (`keel check`, `keel build`, `keel test`, `keel dev`, an applied scaffold operation). The editor's language server writes none. One trailer count, `2 refreshed`.
- D3: frozen is pnpm's `--frozen-lockfile` idea: `--frozen`, on by default under `CI`. Frozen writes nothing, and a view that differs from its derivation is E1005.
- D4: the evaluated derivations (`routes.json`, `surface.json`) come from one evaluation and are cached in `node_modules/.cache/keel/derived/` under the type cache's rule: an entry keyed by everything the evaluation read, used only when each read gets the same answer. No digest is written into a committed file, so none can be forged there.
- D5: `surface.json` holds the surface only (version 3): its `sources` and k.compat's normal form go, because freshness is the derivation's job, not the record's.
- D6: the compiled views are not committed; `surface.json` and the deploy files are. A scaffolded `.gitignore` says so.
- D7: W1005 is reserved: `keel check` evaluates `routes.json` instead of reading literals beside it, so no part of it is unverified.

## Problem
`keel check` compares each `.keel/` file with what the compiler derives and reports E1005 when they differ; it reads `surface.json` from disk for `--base`; `keel test` reads `.keel/a11y.json` from disk; `keel ledger` finds projects by `.keel/routes.json`; `keel dev`'s inspect document reads the files from disk. Only `keel build` and the Vite plugin write them. So after an edit an author, or an agent, either runs `keel build` before `keel check` or reads an error about a file they never touched. The guide says it outright (`docs/guide/build-golden-1.md`): "Run `keel build` before `keel check` after edits." The `keel` skill carries it as a rule an agent must remember: "`keel check` (E1005 on `.keel/` files after an edit until `keel build` runs)".

### Who writes and reads each file
| file | written by | read by | derived from |
| --- | --- | --- | --- |
| `.keel/a11y.json`, `ids.json`, `deps.json`, `styles.json` | `keel build`; the Vite plugin under `keel dev`, `keel test` and `vite build` | `keel check` (E1005 only: its rules get the compile in memory); `keel test`'s setup (`a11y.json`, E1702); dev inspect | the project's sources and its libraries' files |
| `.keel/std.json` | as above | `keel check` (E1005); the Vite plugin (copied into `dist/`) | each manifest's `std` entries |
| `.keel/schemes.json` | `keel build`; the Vite plugin | `keel check` (E1005); a `node` deployable's first paint | the evaluated tokens (k.schemes): a compiled view, gitignored |
| `.keel/routes.json` | the Vite plugin; `keel build` (`buildRoutes`, node-only topologies); scaffold refresh | `keel check` (E1005 against literals, W1005, E1511's evaluated entries); `keel ledger` (projects, page routes, W1731); dev inspect | the evaluated route tables and contracts |
| `.keel/surface.json` | `keel build` only (`surfaceRun`); scaffold refresh | `keel check` (E1005 by `sources`; the current side of `--base`); CI's `git show origin/<base>:.keel/surface.json` | contracts, route tables, store factories, evaluated, and every file they load |
| `deploy/**`, the CI workflow | `keel build`; scaffold | `keel check` (E1005) | `topology.ts`, libraries' manifests |
| `dist/<name>/` | `keel build` | the server at run time; a `static` prerender | the whole build |
| `node_modules/.cache/keel/` (type cache) | `keel check` | `keel check` | keyed by its probes (k.check-cache): correct by construction |
| `.keel/ledger.json`, `.keel/monitored.json`, `reports/**` | `keel ledger`, `keel pack`, a std.monitor tally, `keel test` | `keel ledger`, `keel evidence`, an app's check of a library | test runs and production, not the tree |

### Reproduced
Each in a copy of `apps/household` under a fresh `mktemp -d`, `keel build` first, then one edit, then `keel check` (and `keel test test/start.test.ts` where stated), with the CLI of this branch.

| # | edit | result today | wrong |
| --- | --- | --- | --- |
| 1 | rename the id `app.start.intro` in `StartPage.tsx` | E1005 on `a11y.json`, `ids.json` and `surface.json` ("stale, modules/app/StartPage.tsx changed; run keel build"), exit 1 | red: the tree is correct |
| 2 | add an API entry `setup.ping` to `setup.contract.ts` and `routes.ts` | E1005 on `routes.json` ("differs from the contracts and bindings") and `surface.json` | red |
| 3 | change the path `/api/household` to `/api/home` | the same two E1005 | red |
| 4 | add a required field `size` to the `setup.household` store state, after `keel build` | E1005 on `surface.json` only; with `--base` the compat pass is skipped for the stale file, so the run says "run keel build" and not the E1563 it holds | red, and the real error hidden |
| 5 | the edit of 4 with `.keel/surface.json` absent, `keel check --base <the committed surface>` | `ok check`, exit 0; after `keel build` the same command reports E1563 "store setup.household state refuses its stored states at size (missing)" | **green: a stored-data break passes the gate** |
| 6 | upgrade a dependency: `@keel/std-text`'s `line` default `min` 1 to 2, through a linked copy | `keel check` and `keel check --base` clean; after `keel build`, E1563 at `Household.schema.ts` and W1564 | **green: `surface.json` lists project files only, so a package change never makes it stale** |
| 7 | the same package change, `min` 1 to 0 | clean; `keel build` rewrites `surface.json` (`line(1..40)` becomes `line(0..40)` in three places) | green on a stale committed record |
| 8 | add `storage: "sqlite"` to `topology.ts` | E1005 on `deploy/compose.yaml` and `deploy/web/Dockerfile` ("keel build rewrites it"), beside the real E1572 | red |
| 9 | a `look` or a colour in `tokens.ts` | judged from the evaluated `tokens.ts` at once (E1804 for a pale text colour); no stale file | correct today |
| 10 | `keel test` after edit 1 | passes, and rewrites `a11y.json` and `ids.json` (the Vite plugin's `buildStart` writes them), leaving `surface.json` stale | correct verdict; `keel test` writes tracked files |
| 11 | `keel test` with `.keel/` at mode 0555 (a read-only checkout) | T0001 "uncaught: EACCES ... open" from `writeArtifact.ts`, 0 tests run, exit 1 | **red: no test ran** |
| 12 | `keel dev` serving, then the path change of 3 | dev serves `/api/home` at once; `.keel/routes.json` is never rewritten; `ids.json` only after a request loads the page; `keel check` beside it: E1005 on `routes.json` and `surface.json` | dev and check disagree |
| 13 | a Keel release that changes k.compat's normal form (k.compat Sources) | E1005 on every `surface.json` until `keel build` | red after an upgrade alone |

From the code, not run: `keel ledger` lists the page routes of the last-built `routes.json`, so a page added since then has no `a11y:` item and a removed one keeps its item; with no `routes.json` the project is not found at all. The generated CI runs `keel check --base` before `keel build`, so cases 5 to 7 reach a pull request as a green check.

`packages/cli/test/appArtifactsFresh.test.ts` guards that golden-1's and sessions' committed `.keel/` files carry no E1005 and that `keel test` leaves them byte for byte. It holds only for a fresh tree: case 10 shows `keel test` rewriting them when they are stale.

### Cost, measured
`apps/household` copy, Node 24. Other agents share the machine: the first figures are at a 1-minute load of 18, the second at 40.

| derivation | cold | warm |
| --- | --- | --- |
| compiled views (`compile` of every source) | 56 ms; 125 ms | 31 ms; 52 ms |
| `routes.json` (`buildRoutes`, an esbuild bundle evaluated) | 323 ms; 687 ms | 257 ms; 480 ms |
| `surface.json` (`surfaceRun`, a Vite SSR server loading contracts and route tables) | 1,297 ms; 8,255 ms | 1,171 ms; 7,848 ms |
| `tokens.ts` (already evaluated by every `keel check`) | 44 ms; 63 ms | 37 ms; 48 ms |
| `keel check` whole | 4.8 s (no type cache); 8.8 s | 2.3 s; 2.5 s |
| `keel build` whole | 7.6 s; 11.8 s | |

`keel check` already compiles the project twice (once for the rules, once in `expectedHashes`), so the compiled views cost it nothing new. The surface costs four to sixteen times the routes because it runs Vite's SSR transform per module; both evaluate the same route tables.

## Proposal

### 1. Readers take the derivation
`keel check` gives its rules, E1511 and the current side of `--base` the derivation of the tree. `keel test` derives `a11y.json` in its own process before vitest starts and hands it to each test process; the setup reads no `.keel/` file. `keel ledger` derives each project's `routes.json`. Dev's inspect document serves the derivation the Vite plugin holds. A file Keel cannot derive is read as before: the `--base` surface (another tree's), `ledger.json`, `monitored.json`, a library's shipped `.keel/ledger.json`.

With this alone cases 1 to 7 and 12 give the right answer, and E1005 for a stale view can no longer appear by surprise: nothing reads it.

### 2. Views are refreshed by every run that is not frozen
After judging, `keel check` writes each view whose bytes differ from the derivation; `keel build`, `keel test`, `keel dev` and an applied scaffold operation do the same at their own moment. The trailer says so in one count, per `docs/OUTPUT.md`: `ok check 217 files, 2 refreshed, 0 errors, 2 warnings`; at 0 the count is left out, so a clean check of a fresh tree prints exactly today's line.

**Is writing acceptable for a checker?** People expect `keel check` to judge, not edit. It writes only files Keel owns and nothing else: never a source file, nothing in `dist/`, nothing outside the project. TypeScript's `.tsbuildinfo`, ESLint's cache and Keel's own type cache already make a checker a writer of derived state. `.keel/` views are pure functions of the tree, so a refresh changes no meaning. The one tracked file it can change is `surface.json`, and only when the surface changed. That is the same contract as `pnpm install` updating the lockfile, which CI then runs frozen.

**A view that cannot be written** (a read-only checkout, a container layer, no permission) is W1018 with the path and the reason; the run goes on with its derivation. Case 11 becomes a passing run with one warning per differing view.

**The language server writes nothing.** It checks unsaved buffers, so a view written from them would describe a tree that is not on disk. An MCP `check` given file texts writes nothing for the same reason; one over the disk writes as the CLI does.

### 3. Frozen
`--frozen`, or `CI` set to a value other than empty, `0` or `false`, or `KEEL_FROZEN=1` makes a run frozen. A frozen command sets `KEEL_FROZEN=1` for its children, and the Vite plugin reads it, so a frozen `keel test` or `keel build` writes no view through the plugin either. Frozen, no view is written, and a view present that differs from its derivation is E1005; an absent view is no diagnostic (the compiled views are not committed, so CI has none). E1005 for `surface.json` names the store, contract or entry that differs first.

`CI` turns frozen on because the pipelines people write by hand are the ones that would otherwise let a stale record onto the main line (A3). pnpm does the same with `--frozen-lockfile`, so the behaviour is the one a newcomer expects (principle 9).

There is no `keel check --check`. `keel pack --check` (k.library-pack) is the one other command with a write-nothing mode; renaming it `--frozen` would give the idea one name (For the operator, 3).

### 4. What is committed
| file | committed | why |
| --- | --- | --- |
| `.keel/surface.json` | yes | the base the generated CI compares against (`git show origin/<base>:.keel/surface.json`), and a reviewer reads an API or stored-state change in its diff |
| `deploy/**`, the CI workflow | yes | they are what runs in deployment and CI; a reviewer reads them |
| `.keel/a11y.json`, `ids.json`, `deps.json`, `styles.json`, `std.json`, `schemes.json`, `routes.json` | no | caches of the compile and the route evaluation; nothing reads them; committing them adds a churn line to most pull requests and a merge conflict between any two that touch components |
| `.keel/ledger.json`, `.keel/monitored.json` | as k.ledger says | not derived from the tree |

`keel scaffold project` writes the six view names into `.gitignore`. The repository's apps stop tracking them (Build plan, slice 2).

**`surface.json` holds the surface, not its freshness.** Its `sources` map and k.compat's normal form exist so `keel check` could tell, without evaluating, whether the file was stale. Check now evaluates (from cache when nothing changed), so `sources` goes and the file is `version: 3`. A reviewer's diff then shows only surface changes. Today it also shows one hash line per page, schema or helper file touched (case 1 made `surface.json` stale through `StartPage.tsx`), and two pull requests that touch different pages conflict on it. `--base` reads version 2 and 3; a version 2 file's `sources` is ignored.

**A committed digest was rejected.** An `inputs` digest written into each view would let readers skip re-derivation, but the digest is a public function of the tree: anyone can write a stale or forged `surface.json` with the digest of the new tree, and a frozen CI that trusts it merges a wrong base for every later `--base`. So frozen CI always derives and compares bytes, and the digest lives only in the local cache (section 5), where it is as trusted as `node_modules`.

### 5. The derivation cache
The compiled views take 50 to 125 ms and are derived on every run. The route evaluation is the cost: one evaluation of contracts, route tables and store factories now gives both `routes.json` and `surface.json`, the way `buildRoutes` evaluates today (an esbuild bundle imported once), so `surfaceRun`'s Vite SSR server goes. Its result is cached in `<root>/node_modules/.cache/keel/derived/` under k.check-cache's rule:

- **Key and probes.** The entry is named by the SHA-256 of the Keel version, the project's code file paths and the evaluation's inputs. The inputs are each file it loaded and the `package.json` of each package holding one, each with the SHA-256 of its bytes. An entry is used only when every recorded input, read again, has the same hash. Modification times are never read: a file rewritten with its old time is a miss (k.derived clause 16).
- **What can change the result and what is keyed are one set.** This is the lesson RFC 0251 records for approvals, and it is why the inputs are what the evaluation loaded, not a list Keel guesses: `surface.json`'s `sources` guessed "project files" and missed every package (cases 6 and 7). Until RFC 0251's evaluator lands, an evaluation could also read a file by path at import time (a package reading its own data file), which no load records; the cache would then miss nothing it could see but could keep a result that file changed. So slice 3 runs the evaluation in RFC 0251's `data` child, whose read access is exactly the bundle's files: a read outside them is refused (E1184), so the loaded set is the influencing set by construction.
- **Who writes.** The child reads and writes nothing else; it returns the route tables' data, the surface and the bundle's file list. Keel's own process, with the user's rights, writes the cache entry and the views through the one writer (`writeArtifact`: a `<name>.<pid>.tmp` file, mode 0444, renamed into place).

### 6. Concurrency
An editor's language server, a terminal `keel check`, `keel dev` and an agent's MCP calls can run together. No lock is taken: a stale lock left by a killed process would stop every later run, and two runs over one tree derive the same bytes. Each view is one atomic rename, so a reader sees a whole file. A run re-reads its inputs' hashes before it renames, and skips the write when one changed during the run, so a slow run cannot put an older tree's view over a newer one's. Nothing Keel judges reads a view, so a brief window where the views on disk describe different moments of the tree never changes a verdict. Two processes writing one cache entry: the last rename stands, as for the type cache.

### 7. Work, not milliseconds
The claim a test asserts is the work done, counted, because a wall-clock bound flakes on a shared machine (`docs/TESTING.md` bounds a test's time only through the watchdog, never as an assertion):
- **No input changed:** no evaluation runs and one cache entry is read per project; the compile runs as it does today.
- **An edit to a file the evaluation did not load** (a test file): no evaluation.
- **An edit to a file it loaded:** exactly one evaluation of that project, and the entry it writes records exactly the files the evaluation loaded.
- **The seam:** the json summary's `counts` (`refreshed`, `evaluated`, `cached`, on every run, 0 included) and the cache entry's `inputs` (k.derived Derivation cache). k.derived clauses 22 to 25 assert them.

What the counts cost, measured as documentation and not as a clause: on `apps/household` at a 1-minute load of 18, a warm compile of every source 31 ms and one route evaluation 257 ms (`buildRoutes`'s bundle; the surface rides the same evaluation once slice 3 lands), against 2.3 s for a warm `keel check`. Measured by a script that imported `artifactHashes`, `buildRoutes` and `surfaceRun` from this branch and timed each twice in one process with `performance.now()`, beside `/usr/bin/time` for the whole commands. A re-indent re-evaluates once and writes nothing (clause 17).

### 8. keel test, keel dev, keel ledger, scaffold
- `keel test` derives the compiled views in its own process before vitest starts, hands `a11y.json` to each test process (vitest's `provide` and `inject`), and refreshes the views unless frozen. A render with no `artifacts` then always runs E1702 against the tree under test, in a project never built too (clause 12), which today runs no E1702 when `.keel/a11y.json` is absent.
- `keel dev` refreshes every view after each change it applies, `routes.json` included (case 12), and its inspect document serves the plugin's derivation, so `keel check` beside a running dev server agrees with it by construction: both derive from the same files.
- `keel ledger` derives each project's `routes.json` (the cache makes a ledger after a check cost no evaluation) and finds projects as `keel check` does.
- A scaffold operation's refresh (k.scaffold Refresh) is this refresh; nothing changes in k.scaffold.

### 9. What an agent needs to know afterwards
Nothing. Edit, `keel check`, done: the result is about the tree. The lines to delete are in Docs and skills.

### Personas
- **A2, human and agent: how many commands from an edit to a verdict?** One, `keel check`. Today two, in an order an agent must remember, and E1005's message ("run keel build") names a cause the author did not touch. An agent following the diagnostics word for word spent a build per edit; now it spends nothing.
- **A7: does `keel test` after an edit test the edit?** Yes: E1702 runs against the derivation of the tree under test, a read-only checkout runs its tests (case 11), and a red test names its cause, never a file left from an earlier build.
- **A3: do two teams break each other, and does CI hold?** The committed record is the surface alone, so two pull requests touching different pages no longer conflict on it. CI derives the current surface whatever is committed, so a dependency bump that breaks stored states fails on E1563 (case 6), and a stale committed surface fails E1005 under the default frozen run. A merge of two fresh branches that is stale together is caught by the push run on the main line, which is frozen too.
- **A8: is the build a function of the tree?** Yes, more than before: `keel build` evaluates from the same cached derivation `keel check` used, and no input outside the evaluation's loaded set can change a view (slice 3 on RFC 0251's wall). Nothing environment-specific enters a committed file: no digest, no absolute path, no Node version.
- **F1: what does this cost to change later?** Little, by design. No new committed format: the views keep their bytes, `surface.json` loses a field. The cache is private to `node_modules/.cache` and can change shape in any release, since deleting it is always safe. The public surface added is one flag, one environment value, one trailer count and one warning code.
- **A6** reads `keel evidence` built from a ledger whose `a11y:` items now follow the routes the tree has, not the last build's.

## Alternatives
- **A watcher daemon** that rebuilds `.keel/` on every save. It needs a process that someone or something must start, keep alive and stop. An agent in a fresh shell has none running, so its check is as stale as today. Two daemons on one tree race, and a killed one leaves state that looks fresh. The project is checked by a command; the command should see the tree it is given. Rejected.
- **"Always build first", documented.** It is today's state, in the guide and in the `keel` skill. It costs a full build (7.6 to 11.8 s here) per edit, and it is exactly what the owner's question rules out: a rule an agent has to remember, which fails silently for the one that does not (cases 5 to 7 are green without it). Rejected.
- **A warning only** (W instead of E1005 for a stale view). Removes the wrong red and keeps every wrong green: the stale surface still feeds `--base`, and the stale `a11y.json` still feeds E1702. Rejected.
- **(a) alone: re-derive everything on every run, never cache.** Correct, and the fallback when `node_modules` is absent. As the default it adds 0.3 to 0.7 s of evaluation to every check, which breaks k.check's 1 s warm bound. Kept as the uncached path, rejected as the only path.
- **(b) a digest in every view, readers verify.** Faster than (a), but the digest is public (section 4), it pins machine-independent hashing into committed files forever (F1), and every dependency bump changes a committed file whose content did not change, which fails a bot's pull request under frozen CI. Rejected for committed files; adopted inside the private cache.
- **(c) no views on disk at all.** The compiled views have readers outside Keel: people opening `ids.json`, tools that read the dependency graph, the inspector when it is not running (principle 6 makes these tool endpoints). Keeping them as gitignored views costs one rename each when they change. Rejected; the committed set shrinks to the record.
- **Refresh in `keel check` only when `.keel/` already exists**, as k.scaffold Refresh does. A never-built project then has no views until a build, so tools that read them see nothing. Rejected for check; scaffold keeps its rule because a generator's refresh is part of an edit set, and the next check writes the views anyway.
- **Keep `surface.json`'s `sources` and the normal form.** They were the cheap staleness test that let check avoid evaluation. Check now evaluates from a cache whose key is exact, so they would only keep two pull requests conflicting and a formatter rule set to maintain. Rejected.

## Spec diff
Applied in this commit (`pnpm spec k.derived` prints it):
- New section k.derived (tools area, `proposed`): the definition, Derivations, Readers, Derivation cache, Refresh, Frozen, Version control, Time, Rules (E1005's frozen meaning, W1018), Conformance 1 to 22.
- k.compiler (`implemented`): Artifacts names k.derived and drops its own E1005 sentence; `routes.json` is derived by evaluating the route tables; Build-time evaluation errors fail `keel check` too; E1005 reworded (a view under Frozen, a file no derivation writes, `turbo.json`, CI workflows, API schemas; the bytes-only fix kept); W1005 reserved. Clauses: "Changing any byte ..." and "A compared `.keel/` artifact ..." under `keel check --frozen`; the literal-`routes.ts` and std-health clauses rewritten for the derived `routes.json`.
- k.compat (`implemented`): Surface is a derived file, `version: 3`, no `sources`, the example without it; a throwing contract is E1006 at check and build; the Sources paragraph removed; Base compares with the derived current surface and reads versions 2 and 3. Clauses: the changed-byte clause under `--frozen`; the E1006 clause at check and build; the three normal-form clauses replaced by two (a page edit leaves frozen check clean; E1563 with no `surface.json` present).
- k.check (stays `conformance-covered`, wording only): step 3 says the rules get the project's derived artifacts; step 4's sort note drops W1005. 3,097 tokens.
- k.a11y (`implemented`): Artifacts takes the derived `a11y.json`; Claims reads each project's derived `routes.json`. 3,092 tokens.
- k.ledger: the `a11y` order by project directory; W1731 on the derived `routes.json`, reported at `.keel/routes.json`; two clauses state route tables instead of a `.keel/routes.json` fixture.
- k.deploy, k.shell, std.tauri (`implemented`): deploy files are views; their changed-byte clauses under `keel check --frozen` (k.deploy's adds the rewrite by `keel check`). k.shell's Files sentence points to k.deploy for E1005, which keeps it at 3,092 tokens.
- k.library-pack (`implemented`): `keel pack --check` becomes `keel pack` run frozen (`--frozen`, or `CI` set); the scaffolded `prepack` runs `keel pack --frozen`; the frozen ledger messages; its last clause adds `keel pack` with `CI=true`. 3,083 tokens.
- k.contract (`implemented`): Static reading reports E1111 alone at a spread, call or name; W1005 is reserved and no clause requires it. The clauses of k.scaffold and std.contracts that assert no W1005 stay true and are unchanged.
- `spec/areas/tools.md`: the k.derived row. Glossary: `derived file`.

## Conformance diff
For the `conformance-writer`, from the spec text only:
- `packages/cli/conformance/derived.test.ts` (new): k.derived 1 to 21, over copies of `examples/client-only-api` and `apps/household` made by the suite's linked-project helper, the household case of clauses 9 and 16 with a linked copy of `@keel/std-text` outside `node_modules` (a copy inside `node_modules` does not load: Node strips no types there). Clause 13 through the LSP harness the k.cli suite uses. Clause 18 starts `keel dev` on a free port and stops it in `afterAll`.
- `packages/cli/conformance/derived-time.test.ts`: replaced by cases of k.derived 22 to 25 on the json `counts` and the cache entry's `inputs`; no case asserts a duration.
- `packages/compiler/conformance/` (k.compiler): the changed-byte, recomputed-hash, literal-`routes.ts` and std-health clauses pass `--frozen` and assert the rewrite without it.
- `packages/check/conformance/` or `packages/cli/conformance/` (k.compat, wherever its clauses live): the changed-byte clause with `--frozen`; E1006 at check; the three normal-form clauses removed; the two new ones added.
- k.a11y: no clause text changes; the suites that build a `.keel/a11y.json` fixture by hand keep passing because a render takes the derivation, and the writer checks each still asserts what its clause says.
- k.ledger: the two route-table clauses build a project with a `routes.ts` instead of a `.keel/routes.json` file.
- k.deploy, k.shell, std.tauri: the changed-byte clauses pass `--frozen`.
- From the conformance-writer's gaps, settled in k.derived: clause 1 adds a page route (an API entry in a `client`-only app is E1511), so clauses 1, 4 and 13 change; clause 3 reads `counts.refreshed`; clause 19 uses a one-route fixture, not household's suite; clause 22's durations become clauses 22 to 25 on the json counts and the cache entry's `inputs`; clause 26 states row 9 (tokens: E1804 at once, no view written); clause 27 states `check()` in process (writes nothing; a differing compiled view is E1005; an evaluated view only against `derived`).
- `packages/check/conformance/diag-message-fit.test.ts`: W1018 is a command code, not in `reportedCodes()` (k.derived Rules); its fixture is k.derived clause 8.
- `packages/compiler/conformance/static-reading-w1005.test.ts` and the W1005 half of `route-fragment-spread-0077.test.ts`: removed, since no clause requires W1005; the E1111 half in `packages/check/conformance/static-reading-e1111.test.ts` stays.
- `packages/cli/conformance/boundary-build-gate.test.ts`, "a warning does not stop `keel build`": the fixture gets its warning from W1012, an `index.html` in the project root (k.head Document source), which `keel check` reports and `keel build` keeps going past.
- `packages/cli/conformance/` for k.library-pack: the three `--check` clauses read `--frozen`, and the last also runs `keel pack` with `CI=true`.
- Not conformance, updated by the build: `packages/cli/test/appArtifactsFresh.test.ts` asserts `keel check --frozen` clean and `keel test` writing nothing in a frozen run; `packages/cli/test/scaffold-refresh.test.ts` unchanged.

## Build plan
Each slice: spec text is in; the conformance-writer writes the slice's clauses first; then the build.
1. **Readers and the writer.** Builder notes: the json summary's `counts.refreshed`, `evaluated` and `cached` are written on every run; `check()` takes a `derived` option and never writes; W1018 is printed by the CLI layer, outside `reportedCodes()`.  `check()` takes the derivation for the compiled views (one compile per project, not two); E1005 only frozen; W1018; the trailer count; `--frozen`, `CI`, `KEEL_FROZEN`; the Vite plugin's writes through W1018 and `KEEL_FROZEN`, and no write failure ends a run (case 11); `keel test` derives `a11y.json` and hands it over; LSP writes nothing. Clauses 2, 3, 6, 7, 8, 11 to 14, 20, 26, 27; k.library-pack's frozen pack. Deletes `expectedHashes`' second compile.
2. **Version control and deploy files.** Deploy files refreshed by check; the scaffold `.gitignore`; the repository's apps and examples stop tracking the compiled views (`git rm --cached`, one commit, the ledger regenerated on the main line after it). `appArtifactsFresh` rewritten. Clause 21 and the deploy clauses.
3. **One evaluation, cached, behind the wall.** `routes.json` and `surface.json` from one bundle evaluated in RFC 0251's `data` child (`evaluate({ kind: 'data' })`); the derivation cache; `surface.json` version 3; k.compat's normal form deleted (`sourceHash`, `staleSource`); `--base` on the derivation; `keel ledger` and dev inspect on the derivation; dev refreshes `routes.json`. Clauses 1, 4, 5, 9, 10, 15 to 19, 22 to 25. **Waits for RFC 0251's evaluator child** (`lane-r-boundary`) and builds no second one; until it merges, slices 1, 2 and 4 land and the evaluated views keep their current writers.
4. **Docs and skills** (below), with the build that makes each sentence true.

## Docs and skills
Within their targets; each edit shortens or keeps the length:
- `packages/cli/skills/keel/SKILL.md` and `.claude/skills/keel/SKILL.md` line 44: delete "(E1005 on `.keel/` files after an edit until `keel build` runs)". The command list then reads `keel check` · `keel test` · .... The skill's description keeps E1005 among its codes: it still exists, frozen.
- `packages/cli/skills/keel-testing/SKILL.md` and the `.claude` copy, line 40: "Without `artifacts` a render takes `.keel/a11y.json` and `tokens.ts`" becomes "Without `artifacts` a render takes the tree's `a11y.json` and `tokens.ts`".
- `docs/guide/build-golden-1.md` section 4: the table's "Written by" column says "derived by every `keel` command"; the paragraph after it loses "A project with no `.keel/` yet checks clean; once a build or test run has written it, editing a source makes `keel check` report E1005 for each stale artifact before your real error. Run `keel build` before `keel check` after edits." and gains one sentence on what is committed; the E1005 row of its code table says "a committed `.keel/surface.json` or deploy file that CI found stale; run `keel check` and commit it".
- `docs/OUTPUT.md`: the warning examples list W1005; swap it for W1018; the summary's `counts` of `keel check` hold `refreshed`, `evaluated` and `cached`.
- `@keel/scaffold`'s `opProject.ts` comment and `.gitignore` template; `apps/*/README.md` lines that say `keel build` writes the `.keel/` artifacts say every `keel` command keeps them.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1005's text, W1018's entry, W1568's message ("names no surface of version 2 or 3").

## Codes
W1018 is new (free on every `lane-*` branch and the main line, checked over `spec/`, `packages/`, `tooling/` and `docs/rfc/`). E1005 keeps its number with the frozen meaning. W1005 is reserved and not reused.

## Budgets proposed (not edited)
- `@keel/cli`: the refresh and the frozen switch are in the check path already loaded; the derivation cache is a few hundred bytes of code. Expect under 1 kB; re-base if over.
- `@keel/compiler`: `surfaceRun` leaves the CLI for the evaluation entry; the Vite SSR server code it used goes. Expect a net decrease of the CLI.
- No token limit moves: k.derived is about 2,730 tokens of 3,100, the tools area gains one row within its 500, and every amended section is at or under its previous size but k.ledger (+5 characters).

## Migration
None before P1. The repository's own apps and examples are updated in slice 2. A version 2 `surface.json` on a base branch is read by `--base` as before.

## Token impact
| what | before | after |
| --- | --- | --- |
| k.derived (new) | none | about 2,730 tokens |
| k.compat | 2,492 | 1,632 (the Sources paragraph and three clauses go) |
| k.compiler | 1,725 | 1,700 |
| k.check, k.a11y, k.shell, k.library-pack | 3,098, 3,095, 3,099, 3,078 | 3,097, 3,092, 3,092, 3,083 |
| the `keel` skill | its Commands line | 15 tokens shorter |
| an agent's loop per edit | `keel build` (8 to 12 s here, and its output) then `keel check` | `keel check` |

## For the operator
Items 1 to 3 were taken by the orchestrator as recommended; item 4 was decided otherwise, as it says.

1. **The compiled views leave version control** (D6): `git rm --cached` of `a11y.json`, `ids.json`, `deps.json`, `styles.json`, `std.json` and `routes.json` in every app and example. Recommended: nothing reads them, and the lane rules' "generated files in conflict take either side" step goes with them. If you want them kept, the design holds unchanged: frozen CI then checks them too, at no extra cost.
2. **`CI` turns frozen on** (D3). Recommended, as pnpm does; a hand-written pipeline gets the guarantee without knowing the flag. The alternative is `--frozen` in the generated workflow only.
3. **`keel pack --check` becomes `keel pack --frozen`**, so the one idea has one name (principle 1). Recommended; it is one flag in k.library-pack and its clauses, done in slice 2.
4. **Slice 3 waits on RFC 0251's evaluator.** Decided by the orchestrator: it waits, and builds no second child.

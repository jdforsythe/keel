# RFC 0247: start a Keel project from an empty folder with one command

Status: accepted by the orchestrator on 2026-11-26 with For the operator 1 to 4 as recommended (ADR-0292). New section k.create; amends k.scaffold (the `project` generator, Conformance), k.explain (Agent files), the map. From W17, "The end user's seat" in `tasks/p1/TODO.md`: two hands-on reviews found that starting from an empty folder is the weakest five minutes.

## Decisions
- D1: the command is `pnpm create @keel/app [folder] [flags]`, which runs the package `@keel/create-app`. npm, yarn and bun run the same package: `npm create @keel/app [folder] -- [flags]`, `yarn create @keel/app`, `bun create @keel/app`. The binary `keel` is run through the project (`pnpm keel ...`); the docs recommend against a global install.
- D2: zero questions. It reads no standard input, with or without a terminal. Every choice is a flag with a default, no flag is required, and the output is docs/OUTPUT.md's.
- D3: three app kinds by the one flag the scaffold already has, `--adapter client|node|static` (default `client`), and a library by `--library <@scope/name>` in the same package. Shells, a data battery and sign-in are not flags: each is one `keel scaffold` or `pnpm add` step after.
- D4: one source of truth. `@keel/scaffold/create` holds `createPlan`, pure; `@keel/create-app` is a bin over it and depends on `@keel/scaffold` at exactly its own version. The tree it writes equals `keel scaffold project` of a `@keel/cli` at the same version, byte for byte.
- D5: an app pins every `@keel/*` package at exactly the creating version; `engines.node` is `>=22.15`.
- D6: the generator `project` gains the home route `app.home` at `/`, a page that shows the project name, and its route test. A fresh project passes `keel check`, `keel test` (one real test) and `keel build`.
- D7: the agent files are copied, not referenced: `AGENTS.md` with the Keel block, `CLAUDE.md` holding `@AGENTS.md`, and a copy of every published skill under `.claude/skills/`. `@keel/create-app` ships the skills of its version. On an upgrade `keel check` reports W1356 for each stale copy and `keel docs --sync` rewrites them.
- D8: the command writes files and prints the next commands. It runs no install, no `git init`, no process and opens no connection. It refuses a non-empty folder unless `--existing`, and never replaces a file.
- D9: the package manager comes from `npm_config_user_agent` and is written as `packageManager`; the generated CI workflow installs with that manager.
- D10: inside a workspace the app has no `turbo.json`, CI workflow or `packageManager`, and a second Keel version in the workspace is refused.
- D11: codes E1360 to E1363, W1364 and E1365 in the scaffold block; names reuse E1352, flags E1052, links E1357.
- D12: no new glossary term.

## Problem
A person or an agent with an empty folder has no documented way in. The A2 review (`tasks/p1/end-user-review.md`) found no install path at all: `pnpm add <kit>/keel-cli-0.0.0.tgz` fails because the tarball's dependencies are on no registry, and nothing existed for the npm flow. `keel scaffold project` exists, but it is a command of `@keel/cli`, which must already be installed somewhere to run it. Installing `@keel/cli` globally to get it is the wrong answer: another product ships a global `keel` binary, and a global Keel drifts from the project's.

What `keel scaffold project` writes today has three holes for a first run. Its module `app` holds no route, so `keel dev` serves no page and `keel test` runs no test. A standalone project gets `^0.0.0` ranges, so two installs on two days can differ. `keel scaffold library` writes no agent files and no `.gitignore` (the L1 review's finding), so an agent in a new library folder starts blind.

The agent form is the strict test. An agent cannot answer a prompt, reads only what a command prints and the files it wrote, and will run whatever command the output names. So the command must ask nothing, print the files and the next commands, and never name a command that fetches something the project did not ask for.

## Personas
- **A1, a static site builder: does an app with no server carry no server code, config or vocabulary?** Mostly yes. The default `client` app, and `--adapter static`, write no `*.server.ts` file, no `deploy/` folder, no Dockerfile, no `KEEL_SECRET`, no `createApp` and no identity file; the CI workflow builds and uploads `dist/web/`. One server word remains: `topology.ts` imports `topology` from `@keel/server`, so `package.json` lists it. That is W17's paper cut "a no-server app importing `@keel/server`", owned by that line, not by this RFC; when `topology` moves to a package with no server in its name, k.create's no-server clause gains `@keel/server` as one more name a client project never holds (For the operator 3).
- **A2, a product engineer: how many commands and concepts from an empty folder to a deployed page?** To a page in a browser, three commands: `pnpm create @keel/app shop`, `pnpm install` (after `cd shop`), `pnpm keel dev`. To a deployed `client` page, four: create, install, `pnpm keel build`, then the static host's upload of `dist/web/`. To a deployed `node` page, five: create with `--adapter node`, install, build, `docker build -f deploy/web/Dockerfile .`, and the run with `PORT`, `KEEL_SECRET` and `KEEL_ORIGIN` (k.deploy). Concepts before the first page: a module (`modules/app/`), a route (`app.home` at `/`), a deployable (`topology.ts`, `web`) and its adapter. The home page names the file to edit and `keel docs`.
- **L1, L5, library authors: `--library` or `@keel/create-library`?** `--library` in the one package. A second package doubles what is published, pinned, smoked and trusted from the registry for one flag's difference, and the shared runner would need a third home. The name `app` reads oddly before `--library`; the docs and the keel-library skill show the line whole: `pnpm create @keel/app charts --library @acme/charts`. A library's `@keel/*` stay ranges (`^<version>`), as k.library-pack Scaffold says, since a library serves apps on several versions. The library gets `.gitignore` and the agent files, with the block saying it is a library and listing `keel-library` first.
- **K9, an embedded piece: can Keel be adopted for one corner of a product?** Inside an existing workspace `pnpm create @keel/app apps/widget` writes a workspace package: no `turbo.json`, no CI workflow of its own and no `packageManager`, since the root owns its task runner, CI and manager. A folder the root's globs leave out gets W1364 with the fix. A workspace that already holds another Keel version is E1363, because two Keels in one install would give two kernels to one app. Embedding the built page in a page Keel does not own is W17's K9 review and guide, not this command.
- **The agent form of each.** The output lists every written path and the next commands in order, so an agent needs no other read to proceed. `AGENTS.md` and the skill copies are on disk before any install, so the first read works offline. Every refusal is one diagnostic with a code and a fix sentence, and exit codes follow k.cli.

## Proposal
### The command and what it never asks
`create-app` reads no standard input and prompts for nothing, terminal or not. A wizard was rejected (Alternatives). Each choice is a flag:

| flag | default | why it has that default |
| --- | --- | --- |
| `[folder]` | `.` | an empty folder is where the docs start: `mkdir shop && cd shop && pnpm create @keel/app` |
| `--adapter client\|node\|static` | `client` | the scaffold's default and the smallest app; A1 needs nothing more, A2 adds `node` |
| `--library <@scope/name>` | none | a library needs a scoped name, so it cannot default |
| `--name <name>` | the folder's name | a folder named for its project is the common case |
| `--existing` | off | a non-empty folder is the likeliest mistake |
| `--dry-run` | off | an agent can read the plan first |

`--format`, `--quiet` and `--limit` are k.cli's. Exit codes are k.cli's: 0, 1 for a refusal, 2 for a usage error.

### Kinds, and what is left to `keel scaffold`
Three app kinds and a library. A native shell is `pnpm keel scaffold shell tauri --id com.acme.shop`; app data is `pnpm add @keel/std-postgres` and the keel-data skill; sign-in is an identity source the app opts into (k.user). None is a flag here, for three reasons. Each is opt-in (the plan's D103: an app that has not opted in carries no config and no bytes for it), and a flag at create time is a choice made before the person knows they need it. Each flag multiplies the kinds the kit proof must build and run. And each is already one command after, with its own checks, so a flag here would be a second way to do it (PRINCIPLES 1).

### One source of truth
```
@keel/create-app  --depends on, exact version-->  @keel/scaffold  (createPlan in ./create; project, route, library)
@keel/cli         --depends on---------------->   @keel/scaffold
```
`createPlan` takes the flags, the folder's listing, the ancestor files the workspace rule reads, the Node version and the user agent, and returns the files and records. It is pure, like `scaffold`, so `--dry-run` is the plan printed. The bin reads the inputs, makes the folders, creates each file exclusively and prints. `keel scaffold project` calls the same generators with the same inputs (the cli reads the same environment), so the two trees are byte-equal; k.create's conformance asserts it. No `@keel/*` package depends on `@keel/create-app`, and a project does not list it.

The version pinned is create's own: `@keel/create-app@0.4.2` writes `"@keel/cli": "0.4.2"` and every other `@keel/*` at `0.4.2`. `pnpm create @keel/app` takes the registry's latest; `pnpm create @keel/app@0.4.2` makes an older one, which is E1363's fix.

`@keel/create-app` ships `skills/<name>/SKILL.md`, copied from `packages/cli/skills/` by its `prepack` step, so the agent files are written before any install. A conformance clause holds them byte-equal to `@keel/cli`'s at the same version.

### Files per kind
`project` writes 13 files for `client` and `static` and 15 for `node` (what `scaffold project` writes today); `route app.home` adds 2, and 3 on `node`; the agent files are 11 with today's nine skills. A library is `library`'s 10, `.gitignore` and the 11 agent files.

| kind | count | files beyond `client`'s |
| --- | --- | --- |
| `client` (default) | 26 | none |
| `static` | 26 | none; `adapter: "static"` |
| `node` | 29 | `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile`, `deploy/compose.yaml` |
| `--library` | 22 | the library layout at the folder's root |

A yarn project adds `.yarnrc.yml`. A workspace app drops `turbo.json` and `.github/workflows/ci.yml`. k.create Files lists every path.

The home page renders the project name as the heading `app.home.title` and a paragraph `app.home.next` naming `modules/app/HomePage.tsx` and `keel docs`, on the `brandTokens` the project's `tokens.ts` exports (docs/BRAND.md). Its route test renders `app.home`, expects the heading's text and runs `a11y()`, so the first `keel test` is a real test of the page a person sees.

### The agent files
An agent in a new project needs, on its first read and before any install: what Keel is, which commands to run, the rules every file follows, and where the skills are. `AGENTS.md`'s Keel block (k.explain, at most 600 tokens) holds that, `CLAUDE.md` points at it, and the skill copies are where Claude Code loads skills from; other agents read `AGENTS.md`, which lists each copy's path. Referencing the skills instead (a line saying "run `keel docs keel-client`") was rejected: it fails before the install and costs every agent a command per skill.

Staying current is the mechanism that exists: after `pnpm up @keel/cli`, `keel check` reports W1356 for every copy or block `keel docs --sync` would change, and `keel docs --sync` rewrites them from the installed `@keel/cli`. The upgrade docs (keel-deploy's and the README's upgrade line) name `keel docs --sync` as the step after an upgrade.

`keel scaffold library` gains the agent files and `.gitignore` too, so both doors write one library. In a library folder the block's first sentence says it is a Keel library and `keel-library` is the first skill listed.

### The first five minutes
After the files, create prints `create.next` records in order:
```
next cd shop
next git init
next pnpm install
next pnpm keel dev
next pnpm keel check
next pnpm keel test
next pnpm keel build
ok create shop client 26 created
```
`git init` is printed only when no `.git` is at or above the folder. A library's list ends `keel check`, `keel test`, `keel pack`: a fresh library holds no `.keel/ledger.json`, so `keel pack --check` is E1164 until `keel pack` writes it (k.library-pack). Each line is a command the person or agent can run as written; none fetches a package the install did not.

What proves a fresh project passes, for every kind: a new smoke, `tooling/smoke/create.mjs`, over the packed kit. The kit is `evals/public/pack.ts` (`pnpm eval:public pack --out <dir>`), which packs every package's tarball with `publishConfig` exports and real versions. The smoke installs the kit's `@keel/create-app` in a bootstrap folder (`evals/public/project.ts` does this for `@keel/cli`), runs its bin in four empty folders under `$TMPDIR` (`client`, `static`, `node`, `--library`), adds one `pnpm-workspace.yaml` of `overrides` pointing each `@keel/*` at its tarball, which stands in for the registry until the packages are published, then runs the printed install, `keel check`, `keel test`, `keel build` (`keel pack`, then `keel pack --check`, for the library) and `keel docs --sync`, which must write nothing. The `node` kind's `dist/web/server.mjs` is started on a free port and `GET /` must answer 200 with the project name. CI runs it in a `create-kit` job; W12's clean-runner job runs the same smoke against the registry after the first publish.

### End-to-end: a dependency on RFC 0244
RFC 0244's `keel test --e2e` is written and built in `lane-r-e2e`, not merged. When it merges, slice 4 adds to `project`: `test/home.e2e.ts`, which opens `/` and expects the heading; `playwright-core` at 0244's pinned version in `devDependencies`; `keel test --e2e` in the CI workflow after the browser install step; and a `next pnpm keel test --e2e` record. Its first run without a browser is E1734, whose fix is the one browser install, so `keel test` stays green with no browser. The smoke's `GET /` check is then replaced by the e2e run.

### Safety and trust
`pnpm create` runs code from the registry on the developer's machine. What `create-app` does: it reads the folder's listing, the Node version, three environment values (`npm_config_user_agent`, `KEEL_AGENT`, `CI`) and, above the folder, only `pnpm-workspace.yaml`, `package.json` and `node_modules/@keel/cli/package.json`; it creates files inside the folder. What it does not do: start a process (no install, no `git init`, no package manager), open a connection, read any other environment value, write outside the folder, or replace a file. A conformance clause runs it under Node's permission model with writes allowed only in the folder and no child process or worker granted; from Node 25 the same run has no network grant.

Its install closure adds nothing the project will not install a minute later: every package of `@keel/create-app`'s closure is in the closure of the project it creates (`@keel/scaffold` and its dependencies are `@keel/cli`'s). So trusting create is trusting the Keel version the project pins, under the lockfile's integrity values, and nothing more.

RFC 0251 (`lane-r-boundary`, the trust boundary) sets what a project approves. A fresh project lists only kernel-set packages, which the compiler's list pins, so it approves nothing and holds no `keel-grants.json`; only `keel grants --approve` writes that file (k.approvals). On day one, approving means nothing yet: the first approval arrives with the first installed library that holds a `./tools` or an `unsafe` call, and `keel grants` then shows it. When 0251 merges, slice 4 adds a k.create clause: in a fresh project of each kind `keel grants` emits no `grant` record and exits 0, and no `keel-grants.json` exists. `@keel/create-app` is never judged by the boundary: it runs before there is a project, and it is no project's dependency.

### Package manager, lockfile, Node
The manager is the first word of `npm_config_user_agent`, which pnpm, npm, yarn and bun each set when they run a create package. It decides the printed commands and `packageManager` (`"pnpm@11.17.0"`). The generated CI workflow reads `packageManager` and installs with that manager's frozen form, watching its lockfile among the shared paths; with no field it is pnpm's, the workflow every project has today. npm runs Keel as `npx --no keel`, since a plain `npx keel` before the install would fetch the unrelated `keel` package. Yarn gets `nodeLinker: node-modules` because the checker, `keel docs` and k.docs Resolution read `node_modules`. No lockfile is written: the first install writes it and CI refuses a changed one. With corepack enabled, `packageManager: "bun@..."` is a corepack error; corepack is off by default and leaves Node from 25, so the field is written for bun too.

The Node floor is 22.15, RFC 0251's decision (its loader hook needs `module.registerHooks`): `@keel/create-app`'s `engines` and the app's `engines.node` say `>=22.15`, and create refuses an older Node with E1362 before anything else, because pnpm and npm only warn on `engines`.

### Monorepo use
k.create Workspace. The rule for a second Keel is E1363 rather than a warning: two `@keel/cli` versions in one install give one app two compilers and two kernels, and the fix is one command. Detection reads `node_modules/@keel/cli` resolved from the target's parent, which finds a hoisted copy (npm, yarn, bun, and pnpm with the root depending on it); a pnpm workspace where only a sibling app lists `@keel/cli` is not seen, a limit stated here and in the ADR.

### Names
The project name is `--name`, else the folder's last segment. It is `[a-z][a-z0-9-]*` (k.scaffold's rule for `project`), at most 64 characters, and not the name of a dependency the project lists, because npm refuses to install a package that depends on its own name. The fix suggests the name lowercased with each run of other characters as one `-`: `My Site` gives `--name my-site`. A library's name is `@<scope>/<base>` as k.library-pack Scaffold requires. No glossary term is new: the kinds are k.topology's adapters and k.library's library, and "kind" is this RFC's word, not the spec's.

### Diagnostics
The block E1350 to E1399 is k.scaffold's (the map's code ranges). Every `lane-*` branch and the main line were searched (`git grep` over each branch): the highest code in it anywhere is E1359. New codes, each with its fix sentence:

| code | when | fix |
| --- | --- | --- |
| E1360 | the folder holds an entry other than `.git`, `.DS_Store`, `Thumbs.db` | name a new folder, or add `--existing` |
| E1361 | with `--existing`, a path the project writes exists | move it aside, or use a new folder |
| E1362 | Node older than 22.15 | install Node 22.15 or later |
| E1363 | the workspace's `@keel/cli` is another version | `pnpm create @keel/app@<that version> <folder>` |
| W1364 | the workspace's package globs leave the folder out | add the folder to the root's globs |
| E1365 | a write failed; this run's files are removed | free the path or its permission |

Reused: E1352 for a name, E1052 for flags (`--adapter` with `--library`, a second folder, an unknown flag), E1357 for a write a link carries out of the folder. Messages stay within 89 characters and name the fix, since before the install there is no `keel explain`; the explain table gets each row when it is built.

## Alternatives
- **The unscoped `create-keel` (`pnpm create keel`).** Rejected, as the owner decided. Only the `@keel` organization can publish under the scope, so a look-alike cannot pass as Keel's, and an agent that guesses the name lands on Keel's own package or on nothing. Under an unscoped name, any account could hold `create-keel` or a near spelling of it.
- **A global `keel new`.** Rejected. Another product's global `keel` is on many PATHs; a global Keel drifts from each project's pinned one; and a global install is the step the docs recommend against.
- **`degit`-style templates (a copied git folder).** Rejected. A template is a second source of truth beside `@keel/scaffold`, it drifts the day a generator changes, it carries no version pin and no agent files of its version, and it fetches from a git host the package manager does not pin.
- **A wizard.** Rejected. An agent cannot answer a prompt, a prompt under no terminal hangs or guesses, and every question is a choice made before the person knows it matters. Flags with defaults give the same choices to both forms.
- **Running the install and `git init`.** Rejected for now (For the operator 2). It would save one command, but create would start the package manager, and its scripts, from inside a registry package, and an install in a workspace member is the root's to run.
- **`@keel/create-library`.** Rejected in L1, L5's answer: a second registry package for one flag.
- **Removing `keel scaffold project`.** Rejected: it is the MCP `scaffold` tool's `project` and the evals' path. It stays the same generator with the same tree, and the docs teach `pnpm create @keel/app` for an empty folder.

## Spec diff
Applied in this commit.
- New `spec/kernel/k.create.md`, status `proposed`: the package, flags, files, versions, package manager, workspace, folder, names, what it does not do, next records, Rules (E1360 to E1363, W1364, E1365) and 22 Conformance clauses.
- k.create, the build's corrections: Package gives `createPlan`'s input and result as a signature (`version`, `nodeVersion` and `skills` inputs; `files` keyed from the folder; W1364 a `diag` record) and the bin's path `src/bin.ts`; Not done names its proof, the permission-model run; Next ends a library's list with `keel pack`, since `keel pack --check` is E1164 in a fresh library; the Conformance clauses are numbered, clause 11 is for a user whom file modes bind, and clause 22 runs `keel pack` and then `keel pack --check` for the library.
- k.explain Conformance: three clauses for the library's agent files, its block and W1356 there.
- k.scaffold: the `project` bullet gains the home route, its page and test, the exact version and k.create's Versions, Package manager and Workspace rules; one Conformance clause (the home route and its passing test).
- k.explain Agent files: the library block and `keel scaffold library`'s agent files.
- `spec/areas/tools.md`: the row `| k.create | `pnpm create @keel/app`: flags, files per kind, package manager, workspace, E1360 to E1365 |`; `pnpm spec --for E1360` finds the section by its Rules.
- `tooling/docs-owners.json`: `k.create` owned by `@keel/scaffold`, which holds `createPlan` and packs the section, so `keel docs k.create` works in every project.

## Conformance diff
The conformance-writer writes from k.create, k.scaffold and k.explain's text alone:
- `packages/scaffold/conformance/create-plan.test.ts`: `createPlan` over in-memory folders, the clauses on files per kind, the tree equal to `keel scaffold project`'s, versions, names, E1362 given Node 22.14.0, package manager by user agent, the workspace rule (W1364, E1363, `dir`), `--existing` and E1361, the no-server clause.
- `packages/create-app/conformance/create-bin.test.ts`: the bin as a child process in folders under `$TMPDIR`: the open-pipe standard input, no argument, E1360, E1365 with a read-only folder, E1052 and exit 2, compact, json and `--dry-run` output, the permission-model run, the skill copies' bytes.
- `packages/scaffold/conformance/project-home.test.ts`: k.scaffold's new clause.
- `packages/cli/conformance/agent-files-library.test.ts`: k.explain's library block and `keel scaffold library`'s agent files, W1356 and `--sync` there.
- After the build's corrections, to re-quote: k.create clauses 11 and 22, and Package's input (`create-plan-support.ts` passes `skills`, the names in `packages/cli/skills/` read as `AgentSkill`s); `create-plan.test.ts`'s library list ends `pnpm keel pack`; `agent-files-library.test.ts` quotes k.explain's three new clauses.
- The kit clause is `tooling/smoke/create.mjs`, which the conformance file cites by clause text; it is a smoke, not a conformance file, because it needs the packed kit.

## Migration
None. No migration notes for unreleased changes. Projects and apps in the repo that `keel scaffold project` made keep their files; the evals' fresh projects gain the home route.

## Token impact
k.create about 2,750 of 3,100 tokens. k.scaffold 2,638 to about 2,735; k.explain 730 to about 780. The area row adds one line to `pnpm spec tools` and one entry to `keel docs tools`; `spec.map` and `docs.map` are unchanged and within their limits. New output: a default create prints about 40 lines, about 300 tokens.

## Build plan
1. `@keel/scaffold`: `project` gains `version`, the home route and page through `route`, `engines`, `packageManager` and the workspace input; `library` gains `.gitignore`; the CI workflow's install per manager; the `./create` entry with `createPlan`. `@keel/cli`: `keel scaffold project` passes its version, user agent and workspace reading; `keel scaffold library` adds the agent files; the library block. The explain rows for E1360 to E1365.
2. `@keel/create-app`: the package, its bin, `engines`, the `prepack` copy of the skills, the exclusive writes and their removal on failure, the printer (`scaffold.edit`, `create.next`, the trailer) in OUTPUT.md's three formats.
3. `tooling/smoke/create.mjs` over the kit, its CI job, `evals/public/pack.ts` packing `@keel/create-app`, and `evals/public/project.ts` creating through it.
4. After RFC 0244 merges: the e2e file, `playwright-core`, the CI step and the next record. After RFC 0251 merges: the `keel grants` clause and the `engines` floor across the repo.

## Docs and skills to update
Each within its target (docs-check's skill targets, `docs.section`): the root README's start (`pnpm create @keel/app`, the three commands, no global install); the keel skill's commands line; keel-library (start with `--library`); keel-deploy (`packageManager` and the CI install, `keel docs --sync` after an upgrade); docs/OUTPUT.md (the `create.next` kind); `packages/scaffold/README.md` (the `./create` entry, `project`'s new inputs) and a new `packages/create-app/README.md`; `tasks/p1/TODO.md` W17's install-path line.

## Budgets (proposed; `tooling/budgets.json` is not edited here)
- `@keel/create-app`: 2kb, `platform: "node"` (a bin: argument parsing, writes, printing).
- `@keel/scaffold/create`: 4kb, `platform: "node"` (the plan, the workspace and name rules, the manager table).
- `@keel/scaffold`: re-based by what the home route and the manager table add, recorded at the build.
- Output: `create.default` 400 tokens, the compact output of `create-app shop` in an empty folder.

## Dependencies on other lanes
- `lane-r-e2e` (RFC 0244): the e2e test of slice 4.
- `lane-r-boundary` (RFC 0251): the Node floor and the grants clause of slice 4.
- W17's paper cuts line: `topology` from a package with no server in its name, after which A1's clause names `@keel/server` too.

## For the operator
1. `--library` in `@keel/create-app` rather than `@keel/create-library`. Recommended: one registry package to trust and smoke. To reverse, a second thin bin over the same `createPlan`.
2. Print the install and `git init` rather than run them. Recommended: create starts no process and its plan is pure. To reverse, a run of the printed install after the write, with its exit code in the trailer.
3. A1's last server word: `topology` from `@keel/server`. Recommended: move it with W17's paper cut before 1.0, so a `client` project lists no server package.
4. Exact `@keel/*` versions in an app, against today's `^0.0.0`. Recommended: one Keel per project, changed by an upgrade the person runs.

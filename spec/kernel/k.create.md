# k.create: Create a project
status: implemented
`pnpm create @keel/app [folder] [flags]` starts a Keel project from an empty folder. The package manager runs the package `@keel/create-app`; `npm create @keel/app [folder] -- [flags]`, `yarn create @keel/app` and `bun create @keel/app` run the same package. It runs the k.scaffold generators through `@keel/scaffold`, writes the result and prints what to run next. It asks nothing.
```sh
pnpm create @keel/app shop
pnpm create @keel/app shop --adapter node
pnpm create @keel/app charts --library @acme/charts
```

**Package.** `@keel/create-app` has one bin, `create-app`, at `src/bin.ts`, published as one file, `dist/bin.js`, bundling `@keel/scaffold/create` of its own version: no dependency, no install script. `@keel/scaffold/create` exports `createPlan`, pure, from the templates alone (no parser, compiler or native addon); the bin reads its inputs, writes and prints:
```ts
createPlan(input: {
  version: string; nodeVersion: string; skills: readonly AgentSkill[]; // create's, the running Node's, its skills
  folder?: string; name?: string; adapter?: 'client' | 'node' | 'static'; library?: string; existing?: boolean; // the flags
  listing?: readonly string[]; // every entry under the folder, relative, a folder ending in '/'
  ancestors?: Readonly<Record<string, string>>; // Workspace's files above the folder, keyed from the working folder
  realPath?: string; gitAbove?: boolean; userAgent?: string; // its real path, a `.git` at or above it, npm_config_user_agent
  cwd?: string; caseless?: boolean; // the working folder's real path; the folder's file system ignores case
}): Result<{ files: Map<string, string>; records: readonly CreateRecord[] }, ScaffoldError>
```
`files` are keyed from the folder; a `CreateRecord` is one of Next's, W1364 a `diag` between edits and `create.next` records. No `@keel/*` package depends on `@keel/create-app` and a created project does not list it. It ships `skills/<name>/SKILL.md`, byte-equal to `@keel/cli`'s skills of the same version, which it passes as `skills`; `keel scaffold project` passes the running `@keel/cli`'s.

**Flags.** None is required.
| flag | does |
| --- | --- |
| `[folder]` | where to write, from the working folder, made if absent; default `.` |
| `--adapter client\|node\|static` | the deployable's adapter (k.topology); default `client` |
| `--library <@scope/name>` | a library package instead of an app |
| `--name <name>` | the package name; default the folder's name |
| `--existing` | write into a folder that is not empty, where no file is |
| `--dry-run` | print the records, write nothing |

It also takes `--format`, `--quiet` and `--limit` (k.cli). It reads no standard input and prompts for nothing, with or without a terminal. Output follows docs/OUTPUT.md; exit 0 written, 1 refused, 2 a usage error (E1052).

**Files.** An app is the generator `project` for the name, adapter and version, then `route` `app.home` at `/`, then the agent files (k.explain): the tree `keel scaffold project <folder> --adapter <a>` writes with a `@keel/cli` of the same version.
| kind | files |
| --- | --- |
| `client` | `package.json`, `README.md`, `tsconfig.json`, `vite.config.ts`, `tokens.ts`, `topology.ts`, `turbo.json`, `.gitignore`, `.keel/.gitkeep`, `public/keel-mark.svg`, `.github/workflows/ci.yml`, `modules/app/` `module.ts`, `app.contract.ts`, `routes.ts`, `HomePage.tsx`, `home.route.test.ts`; `AGENTS.md`, `CLAUDE.md`, `.claude/skills/<name>/SKILL.md` per skill |
| `static` | the same, `adapter: "static"` |
| `node` | the same, and `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile`, `deploy/compose.yaml` |
| `--library` | what `library` writes under `<base>/` (k.library-pack Scaffold), at the folder's root, then `.gitignore` and the agent files |

`HomePage.tsx` renders the heading `app.home.title`, the project name, and the paragraph `app.home.next`, which names `modules/app/HomePage.tsx` and `keel docs` in the manager's form (`pnpm keel docs`). Every command a written file or a printed line names is in that form, `see:` lines included. The home route's `title` is the project name. `README.md` gives the commands, the dev address `http://localhost:5173`, where to edit first, how to add a page, how the kind deploys (`node`: `PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`) and the upgrade steps; pretty output names that address beside `keel dev`. `home.route.test.ts` renders `app.home` (with `app` on `node`, k.testing), expects that heading text and runs `a11y()`.

**Versions.** An app lists each `@keel/*` package at exactly create's version, never a range; a library at `^<version>`, as k.library-pack Scaffold says. An app's `engines.node` is `>=22.15`. A running Node older than 22.15 is E1362, before any other step.

**Package manager, Workspace.** k.create-manager: the manager `npm_config_user_agent` names, its commands, `packageManager` and CI install, and an app inside a workspace (E1363, W1364).

**Folder.** k.create-folder: when a folder counts as empty, how the files are written, all or nothing, and what is read around it (E1360, E1361, E1365 to E1367).

**Names.** The name is `--name`, else the folder's last segment (of its real path for `.`). It is `[a-z][a-z0-9-]*`, at most 64 characters, and not a dependency the project lists, else E1352 with the fix `--name <n>`: `n` is the name with each letter's marks dropped (`é` `e`; `ß` `ss`, `æ` `ae`, `ø` `o`), lowercased, each run of other characters one `-`, none at either end; when that is not a valid name, no fix is named but `--name`. `--library` takes `@<scope>/<base>`, else E1352. E1352 names no path: the name is in no file yet.

**Next.** Each written file is a `scaffold.edit` record (`create <path>`), sorted. Then a `create.next` record per command, `{ kind, command }`, compact `next pnpm install`, each pasteable as printed (in a workspace too: the manager finds its root from the folder): `cd <folder>` unless `.`; `git init -b main` (the branch the CI workflow runs on) when no `.git` is at or above the folder; the install; then `keel dev`, `keel check`, `keel test`, `keel build` in the manager's form, or for a library `keel check`, `keel test`, `keel pack` (`keel pack --frozen` is E1164 until `keel pack` writes `.keel/ledger.json`, k.library-pack). The trailer is `ok create <name> <kind> <n> created`. `--dry-run` writes nothing, prints each file as `would create <path>` (json: `"dry-run": true` on each record) and ends `ok create --dry-run <name> <kind> <n> planned`.

**Rules.** E1362 Node older than 22.15 (fix: install Node 22.15 or later) · E1363 the workspace has `@keel/cli` at another version (fix: `pnpm create @keel/app@<that version>`) · W1364 the workspace's package globs leave the folder out (fix: add it to them). Names are E1352, flags E1052 (`--adapter` with `--library`, a second folder, an unknown flag).

**Conformance.**
- With standard input an open pipe that nothing writes and no terminal, `create-app shop` in an empty folder exits 0 and writes `shop/`.
- `create-app` with no argument, in an empty folder `shop`, writes the project into it, named `shop`.
- The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists.
- `--adapter static` writes the same paths with `adapter: "static"` in `topology.ts`; `--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`.
- For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`.
- Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`.
- A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`.
- `--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`.
- A folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written.
- `--name café` is E1352 holding `--name cafe`, `--name 123` one naming no `--name <n>`; every name a fix names passes the name rule.
- `createPlan` given Node 22.14.0 returns E1362 and no file.
- With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0`, `package.json` has `packageManager: "npm@10.9.0"`, the CI workflow runs `npm ci`, and the next records are `npm install` and `npx --no keel dev`, `check`, `test`, `build`.
- With `yarn/4.5.0`, `.yarnrc.yml` holds `nodeLinker: node-modules`; with no user agent, `package.json` has no `packageManager` and the commands are pnpm's.
- With `yarn/4.5.0`, an app's and a library's `.gitignore` end with the lines `.pnp.*`, `.yarn/*`, `!.yarn/patches`, `!.yarn/plugins`, `!.yarn/releases`, `!.yarn/sdks`, `!.yarn/versions`; with `pnpm/11.17.0`, it holds no line starting `.yarn` or `.pnp`.
- Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and prints `next pnpm install`; `create-app b` run in `apps/` there reports no W1364; `create-app tools/b` reports W1364 and writes the project.
- With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing.
- `--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written.
- The packed `@keel/create-app` lists no dependency, and installing it alone puts no other package in the lockfile.
- In compact a run prints one `create <path>` line per file, then the `next` lines, then `ok create shop client <n> created`, with no ANSI escape; `--format=json` prints one record per line ending in `summary`; `--dry-run` prints `would create <path>` per file and `ok create --dry-run shop client <n> planned`, json records carry `"dry-run": true`, and nothing is written.
- `@keel/create-app`'s `skills/<name>/SKILL.md` equal `keel docs <name>` of `@keel/cli` at the same version, byte for byte.
- From the packed tarballs, in an empty folder, `client`, `static` and `node` each after its install pass `keel check`, `keel test` and `keel build`, `--library` passes `keel check`, `keel test`, `keel pack` and then `keel pack --frozen`, and in each `keel docs --sync` writes nothing.
- A folder `My Site`, `create-app shop --name vite` and `create-app shop --library charts` are each E1352 with no path: in compact the line starts `E1352 ` followed by the message, with no `path:line:col`.

# k.create: Create a project
status: implemented
`pnpm create @keel/app [folder] [flags]` starts a Keel project from an empty folder. The package manager runs the package `@keel/create-app`; `npm create @keel/app [folder] -- [flags]`, `yarn create @keel/app` and `bun create @keel/app` run the same package. It runs the k.scaffold generators through `@keel/scaffold`, writes the result and prints what to run next. It asks nothing.
```sh
pnpm create @keel/app shop
pnpm create @keel/app shop --adapter node
pnpm create @keel/app charts --library @acme/charts
```

**Package.** `@keel/create-app` has one bin, `create-app`, at `src/bin.ts` (published `dist/src/bin.js`), and depends on `@keel/scaffold` at exactly its own version. `@keel/scaffold/create` exports `createPlan`, pure; the bin reads its inputs, writes and prints:
```ts
createPlan(input: {
  version: string; nodeVersion: string; skills: readonly AgentSkill[]; // create's version, the running Node's, the skills it ships
  folder?: string; name?: string; adapter?: 'client' | 'node' | 'static'; library?: string; existing?: boolean; // the flags
  listing?: readonly string[]; // every entry under the folder, relative, '/'-separated, a folder ending in '/'
  ancestors?: Readonly<Record<string, string>>; // Workspace's files above the folder, keyed from the working folder: '../package.json'
  realPath?: string; gitAbove?: boolean; userAgent?: string; // the folder's real path, a `.git` at or above it, npm_config_user_agent
}): Result<{ files: Map<string, string>; records: readonly CreateRecord[] }, ScaffoldError>
```
`files` are keyed from the folder; a `CreateRecord` is one of Next's, W1364 a `diag` between the edits and the `create.next` records. No `@keel/*` package depends on `@keel/create-app` and a created project does not list it. It ships `skills/<name>/SKILL.md`, byte-equal to `@keel/cli`'s skills of the same version, which it passes as `skills`; `keel scaffold project` passes the running `@keel/cli`'s. Every package of its install closure is in the closure of the project it creates.

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

**Files.** An app is the generator `project` for the name, adapter and version, then `route` `app.home` at `/` (with `no-loader` on `client` and `static`), then the agent files (k.explain): the tree `keel scaffold project <folder> --adapter <a>` writes with a `@keel/cli` of the same version.
| kind | files |
| --- | --- |
| `client` | `package.json`, `tsconfig.json`, `vite.config.ts`, `tokens.ts`, `topology.ts`, `turbo.json`, `.gitignore`, `.keel/.gitkeep`, `public/keel-mark.svg`, `.github/workflows/ci.yml`, `modules/app/` `module.ts`, `app.contract.ts`, `routes.ts`, `HomePage.tsx`, `home.route.test.ts`; `AGENTS.md`, `CLAUDE.md`, `.claude/skills/<name>/SKILL.md` per skill |
| `static` | the same, `adapter: "static"` |
| `node` | the same, and `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile`, `deploy/compose.yaml` |
| `--library` | what `library` writes under `<base>/` (k.library-pack Scaffold), at the folder's root, then `.gitignore` and the agent files |

`HomePage.tsx` renders the heading `app.home.title`, the project name, and the paragraph `app.home.next`, which names `modules/app/HomePage.tsx` and `keel docs`. `home.route.test.ts` renders `app.home` (with `app` on `node`, k.testing), expects that heading text and runs `a11y()`.

**Versions.** An app lists each `@keel/*` package at exactly create's version, never a range; a library at `^<version>`, as k.library-pack Scaffold says. An app's `engines.node` is `>=22.15`. A running Node older than 22.15 is E1362, before any other step.

**Package manager.** The manager is the name before `/` in the first word of `npm_config_user_agent` when it is `pnpm`, `npm`, `yarn` or `bun`, and `pnpm` otherwise. An app's `package.json` gets `packageManager: "<name>@<version>"` from that word, none when the variable is absent or names another manager. Yarn also gets `.yarnrc.yml` holding `nodeLinker: node-modules`, since the checker and `keel docs` read `node_modules`. No lockfile is written. The CI workflow (k.deploy) installs with the frozen form of the manager in `packageManager`, `pnpm` when there is none, and watches its lockfile among the shared files.
| manager | install | a command | CI install | lockfile |
| --- | --- | --- | --- | --- |
| pnpm | `pnpm install` | `pnpm keel <c>` | `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` |
| npm | `npm install` | `npx --no keel <c>` | `npm ci` | `package-lock.json` |
| yarn | `yarn install` | `yarn keel <c>` | `yarn install --immutable` (yarn 1: `--frozen-lockfile`) | `yarn.lock` |
| bun | `bun install` | `bun run keel <c>` | `bun install --frozen-lockfile` | `bun.lock` |

No printed command fetches a package the project's install did not.

**Workspace.** The workspace root is the nearest folder above the target holding `pnpm-workspace.yaml`, or a `package.json` with `workspaces`. Inside one an app has no `turbo.json`, CI workflow, `packageManager` or `.yarnrc.yml`, and the install runs at the root. A `@keel/cli` that resolves from the target's parent at another version than create's is E1363, so a workspace holds one Keel. A folder the root's package globs (`*`, `**`, `!`) do not match is W1364, and the files are written.

**Folder.** A folder is empty when it holds nothing but `.git`, `.DS_Store` and `Thumbs.db`. Any other entry is E1360, unless `--existing`; with it, a path the plan writes that exists is E1361, naming it. Each file is created only where none is, and never replaced. A failed write is E1365: the files and folders this run made are removed. Writes are judged as k.scaffold Links says (E1357).

**Names.** The name is `--name`, else the folder's last segment (of its real path for `.`). It is `[a-z][a-z0-9-]*`, at most 64 characters, and not a dependency the project lists, else E1352 with the fix `--name <n>`, `n` the name lowercased with each run of other characters one `-`. `--library` takes `@<scope>/<base>`, else E1352.

**Not done.** It starts no process (no install, no `git init`), opens no connection, reads no environment value but `npm_config_user_agent`, `KEEL_AGENT` and `CI`, writes only inside the folder and reads outside it only the files Workspace names. The proof of the first two is a run under Node's permission model (Conformance) with writes granted only in the folder and no child process or worker granted (from Node 25, no network either): Node refuses each such call, and a refused call ends the run with a nonzero exit, so its exit 0 is the proof.

**Next.** Each written file is a `scaffold.edit` record (`create <path>`), sorted. Then a `create.next` record per command, `{ kind, command, dir? }`, compact `next pnpm install`, `dir` the folder to run it in when it is not the working folder (`next pnpm install (in ../..)`): `cd <folder>` unless `.`; `git init` when no `.git` is at or above the folder; the install; then `keel dev`, `keel check`, `keel test`, `keel build` in the manager's form, or for a library `keel check`, `keel test`, `keel pack` (a fresh library holds no `.keel/ledger.json`, so `keel pack --check` is E1164 until `keel pack` writes it, k.library-pack). The trailer is `ok create <name> <kind> <n> created`, or `ok create --dry-run ...` with nothing written.

**Rules.** E1360 the folder holds files (fix: name a new folder, or add `--existing`) · E1361 `--existing` and a file the project writes exists (fix: move it aside, or use a new folder) · E1362 Node older than 22.15 (fix: install Node 22.15 or later) · E1363 the workspace has `@keel/cli` at another version (fix: `pnpm create @keel/app@<that version>`) · W1364 the workspace's package globs leave the folder out (fix: add it to them) · E1365 a write failed; this run's files are removed (fix: free the path or its permission). Names are E1352, flags E1052 (`--adapter` with `--library`, a second folder, an unknown flag), links E1357.

**Conformance.**
1. With standard input an open pipe that nothing writes and no terminal, `create-app shop` in an empty folder exits 0 and writes `shop/`.
2. `create-app` with no argument, in an empty folder `shop`, writes the project into it, named `shop`.
3. The default project's files are exactly the `client` row, with one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists.
4. `--adapter static` writes the same paths with `adapter: "static"` in `topology.ts`; `--adapter node` adds exactly `modules/app/loadHome.server.ts`, `deploy/web/Dockerfile` and `deploy/compose.yaml`.
5. For each adapter the tree equals, byte for byte, the one `keel scaffold project` writes with that adapter from a `@keel/cli` of create's version and the same `npm_config_user_agent`.
6. Every `@keel/*` entry of an app's `package.json` is create's version with no range, and `engines.node` is `>=22.15`.
7. A `client` or `static` project has no file named `*.server.ts`, no `deploy/` folder, and no file outside `AGENTS.md` and `.claude/` holding `KEEL_SECRET`, `createApp` or `identity`.
8. `--library @acme/charts` writes the `library` files at the folder's root with `.gitignore` and the agent files, and `package.json` names `@acme/charts`.
9. In a folder holding `notes.txt`, `create-app` reports E1360, exits 1 and writes nothing; in one holding only `.git` and `.DS_Store` it writes the project.
10. With `--existing`, a folder holding `README.md` gets the project and its `README.md` unchanged, and one holding `package.json` gets E1361 naming `package.json` and nothing written.
11. Run by a user whom file modes bind (not root), with `--existing` and an empty read-only `public/`, `create-app` reports E1365 naming `public/keel-mark.svg` and leaves the folder as it was.
12. A folder `My Site` is E1352 whose message holds `--name my-site`; `--name vite` and `--library charts` are each E1352, nothing written.
13. `createPlan` given Node 22.14.0 returns E1362 and no file.
14. With `npm_config_user_agent` `npm/10.9.0 node/v22.15.0`, `package.json` has `packageManager: "npm@10.9.0"`, the CI workflow runs `npm ci`, and the next records are `npm install` and `npx --no keel dev`, `check`, `test`, `build`.
15. With `yarn/4.5.0`, `.yarnrc.yml` holds `nodeLinker: node-modules`; with no user agent, `package.json` has no `packageManager` and the commands are pnpm's.
16. Below a folder whose `pnpm-workspace.yaml` lists `apps/*`, `create-app apps/b` writes no `turbo.json`, CI workflow or `packageManager`, and its install record has `dir` `../..`; `create-app tools/b` there reports W1364 and writes the project.
17. With `node_modules/@keel/cli` at another version above the target, `create-app` reports E1363 naming both versions and writes nothing.
18. `--adapter node --library @a/b`, a second folder argument and `--nope` are each E1052, exit 2, nothing written.
19. Run as `node --permission` with reads allowed, writes allowed only in the folder, addons allowed and no child process or worker, `create-app shop` exits 0 and writes the project.
20. In compact a run prints one `create <path>` line per file, then the `next` lines, then `ok create shop client <n> created`, with no ANSI escape; `--format=json` prints one record per line ending in `summary`; `--dry-run` prints the same records and writes nothing.
21. `@keel/create-app`'s `skills/<name>/SKILL.md` equal `keel docs <name>` of `@keel/cli` at the same version, byte for byte.
22. From the packed tarballs, in an empty folder, `client`, `static` and `node` each after its install pass `keel check`, `keel test` and `keel build`, `--library` passes `keel check`, `keel test`, `keel pack` and then `keel pack --check`, and in each `keel docs --sync` writes nothing.

# @keel/create-app

Start a Keel project in an empty folder with one command:

```sh
pnpm create @keel/app shop
cd shop
pnpm install
pnpm keel dev
```

`npm create @keel/app shop`, `yarn create @keel/app shop` and `bun create @keel/app shop` run the same package. It asks nothing: every choice is a flag with a default, so a person and an agent get the same project.

| flag | does |
| --- | --- |
| `[folder]` | where to write, made if absent; default `.` |
| `--adapter client\|node\|static` | the app's deployable; default `client` |
| `--library <@scope/name>` | a library package instead of an app |
| `--name <name>` | the package name; default the folder's name |
| `--existing` | write into a folder that holds other files, never over one |
| `--dry-run` | print what it would write, write nothing |

It writes the files, prints each path and then the commands to run next, in order. It installs nothing, runs no `git init`, starts no process and opens no connection. A project pins every `@keel/*` package at the version of `@keel/create-app` that made it, and carries `AGENTS.md`, `CLAUDE.md` and a copy of each Keel skill, so an agent can read them before the install. `keel docs` lists the docs once the project is installed; `keel docs k.create` is this command's section.

Each refusal is one diagnostic with a code and its fix: E1360 a folder that is not empty, E1361 a file it would write that exists, E1362 Node older than 22.15, E1363 another Keel version in the workspace, E1365 a write that failed, W1364 a workspace whose globs leave the folder out.

---
"@keel/create-app": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/check": minor
---

k.create: `pnpm create @keel/app [folder]` starts a Keel project from an empty folder and asks nothing: `--adapter client|node|static`, `--library <@scope/name>`, `--name`, `--existing`, `--dry-run`. `@keel/scaffold/create` holds `createPlan`; `keel scaffold project` writes the same tree: the home route `app.home` with a real test, every `@keel/*` at the creating version, `engines.node >=22.15`, `packageManager` from the running manager, which the CI workflow installs with, and no `turbo.json` or CI inside a workspace. `keel scaffold library` adds `.gitignore` and the agent files. E1360 to E1363, W1364 and E1365 are explained.

`keel scaffold route --loader` in a module only `client` deployables list prints a `scaffold.note` line: the loader runs in the browser and its file ships in the client bundle. A generator's diagnostic prints only lines that run as written (k.scaffold-needs): an E1052 example names what the project holds; `transaction` without a store and `shell` without a `client` deployable print the line that makes it, after `first: `; `route --api` with no `node` deployable is E1353 naming E1511; in a library the app generators are E1052 saying what a library holds instead. A project or library created under yarn gets `.yarnrc.yml` and yarn's `.gitignore` entries. `.keel-create` lists the folders a run makes after its files, so following E1366's fix restores the folder. A SIGINT or SIGTERM during the writes finishes removing this run's files before the process exits.

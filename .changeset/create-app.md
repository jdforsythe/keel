---
"@keel/create-app": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/check": minor
---

k.create: `pnpm create @keel/app [folder]` starts a Keel project from an empty folder and asks nothing: `--adapter client|node|static`, `--library <@scope/name>`, `--name`, `--existing`, `--dry-run`. `@keel/scaffold/create` holds `createPlan`; `keel scaffold project` writes the same tree: the home route `app.home` with a real test, every `@keel/*` at the creating version, `engines.node >=22.15`, `packageManager` from the running manager, which the CI workflow installs with, and no `turbo.json` or CI inside a workspace. `keel scaffold library` adds `.gitignore` and the agent files. E1360 to E1363, W1364 and E1365 are explained.

`keel scaffold route --loader` in a module only `client` deployables list prints a `scaffold.note` line: the loader runs in the browser and its file ships in the client bundle. A generator's E1052 for a missing input names a line formed from the project's first module, which runs as written. A library created under yarn gets `.yarnrc.yml`. A SIGINT or SIGTERM during the writes finishes removing this run's files before the process exits.

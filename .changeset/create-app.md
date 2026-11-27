---
"@keel/create-app": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/check": minor
---

k.create: `pnpm create @keel/app [folder]` starts a Keel project from an empty folder and asks nothing: `--adapter client|node|static`, `--library <@scope/name>`, `--name`, `--existing`, `--dry-run`. `@keel/scaffold/create` holds `createPlan`; `keel scaffold project` writes the same tree: the home route `app.home` with a real test, every `@keel/*` at the creating version, `engines.node >=22.15`, `packageManager` from the running manager, which the CI workflow installs with, and no `turbo.json` or CI inside a workspace. `keel scaffold library` adds `.gitignore` and the agent files. E1360 to E1363, W1364 and E1365 are explained.

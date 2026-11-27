# k.create-manager: Package manager and workspace of a new project
status: implemented
What `create-app` (k.create) and `keel scaffold project` (k.scaffold) read of the package manager that runs them and of the workspace around the folder, and what that changes in the project.

**Package manager.** The manager is the name before `/` in the first word of `npm_config_user_agent` when it is `pnpm`, `npm`, `yarn` or `bun`, and `pnpm` otherwise. An app's `package.json` gets `packageManager: "<name>@<version>"` from that word, none when the variable is absent or names another manager. Yarn also gets `.yarnrc.yml` holding `nodeLinker: node-modules`, since the checker and `keel docs` read `node_modules`. No lockfile is written. The CI workflow (k.deploy) installs with the frozen form of the manager in `packageManager`, `pnpm` when there is none, and watches its lockfile among the shared files.
| manager | install | a command | CI install | lockfile |
| --- | --- | --- | --- | --- |
| pnpm | `pnpm install` | `pnpm keel <c>` | `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` |
| npm | `npm install` | `npx --no keel <c>` | `npm ci` | `package-lock.json` |
| yarn | `yarn install` | `yarn keel <c>` | `yarn install --immutable` (yarn 1: `--frozen-lockfile`) | `yarn.lock` |
| bun | `bun install` | `bun run keel <c>` | `bun install --frozen-lockfile` | `bun.lock` |

No printed command fetches a package the project's install did not.

**Workspace.** The workspace root is the nearest folder above the target holding `pnpm-workspace.yaml`, or a `package.json` with `workspaces`. Inside one an app has no `turbo.json`, CI workflow, `packageManager` or `.yarnrc.yml`, and the install runs at the root. A `@keel/cli` that resolves from the target's parent at another version than create's is E1363, so a workspace holds one Keel. A folder the root's package globs (`*`, `**`, `!`) do not match is W1364, and the files are written.

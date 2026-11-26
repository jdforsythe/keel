# ADR-0292: start a Keel project from an empty folder with one command (RFC 0247)

**Status:** accepted (orchestrator, 2026-11-26).

**Context.** A person or an agent with an empty folder has no way in: `keel scaffold project` needs an installed `@keel/cli`, a global `keel` collides with another product's binary, and the kit's tarballs do not install from a registry. What `scaffold project` writes has no route and no test, pins `^0.0.0` ranges, and `scaffold library` writes no agent files. An agent cannot answer a prompt and runs whatever command the output names.

**Decision.**
- `pnpm create @keel/app [folder]` runs `@keel/create-app`; npm, yarn and bun run the same package. It asks nothing: no standard input, every choice a flag with a default (`--adapter client|node|static`, `--library <@scope/name>`, `--name`, `--existing`, `--dry-run`), output per docs/OUTPUT.md.
- `@keel/create-app` is a bin over `createPlan` in `@keel/scaffold/create`, pure, and depends on `@keel/scaffold` at exactly its own version. Its tree equals `keel scaffold project`'s from a `@keel/cli` of the same version. It ships the skills of its version.
- `project` writes the home route `app.home` at `/`, its page and its test; an app pins every `@keel/*` at exactly the creating version, `engines.node` `>=22.15`, and `packageManager` from `npm_config_user_agent`, which the CI workflow's install follows.
- The agent files are copied: `AGENTS.md`, `CLAUDE.md`, the skill copies; W1356 and `keel docs --sync` keep them current. `keel scaffold library` writes them and `.gitignore` too.
- It runs no process and opens no connection; it prints the install, `git init` when there is no repository, and the `pnpm keel` commands. A non-empty folder is E1360 unless `--existing`; a file is never replaced (E1361); a failed write removes what the run made (E1365). Node below 22.15 is E1362. In a workspace the app leaves `turbo.json`, CI and `packageManager` to the root, a second Keel version is E1363, globs that miss the folder W1364.
- A smoke over the packed kit (`evals/public/pack.ts`) creates each kind in an empty folder and runs install, check, test and build.

**Alternatives.**
- `create-keel`, unscoped: a name anyone could hold; the scope proves the publisher.
- A global `keel new`: the binary collision and a Keel that drifts from the project's.
- `degit`-style templates: a second source of truth with no pin and no agent files.
- A wizard: an agent cannot answer it.
- `@keel/create-library`: a second registry package for one flag.
- Running the install: create would start the package manager and its scripts.

**Consequences.** Three commands reach a page in a browser. The CI template gains an install per package manager. Every `scaffold project` tree gains two files and exact versions. A pnpm workspace whose root does not list `@keel/cli` hides a sibling's Keel version from E1363. The e2e test and the grants clause wait on RFC 0244 and RFC 0251.

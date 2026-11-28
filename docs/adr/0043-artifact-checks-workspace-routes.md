# ADR-0043: E1005 derives hashes per project, trusts no caller map, and reports `routes.json` beside a `routes.ts` as W1005 (RFC 0055)

**Status:** accepted

**Context.** Three gaps remained after RFC 0050:
- `check()` compared with any `artifacts.hashes` object, so `{}` silenced E1005 (backlog 0143).
- In a workspace, `keel check` from the root never read `apps/<x>/.keel/` (backlog 0144).
- `routes.json` beside a `routes.ts` was never compared and never reported, because deriving it evaluates code (backlog 0139).

**Decision.**
- **No override.** E1005 always derives its expected hashes from sources. `CheckOptions.project` names the files to derive from (default `files`). `artifacts.hashes` is ignored. A `.keel/<name>.json` the compiler does not write is E1005 (`not among the compiled artifacts`).
- **One project per `.keel/`.** The project of `<dir>/.keel/<name>.json` is `<dir>`. `check()` compiles the sources under `<dir>` once, relative to it, with `<dir>/topology.ts`. The cli reads `.keel/*.json` at any depth.
- **`routes.json` (option a).** `artifactHashes` returns `null` for `routes.json` beside a `modules/<m>/routes.ts`. A self-consistent, canonical file with a `null` expectation is W1005 (not verified). `vite build` evaluates the manifests. Before it rewrites a differing `routes.json`, it warns W1005. `keel build` prints Vite's Keel-coded lines to stderr.
- **Why a warning at build.** The build is the regenerate step and leaves a correct file. Failing it would fail every first build after a `routes.ts` edit made with no dev server running.

**Alternatives.**
- **A `node:vm` sandbox in check.** No sandbox exists: build evaluation bundles with esbuild and imports in Node. It also breaks the static-only rule of k.check.
- **Fail closed on a missing name, keeping the override.** It needs one map per project.
- **Project roots from `package.json`.** `keel check` does not read it, and the `.keel/` parent is where the writer puts the files.

**Consequences.**
- Every `keel check` that includes `.keel/routes.json` in an app with routes manifests prints one W1005. Exit codes are unchanged.
- A root `keel check` compiles once per app with a checked artifact. Golden apps cost about 10 ms each.
- `check()` callers that relied on `artifacts.hashes` pass `project`.
- **Known limit.** `keel build` in a project whose deployables are all `node` runs no project-level `vite build`, so `routes.json` is neither rewritten nor compared there.
- **Superseded in part by ADR-0049.** W1005 is now limited to non-literal parts of `routes.ts`, and the `node`-only limit above is closed.

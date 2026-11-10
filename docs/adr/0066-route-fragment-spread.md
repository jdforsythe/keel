# ADR-0066: `routeLiterals` reads a spread of a `deps` package's routes (RFC 0077)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 1, 2, 3 and 6.

**Context.** `keel check` reads a project's `routes.ts` statically and compares the literals with `routes.json`. A spread in the manifest object opened the id set and reported W1005. A stdlib package ships its routes as a `routes` export the app spreads (`...sessions.routes`), so every app that mounts std routes warned on a clean `routes.json`.

**Decision.** A spread `...x.routes`, where `x` is `routes` imported by name from a package in the module's `deps`, reads as that export's literals. The specifier resolves from the module's folder with the resolver the std import step uses (`node_modules` lookup, then `exports` by Node's conditions `node`, `import`, `default`). Build-time evaluation passes `conditions: []` to esbuild, so it drops esbuild's `module` and picks the same file. An `exports` target follows Node's target rule, and the entry and every relative module the reader follows for a guard have real paths inside the package's real directory. The resolved file is parsed and read by the rule the app's manifest gets. Any other spread keeps the id set open, and W1005 names the spread by its source text, after the manifest path or, inside a fragment, the package specifier. `routeLiterals` takes a `root` option, defaulting to `process.cwd()`; `check()` passes each project's directory.

**Alternatives.**
- A `routes.json` shipped by the package, rejected: a second source for one table, and std packages ship none.
- Both sources, rejected: two ways to read one fragment.
- Evaluating the manifest in `keel check`, rejected: the check never runs app code.
- `createRequire().resolve`, rejected: a second resolver with different conditions.
- Adding `module` to the resolver, rejected: the std import step would import a file Node does not pick.
- An app-side workaround, rejected: the gap is in the kernel.

**Consequences.**
- k.compiler gains one rule sentence and one conformance clause.
- A `routes.json` that differs from a fragment's literals is E1005, so std routes get the comparison app routes get.
- `actions` are read from `routes.actions({...})` in the fragment's own file and unread when a project file reads `actions` off the imported binding. A package that attaches actions from another of its files makes the comparison report E1005 until it attaches them in the routes file.
- A bundled third-party package that offers both `module` and `import` or `default` targets evaluates from the target Node picks.
- The std import step rejects an `exports` target that breaks Node's target rule or resolves outside its package, as E1159 (not found).

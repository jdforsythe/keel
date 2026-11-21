# ADR-0039: E1005 compares `.keel/` artifacts with what the current sources compile to (RFC 0050)

**Status:** accepted

**Context.** E1005 checked a `.keel/` file only for self-consistency: canonical bytes, and `hash === hashOf(data)`. A forged file (data changed, hash recomputed) passed, and so did a stale one. `check()` compared with the compiler's hashes only when a caller passed `artifacts.hashes`, and none did.

**Decision.**
- **One derivation.** `@keel/compiler` exports `artifactHashes(files, { topology })`. It compiles the app sources among `files` and evaluates nothing. `isSourcePath` defines the app sources for both this and the Vite plugin's `listSources`. `routes.json` is omitted when a `modules/<m>/routes.ts` exists, because deriving it evaluates code.
- **E1005 uses it.** For a root `.keel/<name>.json`, a hash that differs from the expected one is E1005. The expected hashes are the caller's `artifacts.hashes`, else `check()` derives them from `files`. `keel check` derives them from the whole project, so restricting the paths does not weaken the comparison.
- **Stale is E1005.** Forged and stale files cannot be told apart from their bytes, and any provenance stamp can be forged. A separate warning would be the forger's way out. Both get the message `does not match its sources; regenerate`.
- **Nested `.keel/` dirs** are checked for self-consistency only.
- **Amendment (backlog 0142).** `isSourcePath` is the one source rule, exported from `@keel/compiler`. `keel build`, `artifactHashes`, the Vite plugin's `listSources`, and its artifact merge all use it.
  - **Excluded.** Tests, test trees (`test/`, `tests/`, `conformance/`), dot dirs, build output, declarations, and tool configs (`*.config.*`).
  - **Why.** `keel build` followed by `keel check` must be clean, and the build and the check must read one set of files.
- **`artifacts.hashes` is trusted caller input (backlog 0143).** Only the cli derives it. `check()` does not verify it.

**Alternatives.**
- **Evaluate `routes.ts` in check.** This breaks the static-only rule of k.check.
- **A provenance stamp with a W code.** The stamp can be forged.
- **A keyed MAC.** A repo has no place to keep the secret.
- **CLI-only recompile.** `check()`, LSP and MCP stay open.

**Consequences.**
- **Gap.** `routes.json` in a project with routes manifests is still checked only for self-consistency. Closing it needs a k.check decision on evaluation.
- **Committed artifacts.** They must be rebuilt with their sources.
- **`check()` fixtures.** A fixture that passes `.keel/` files must pass their sources too.

**Amendment (ADR-0043, RFC 0055).** Superseded in part. `artifacts.hashes` is no longer trusted: E1005 always derives from `CheckOptions.project`. Nested `.keel/` dirs are compared with their own project's sources. `routes.json` beside a `routes.ts` is W1005 in `keel check`, and `vite build` warns before it rewrites a differing one.

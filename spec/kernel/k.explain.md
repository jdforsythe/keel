# k.explain: Explanations
status: conformance-covered

The text `keel explain` prints (k.check **explain and docs**) lives in an entry of `@keel/check` of its own, apart from `check()`. What shows an explanation loads it: `keel explain`, the MCP `explain` tool and the LSP hover (k.cli). What checks code does not.

**Entry.** `@keel/check/explain` exports `explain(code): string`, synchronous. A kernel code reads its row of the explanation table: the code and its Rules entry, the reason when the spec gives one, one fix example, and `see`. A code registered through `defineRule` gives the rule's message, `explain` and `see`. Any other code gets one line naming it as unknown. `@keel/check` does not export `explain`.
- Rules registered through `defineRule` from `@keel/check` are explained by `@keel/check/explain` in the same process: the registrations live in one module both entries import. `explain` imports no kernel rule; every kernel code has a table row (k.check).

**Diagnostics.** A diagnostic is complete without the explanation entry. `code`, `path`, `line`, `col`, `message`, `fix` and `see` come from the rule and the pipeline: `fix` is the rule's own edit as a unified diff, never the table's fix example. Compact, json and pretty output print no explanation text; `keel explain <code>` does.

**Budgets.** `tooling/budgets.json` has a size line for each entry, `@keel/check` and `@keel/check/explain`, each measured as that entry bundled alone (minified esm, dependencies external, gzip). Explanation text counts against the explain line, and the checker's code against the main line.

**Agent files** (k.scaffold generator `project`), from the running `@keel/cli`: `AGENTS.md` with the Keel block (`<!-- keel:start -->` to `<!-- keel:end -->`, <= 600 tokens: `keel docs`, `keel explain`, commands, rules, skill paths), `CLAUDE.md` holding `@AGENTS.md` when nothing exists there (an existing one is never written, a dangling symlink is E1357), and a copy of each skill `keel docs` lists at `.claude/skills/<name>/SKILL.md`. In a folder whose `package.json` has `"keel": "library"` the block says it is a Keel library and lists `keel-library` first; `keel scaffold library` writes the same files in `<base>/` (k.create). `keel docs --sync` writes them all or none, replacing or appending the block. Where `AGENTS.md` has the block, `keel check` reports W1356 for it or any copy `--sync` would change.

**Rules.** None.

**Conformance.**
- `@keel/check` has no `explain` export. `@keel/check/explain` exports `explain`, and for every code in `reportedCodes()` it returns at most 120 tokens naming the code.
- A rule registered with `defineRule` imported from `@keel/check` is explained by `explain` from `@keel/check/explain`: its message, its `explain` text and its `see`.
- The `@keel/check` entry bundled alone (esbuild, minified esm, dependencies external) contains no reason line and no fix example of any kernel code's explanation; the `@keel/check/explain` entry bundled alone contains every one.
- `tooling/budgets.json` has a size line for `@keel/check` and one for `@keel/check/explain`.

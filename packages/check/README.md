# @keel/check

**Spec:** k.check · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `check(files, opts?)` -> `{ diagnostics, summary }` over `{ path, source }[]`; `opts`: `root` (module resolution, default cwd), `budgets` (E1755), `artifacts` (`hashes` for E1005), `types: false`, `render: false`. `format(diags, { mode, limit, quiet, code, ms })` (`compact` default, `json` NDJSON + summary, `pretty`). `defineRule(def)`, `rules()`, `explain(code)`. Types for each (`Diagnostic`, `Summary`, `RuleDef`, ...).
- **Invariants:** diagnostics are `{ kind: 'diag', code, path, line, col, message, see?, fix? }` (that key order), deduped, sorted by path, line, col; one-line messages under 90 chars; `fix` is a git-applicable unified diff. Compiler diagnostics pass through unchanged. TS errors encoding a Keel rule map to it (E1802, E1501, E1003, E1001), others are E1751 `TS<code> ...`; JSX types come from `@keel/runtime-dom/jsx-runtime`. A throwing rule is E1756; the rest still run. Components render once under a sim ctx (seed 1337). Compact: grouped by code, 5 per code (or `limit`) then `... +N more`, long fixes become a pointer, trailer `ok|fail N errors, M warnings` plus an indented counts line; no ANSI, no timestamps; deterministic. `explain` <= 120 tokens per kernel code.
- **Dependencies:** `@keel/compiler`, `@keel/ctx`, `@keel/schema`, `@keel/reactive`, `@keel/store`, `@keel/runtime-dom`, `@keel/ui`, `oxc-parser`, `typescript`, `happy-dom`.
- **Rungs:** conformance; properties (seed 1337) for format and diff round-trip; token budget on 10 injected errors.

## Extension points

**Rule registry.** `defineRule({ code, message, explain, see?, check, fix? })`: `check({ file, ast, artifacts })` returns findings `{ path, line, col, data? }`; `fix(finding, { file, ast })` returns `{ start, end, text }` edits or `null`, rendered as a unified diff. `message` may be a function of the finding. Stdlib codes are E2xxx/W2xxx; another code or a duplicate throws `E1753 ...`. Rules are pure; the registry is process-wide.

## Unsafe

count: 1 (`unsafe/loadComponent.ts`: evaluates compiled component modules for the rendered check)

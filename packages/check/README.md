# @keel/check

**Spec:** k.check · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `check(files, opts?)` -> `{ diagnostics, summary }` over `{ path, source }[]`; `opts`: `root` (module resolution, default cwd), `budgets` (E1755), `artifacts`, `types: false`, `render: false`. `format(diags, { mode, limit, quiet, code, ms })` -> string (`compact` default, `json` NDJSON + summary, `pretty`). `defineRule(def)`, `rules()`, `explain(code)`. Types: `Diagnostic`, `Summary`, `CheckOptions`, `CheckResult`, `FormatOptions`, `FormatMode`, `RuleDef`, `RuleInput`, `Finding`, `Edit`, `Budget`, `SourceFile`.
- **Invariants:** diagnostics are `{ kind: 'diag', code, path, line, col, message, see?, fix? }` in that key order, deduped, sorted by path, line, col; messages one line under 90 chars; `fix` is a git-applicable unified diff. Compiler diagnostics pass through unchanged. TS errors that encode a Keel rule map to it (E1802, E1501, E1001), others are E1751 `TS<code> ...`. A throwing rule is E1756 and the rest still run. E1805 is held back on files the compiler reports on. Compact: grouped by code, 5 per code (or `limit`) then `... +N more`, fixes over 6 lines become a pointer, one trailer line; no ANSI, no timestamps; equal inputs give equal output. `explain` is at most 120 tokens for every kernel code.
- **Dependencies:** `@keel/compiler`, `@keel/schema`, `@keel/reactive`, `@keel/store`, `@keel/runtime-dom`, `@keel/ui` (rendered check), `oxc-parser`, `typescript`, `happy-dom`.
- **Rungs:** conformance; properties for format grouping/caps/order/dedupe and diff round-trip (seed 1337); token budget on 10 injected errors.

## Extension points

**Rule registry.** `defineRule({ code, message, explain, see?, check, fix? })`: `check({ file, ast, artifacts })` returns findings `{ path, line, col, data? }`; `fix(finding, { file, ast })` returns `{ start, end, text }` edits or `null`, rendered as a unified diff. `message` may be a function of the finding. Stdlib codes are E2xxx/W2xxx; another code or a duplicate throws `E1753 ...`. Rules are pure; the registry is process-wide.

## Unsafe

count: 1 (`unsafe/loadComponent.ts`: evaluates compiled component modules for the rendered check)

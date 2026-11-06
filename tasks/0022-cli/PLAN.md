# Task 0022: cli

**Spec:** k.cli (also k.check flags/explain, k.testing ledger, k.scaffold) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/cli

## Deliverables
- [x] Engine `run(argv, io)` (pure, in-process) over the command table `operations` (`{ name, description, input, output, positional }`)
- [x] Formatter registry `formatter(kind, { schema, compact, pretty })`; kernel kinds diag, summary, req, ledger, a11y at startup; E1053 / E1054
- [x] Commands: `check`, `spec` (id / `--for` / `--map`), `explain`, `ledger` (`--diff`), `test` (binary delegates to vitest); build, dev, inspect, render, scaffold, codemod -> I1055
- [x] Surfaces: `src/bin.ts` (fs -> `io.files`), `mcp(provide)` (NDJSON JSON-RPC, tools/list + tools/call), `lsp(provide)` (Content-Length JSON-RPC: initialize, didOpen/didChange/didClose -> publishDiagnostics, hover -> explain, shutdown/exit)
- [x] Property tests (seed 1337): argv round-trip per operation, render limit/quiet/determinism, surface parity cli = MCP = LSP
- [x] README contract, `.changeset/cli-initial.md`, `bin` in package.json; k.cli status left `proposed`
- [x] Conformance green against the real `@keel/check` (63cc729+)

## Steps
1. [x] Deps: `@keel/schema`, `@keel/check` (workspace:*); dev `@keel/compiler`, `@types/node`, `fast-check`.
2. [x] Implement engine, registry, commands, surfaces, bin.
3. [x] Conformance + own tests against a scratch `@keel/check` stub (alias in a scratchpad vitest config; nothing in repo): 62 tests, all green except `test/passthrough.test.ts` (needs the real pipeline).
4. [x] README, changeset, PLAN.
5. [x] Against the real `@keel/check`: check + test green; binary smoke (spec, nope, explain, check, mcp initialize/tools/list, lsp initialize/didOpen/exit) from src (node 24 type stripping) and from the build.

## Decisions
- D1: One `Input` type (union of all fields, all optional); each operation's `input` is an `s.object` over its subset. Binary flags go through `input.decodeStrings` (coercion + validation), MCP arguments through `input.parse`; every schema issue is E1052 (`issueDiags`). Extra checks, also E1052: unknown flag, single-dash flag, flag given twice, missing value, extra positional, `--limit` < 1.
- D2: Positionals are named input fields (`check paths[]`, `spec id`, `explain code`, `inspect what`, `render target`, `scaffold|codemod op args[]`); a positional field is not also a flag (`explain --code X` is E1052: one way).
- D3: Exit code: 2 if any E1051/E1052, else 1 if any E diag (before `--code` filtering), else 0. `--code` filters display only; the summary counts all.
- D4: No timing in the summary (`{ kind, ok, name, counts }`): byte-identical output for equal input. Trailer `ok check 2 files, 0 errors, 0 warnings`.
- D5: Render: groups in first-appearance order (diags by code, others by kind), summary last. Compact/pretty cap diags at 5 per code, `--limit N` overrides, `--verbose` uncaps; other kinds capped only by `--limit`; json capped only by `--limit` (no "more" line). More line: `... +K more CODE (keel <cmd> --code CODE)` (k.check wording).
- D6: The cli's own record kinds (`spec.section`, `spec.cite`, `explain.text`) are registered through the same registry at startup; they are not kernel kinds. `spec`/`explain` output is therefore never a `diag`, so it never fails the exit code.
- D7: Diag key order `kind, code, path, line, col, message, see, fix` (compiler and `@keel/check` order, not OUTPUT.md's example order) so `keel check --format=json` is byte-identical to the compiler's diagnostic (k.check Conformance). `test/passthrough.test.ts` asserts it.
- D8: I1055 "<cmd> not available: needs <pkg>" for commands whose package has not landed, and for `spec` when the project has no `spec/*.md`. **Not in the spec** (k.cli Rules name E1051-E1054 only; `session` -> E1051 is the only reserved-command rule, and the Commands table forbids E1051 here). Needs an RFC adding I1055 to k.cli Rules, or a different answer.
- D9: `@keel/testing` (`renderRoute`) and `@keel/scaffold` (`scaffold`, `plan`) are exported now, but both are later than cli in `tooling/deps.json` (S0003: a package may import only earlier packages), so cli does not import them: `keel test` in-process returns the empty-run summary; the binary spawns `npx --no-install vitest run [paths]` with `KEEL_TEST=1`. `render` reports I1055. Wiring `render`/`scaffold` needs a deps-order change (RFC) or a plugin seam.
- D10: `keel ledger` ports tooling/ledger.mjs pure over `io.files` (`src/internal/buildLedger.ts`, `scrubCode.ts`): exported functions in `packages/*/src/*.ts`, rung from referencing test/conformance files, `evidence` = first referencing file. `--diff` reads `.keel/ledger.json` or `tooling/ledger/ledger.json` from `io.files` and reports E1706 (k.testing) per lowered rung. Spec-clause items (`k.router#3`) and the unsafe-count regression (tooling L0001) are not ported.
- D11: `a11y` records are flattened nodes with `depth` (schemas are not recursive). `req`: `{ method, path, route?, status, ms }`.
- D12: MCP: hand-rolled newline-delimited JSON-RPC (`@modelcontextprotocol/sdk` is not installed). Tools carry `inputSchema` (JSON Schema of the operation input via `toJsonSchema`) and `outputSchema`; results carry `content[0].text` (compact unless `format` given) and `structuredContent.records`. Unknown tool -> E1051 result, `isError: true`.
- D13: LSP: hand-rolled Content-Length framing; full sync; diagnostics from the same `runCheck` with open documents overlaid on project files. Code actions for fix diffs are not implemented (spec names them; follow-up).
- D14: `run(['mcp'|'lsp'], { stdin })` serves the whole stdin and returns the replies; the binary streams through the same `StdioServer`. `mcp --help` is E1052 (no flag outside the schemas; satisfies "not E1051").
- D15: Type `StdioServer`, not `Session`: "session" is a glossary term.
- D17: `bin` is `./dist/src/bin.js`: the committed build tsconfig (eed24ae) has `rootDir: "."`, so `dist/bin.js` would not exist.
- D18: `@keel/check` `explain` answers unknown codes with text ("not a known code"), so `keel explain <unknown>` exits 0 with that text; the E1052 branch only fires if explain throws or returns empty.
- D16: `check(files, {})` is called without `root`: the in-process `cwd` may be fictional; the binary's process cwd equals `io.cwd`.

## Verification
- V1: `pnpm --filter @keel/cli check`: tsc + biome clean. `node tooling/structure-lint.mjs`: `ok structure-lint 1018 files`.
- V2: `pnpm --filter @keel/cli test`: `ok 62 tests, 0 failed, 0 skipped (1.6s)` (30 conformance + 32 own, incl. compiler passthrough byte-identity and cli = MCP = LSP parity).
- V3: `pnpm --filter @keel/cli build` ok (dist removed after the smoke run).
- Note: `keel check packages/cli/src` reports app-code rules (E1104 schema outside `*.schema.ts`, E1451 throw, E1452 try/catch) on kernel code; kernel packages are not app code, not addressed.
- Mutation: `mutate` is `echo skip`; not measured. Unsafe count 0.

## Next action
review (open items: RFC for I1055 (D8); deps-order decision for wiring test/render/scaffold (D9); LSP code actions (D13))

# Task 0022: cli

**Spec:** k.cli (also k.check flags/explain, k.testing ledger, k.scaffold) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/cli

## Deliverables
- [x] Engine `run(argv, io)` (pure, in-process) over the command table `operations` (`{ name, description, input, output, positional }`)
- [x] Formatter registry `formatter(kind, { schema, compact, pretty })`; kernel kinds diag, summary, req, ledger, a11y at startup; E1053 / E1054
- [x] Commands: `check`, `spec` (id / `--for` / `--map`), `explain`, `ledger` (`--diff`), `test` (binary delegates to vitest); build, dev, inspect, render, scaffold, codemod -> I1055
- [x] Surfaces: `src/bin.ts` (fs -> `io.files`), `mcp(provide)` (NDJSON JSON-RPC, tools/list + tools/call), `lsp(provide)` (Content-Length JSON-RPC: initialize, didOpen/didChange/didClose -> publishDiagnostics, hover -> explain, shutdown/exit)
- [x] Property tests (seed 1337): argv round-trip per operation, render limit/quiet/determinism, surface parity cli = MCP = LSP
- [x] README contract, `.changeset/cli-initial.md`, `bin` in package.json; k.cli status left `proposed`
- [ ] Conformance green against the real `@keel/check` (blocked: `check`, `explain` not exported yet)

## Steps
1. [x] Deps: `@keel/schema`, `@keel/check` (workspace:*); dev `@keel/compiler`, `@types/node`, `fast-check`.
2. [x] Implement engine, registry, commands, surfaces, bin.
3. [x] Conformance + own tests against a scratch `@keel/check` stub (alias in a scratchpad vitest config; nothing in repo): 62 tests, all green except `test/passthrough.test.ts` (needs the real pipeline).
4. [x] README, changeset, PLAN.
5. [ ] When `@keel/check` exports `check` and `explain`: `pnpm --filter @keel/cli check && pnpm --filter @keel/cli test`; run `node packages/cli/src/bin.ts check` and pipe an `initialize` + `tools/list` into `node packages/cli/src/bin.ts mcp` as a smoke test.

## Decisions
- D1: One `Input` type (union of all fields, all optional); each operation's `input` is an `s.object` over its subset. Binary flags go through `input.decodeStrings` (coercion + validation), MCP arguments through `input.parse`; every schema issue is E1052 (`issueDiags`). Extra checks, also E1052: unknown flag, single-dash flag, flag given twice, missing value, extra positional, `--limit` < 1.
- D2: Positionals are named input fields (`check paths[]`, `spec id`, `explain code`, `inspect what`, `render target`, `scaffold|codemod op args[]`); a positional field is not also a flag (`explain --code X` is E1052: one way).
- D3: Exit code: 2 if any E1051/E1052, else 1 if any E diag (before `--code` filtering), else 0. `--code` filters display only; the summary counts all.
- D4: No timing in the summary (`{ kind, ok, name, counts }`): byte-identical output for equal input. Trailer `ok check 2 files, 0 errors, 0 warnings`.
- D5: Render: groups in first-appearance order (diags by code, others by kind), summary last. Compact/pretty cap diags at 5 per code, `--limit N` overrides, `--verbose` uncaps; other kinds capped only by `--limit`; json capped only by `--limit` (no "more" line). More line: `... +K more CODE (keel <cmd> --code CODE)` (k.check wording).
- D6: The cli's own record kinds (`spec.section`, `spec.cite`, `explain.text`) are registered through the same registry at startup; they are not kernel kinds. `spec`/`explain` output is therefore never a `diag`, so it never fails the exit code.
- D7: Diag key order `kind, code, path, line, col, message, see, fix` (compiler and `@keel/check` order, not OUTPUT.md's example order) so `keel check --format=json` is byte-identical to the compiler's diagnostic (k.check Conformance). `test/passthrough.test.ts` asserts it.
- D8: I1055 "<cmd> not available: needs <pkg>" for commands whose package has not landed, and for `spec` when the project has no `spec/*.md`. **Not in the spec** (k.cli Rules name E1051-E1054 only; `session` -> E1051 is the only reserved-command rule, and the Commands table forbids E1051 here). Needs an RFC adding I1055 to k.cli Rules, or a different answer.
- D9: `@keel/testing` and `@keel/scaffold` are later than cli in `tooling/deps.json` (S0003), so cli does not import them: `keel test` in-process returns the empty-run summary; the binary spawns `npx --no-install vitest run [paths]` with `KEEL_TEST=1`. `render` reports I1055. Wiring `render`/`scaffold` needs a deps-order change (RFC) or a plugin seam.
- D10: `keel ledger` ports tooling/ledger.mjs pure over `io.files` (`src/internal/buildLedger.ts`, `scrubCode.ts`): exported functions in `packages/*/src/*.ts`, rung from referencing test/conformance files, `evidence` = first referencing file. `--diff` reads `.keel/ledger.json` or `tooling/ledger/ledger.json` from `io.files` and reports E1706 (k.testing) per lowered rung. Spec-clause items (`k.router#3`) and the unsafe-count regression (tooling L0001) are not ported.
- D11: `a11y` records are flattened nodes with `depth` (schemas are not recursive). `req`: `{ method, path, route?, status, ms }`.
- D12: MCP: hand-rolled newline-delimited JSON-RPC (`@modelcontextprotocol/sdk` is not installed). Tools carry `inputSchema` (JSON Schema of the operation input via `toJsonSchema`) and `outputSchema`; results carry `content[0].text` (compact unless `format` given) and `structuredContent.records`. Unknown tool -> E1051 result, `isError: true`.
- D13: LSP: hand-rolled Content-Length framing; full sync; diagnostics from the same `runCheck` with open documents overlaid on project files. Code actions for fix diffs are not implemented (spec names them; follow-up).
- D14: `run(['mcp'|'lsp'], { stdin })` serves the whole stdin and returns the replies; the binary streams through the same `StdioServer`. `mcp --help` is E1052 (no flag outside the schemas; satisfies "not E1051").
- D15: Type `StdioServer`, not `Session`: "session" is a glossary term.
- D16: `check(files, {})` is called without `root`: the in-process `cwd` may be fictional; the binary's process cwd equals `io.cwd`.

## Verification
- V1: `npx tsc --noEmit` (packages/cli): only `src/internal/runCheck.ts` and `src/internal/explainCommand.ts` TS2305 (`check`, `explain` not exported by @keel/check yet). `biome check src test unsafe`: clean. Structure lint: no cli findings.
- V2: Scratch run with a `@keel/check` stub (E1752 + explain): `13 files, 61 passed, 1 failed` (passthrough, needs the real compiler pipeline). All 30 conformance tests green.
- V3: Not yet run: `pnpm --filter @keel/cli test` with the real `@keel/check`; `pnpm --filter @keel/cli build`; the binary smoke test (step 5).
- Mutation: `mutate` is `echo skip`; not measured. Unsafe count 0.

## Next action
review (then step 5 once @keel/check lands; RFC for I1055, D8)

# What an RFC builder is told

Work ONLY in your lane's worktree. Do not push, do not merge into the main line, do not touch any other worktree.

Read first, in the lane: `CLAUDE.md`, `tasks/0963-to-p1/briefs/README.md` (the rules every lane carries: follow all of them), `.claude/skills/keel-package-dev/SKILL.md`, `docs/OUTPUT.md`, your RFC and ADR, then the spec sections with `pnpm spec <area>` and `pnpm spec <id>`. Run `pnpm install --offline` and `pnpm build` first. The pattern for what a finished RFC lane holds: `git log --format=%s --grep='0204' jdforsythe/test-impl | head -20`.

- The conformance is already written in the lane and fails for want of the build. NEVER edit `packages/*/conformance/**`. If a case seems to disagree with the spec text, do not bend the code to it and do not edit it: report file:line and the spec sentence. Never change a test's configuration or harness so that a case passes when the product would not behave that way.
- Build exactly what the RFC and spec state; one export per file; no `any`, casts, non-null assertions or `@ts-ignore` outside `unsafe/`; no bare `Date`, `Math.random`, `fetch`; kernel packages never import std packages (`tooling/deps.json`). A new code gets its explanation where codes are explained (`keel explain`).
- Where the conformance writer or you find a spec sentence open to two readings, build to the reading the RFC supports and make the spec sentence exact in your commit (spec text only); report it.
- Rewrite every app, example and scaffold template the change touches or newly flags (grep `apps/*`, `examples/*`, scaffold templates); list them.
- Property tests in the packages' own `test/` folders where `docs/TESTING.md` asks for them.
- Docs describe what exists now, no history: the Keel skills that name the feature (sources in `packages/cli/skills/`, copies in `.claude/skills/`; token targets in `tooling/docs-check.mjs`; re-base an overrun and note it), package READMEs, a changeset, the spec status of the touched sections and the RFC's status as earlier RFCs did when implemented, findings closed where they are tracked, the backlog line checked off in `tasks/BACKLOG.md`. Person-facing text follows `docs/BRAND.md`.

Verify, one test command at a time, each bounded (no `timeout` binary: `perl -e 'alarm N; exec @ARGV' cmd ...`; bash, not zsh loops); while `uptime` 1-minute load is above 30, wait with a bounded polling loop; other lanes share the machine. Never ports 8080, 5173, 5214, 5432; stop everything you start.
1. `pnpm build` at the root.
2. `pnpm test` from inside each package you changed and each package the brief names; the cli suite too if `@keel/check`, `@keel/compiler`, `@keel/schema` or `@keel/scaffold` changed.
3. `node ../../packages/cli/src/bin.ts check` and `... test` from inside each `apps/*` and each `examples/*`.
4. The smokes under `tooling/smoke/` that exercise what you changed, with the arguments `.github/workflows/ci.yml` gives them.
5. Root `pnpm check --quiet`: clean but for `ledger-fresh` (do NOT run `pnpm ledger`; list your new rows from `node tooling/ledger-fresh.mjs --format=json`). A size or token budget that overruns is re-based and noted in the commit message.
A failure that passes alone right after failing under load is a load flake: report file:line and re-run that suite once whole.

Commit small (`feat(<pkg>): ... (rfc:NNNN)` style), each ending with the session's attribution trailers.

Report only when everything has finished or a real blocker stops you, under 300 words: commits; each command's own last `ok` or `fail` line; what was not run; conformance disputed (file:line, spec sentence); spec sentences made exact; budgets re-based; `ledger-fresh` rows that are yours; apps and examples changed; anything a reviewer should look at; final head and `git status --short`.

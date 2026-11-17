Repository: /Users/jforsythe/orca/workspaces/keel/test-impl (git worktree, branch jdforsythe/test-impl). Work only there; never cd to another checkout.

Machine rules (shared machine, hard rules):
- Every shell command you run must end on its own. Never run a command that waits on stdin (a bare `cat`, `read`, an editor, a watch mode, a dev server left running). Pipe through `| tail -40` or `| head -60` and give long commands a bound, e.g. `perl -e 'alarm 600; exec @ARGV' <cmd>`.
- Run one test file at a time: `pnpm --filter @keel/std-credentials exec vitest run <path/to/file.test.ts> --reporter=dot 2>&1 | tail -30`. Never run the root `pnpm test`, never `pnpm mutate`, never a watch mode. Do not start more than one vitest at once. A whole-package run (`pnpm --filter @keel/std-credentials test`) at most twice in your whole session.
- Leave no helper process behind: before you report, run `ps -eo pid,ppid,etime,command | grep -F keel/test-impl | grep -v grep | head` and kill anything you started.
- Do not commit, push, stash or touch git state; leave your changes in the working tree and the orchestrator commits them.
- Do not create notes, plans or summary files in the repository.
- Shell has noclobber: write a file with `>|` when redirecting over an existing one.
- Do not run `pnpm install`; the workspace is already linked. If a dependency is missing, report it.

Code rules (CLAUDE.md): no `any`, no casts (`as`), no non-null assertions, no `@ts-ignore` outside `unsafe/` directories. One export per file; the filename is the export. No bare `Date`, `Math.random` or `fetch`. Comments and READMEs describe what the code does now: no history ("used to", "now"), no RFC, backlog or task ids in code comments, READMEs or spec text. Formatting is Biome (`pnpm --filter @keel/std-credentials exec biome check --write <paths>` fixes format).

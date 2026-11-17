# Build the scrub's single pass (0685), three lanes

Repository: /Users/jforsythe/orca/workspaces/keel/test-impl. Every lane reads `tasks/0338-s8-reach/briefs/common.md` first (machine and code rules, hard), then `tasks/0338-s8-reach/proposed/scrub-cost-0685.md` whole: it is the design, and it is decided. The prototype it measured is `tasks/0338-s8-reach/proposed/scrub0685-prototype.mjs.txt` (plain JS, a reference, not code to paste: the built file follows the code rules).

Decided (orchestrator, D24 in `tasks/0338-s8-reach/PLAN.md`, for the user to confirm or reverse): the design's five recommendations as written. The cap is 2,000,000 characters of distinct folded forms and fails closed to one mark, stated in k.privacy; base64 is matched without regard to case; letters outside the Basic Multilingual Plane match only as written; the `@keel/server` size budget is the orchestrator's to re-base, so a lane reports the measured size and does not edit `tooling/budgets.json`; 0672's set growth is not in this change.

No lane does git operations, runs the root `pnpm test`, `pnpm check` or `pnpm build`, runs `pnpm mutate`, or edits `tooling/**`, `tasks/**` or another lane's files. One vitest file at a time, bounded (`perl -e 'alarm 400; exec @ARGV' pnpm --filter @keel/server exec vitest run <file> --reporter=dot 2>&1 | tail -30`).

## Lane 1: spec and docs (sonnet)
Owns: `spec/kernel/k.privacy.md`, `packages/server/README.md`, `docs/THREAT-MODEL.md`, the Amendment entry in `docs/rfc/0105-*.md`, one changeset for `@keel/server` in `.changeset/`.
Do exactly the design's **Spec** section: the Sinks sentence, the two trims in the Secrets paragraph, the README log paragraph, the THREAT-MODEL clause, the RFC Amendment. Measure k.privacy afterwards with `node -e 'const t=require("fs").readFileSync("spec/kernel/k.privacy.md","utf8");console.log(Math.ceil([...t].length/4))'`: it must be 1,500 or fewer. Docs describe what exists now: no history, no backlog or RFC ids in the spec, README or THREAT-MODEL text (the RFC file is the one place the story goes). Voice rules: `docs/BRAND.md`; check with `node tooling/voice-lint.mjs 2>&1 | tail -5` and `pnpm spec k.privacy | tail -5`.
Report: each file changed, the measured token count, the voice lint's last line.

## Lane 2: conformance (the conformance-writer agent; it cannot read implementation files)
Owns: `packages/server/conformance/privacy-secret-reach.test.ts` only. Starts after lane 1.
From the k.privacy Sinks sentence about the cap, add the two cases in the design's **Build plan** item 2 (over the cap: 2,000 values of `"@".repeat(300) + i`, the `diag` message and each frame exactly `[secret]` in dev and production and no line holding `@@@@`; under it: 10 such values log `refused [secret]` with frames keeping their paths). Follow the file's existing helpers and header style; the header quotes the spec sentence. No casts, no suppression comments, no bare clock. The new cases fail until lane 3 lands; say which fail and how.
Report: the cases added by name and the run's result line.

## Lane 3: server (opus)
Owns: `packages/server/src/internal/automatonOf.ts` (new), `packages/server/src/internal/scrubbed.ts`, the removal of `matcherOf.ts` and `folded.ts` with every import of them, `packages/server/test/redTeam0105.test.ts` (step bounds in place of the `matcherOf(set).long` checks), `packages/server/test/scrubSteps.test.ts` (new: the four proofs in **What tests prove without a clock** and every case listed in **Build plan** item 3). May not edit `conformance/**`.
Build the design's **The design** section as written: forms, fold table, automaton in typed arrays, walk, cap, cache. `scrubbed(message, passes, count?)` keeps its signature plus the optional test-only counter. If the design is wrong somewhere, stop on that point and report it with the failing input; do not invent a second design.
Verify, one file at a time, each of: `test/scrubSteps.test.ts`, `test/redTeam0105.test.ts`, `test/privacyScrub.test.ts`, `test/secretScrubReach.test.ts`, `conformance/privacy-secret-reach.test.ts`, `conformance/privacy-diag-scrub.test.ts`; then `pnpm --filter @keel/server check 2>&1 | tail -8`; then the size: `pnpm --filter @keel/server build 2>&1 | tail -3` and `node tooling/budgets.mjs 2>&1 | grep -i 'keel/server\b\|fail\|ok' | head -5` (report the measured bytes; if that command is not how the budget tool is run, find the right one in `package.json` and say so).
Report: files changed; each verify line; the measured size; every place the build departs from the design and why; what a red-team pass should aim at.

## After the lanes (orchestrator)
The whole `@keel/server` suite, `pnpm check`, `pnpm build`, plain `pnpm ledger`; the budget re-base if needed; one commit carrying `rfc:0105`; then a red-team pass with the probe list at the end of the design's **Build plan**, in a probe file deleted afterwards; 0685 and 0687 closed only when that pass finds no copy left and no slow input.

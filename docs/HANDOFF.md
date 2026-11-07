# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - no open task worktree; everything is on branch jdforsythe/test-impl in this Orca worktree (test-impl), pushed to https://github.com/jdforsythe/keel (main mirrors it). HEAD 33efb4f.
  - state (2026-11-07): G1, G2 passed. G3 criteria met then re-audited: 13/18 kernel sections conformance-covered (ledger gate rfc:0049 E1707; the five short sections are backlog 0138), 6/6 extension points used by std-* wave 0, golden-1 and golden-2 agent-built (evals/results/2026-11-07-*), skills green. Freeze flip HELD by user decision (tasks/0034-freeze/PLAN.md D6). Brand (docs/BRAND.md, docs/VOICE.md) applied: ui brandTokens, self-hosted fonts, three apps restyled, scaffold template on brand, voice-lint V0003 in pnpm check (task 0121 closed).
  - root `pnpm check` and `pnpm test` green (41/39 tasks); ledger --diff 0 lowered, 0 uncovered; unsafe 6.
  - running for the user (after any rebuild run `pnpm --filter ./apps/golden-N build` first, then restart): golden-1 api `NODE_ENV=production node --experimental-webstorage --localstorage-file=apps/golden-1/.api.storage apps/golden-1/server.ts` (4181) + `npx vite preview --port 4180` in apps/golden-1; golden-2 the same on 4191/4190. Open with `open http://localhost:4180/` and `:4190`.
  - mutation: check 80.6% with KERNEL_RULES.ts included (0098 closed); scaffold rerun hung and was killed, its three new tests are committed, 0097 stays open (rerun `pnpm --filter @keel/scaffold mutate` on an idle machine).
  - next, in order (user: work until complete; each batch ends with the reviewer + red-team pass per WORKFLOW Batches before the push): (1) red-team 2026-11-07 highs 0123, 0124, then mediums 0125-0131, lows 0132-0137; (2) 0138 (flip the five sections back honestly); (3) 0114 two-phase manifest RFC (decided); (4) 0118, 0119 (stdlib loading, runtime std config), 0120 eval gaps; (5) S1 sessions 0091-0095; (6) 0097 scaffold mutate rerun. Never flip a section to frozen (D6).
  - process: every surface follows docs/BRAND.md + docs/VOICE.md (CLAUDE rule 10); RFC commits carry `rfc:NNNN` (commit-msg hook + CI guard S0008; conformance edits need it); tests never call process.chdir; scaffold/check Stryker tuning keys on STRYKER_MUTATOR_WORKER; agents stage nothing, the orchestrator commits by explicit path; size budgets may be re-based with the reason in the commit (D7); spec sections stay under 1,500 tokens (k.server and k.cli are at the limit: trim before adding); every number in prose comes from tooling/ledger/ledger.json.
  blockers: none
pending decisions: none (2026-11-07: 0114 two-phase manifest; freeze held; budgets re-base allowed; next stage chosen after the user sees both golden apps)
last updated: 2026-11-07 33efb4f (brand applied; ledger gate rfc:0049; red-team 2026-11-07 filed)
```

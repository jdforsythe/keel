# App trials (lane-app-trials)

## Runs

1. `pnpm eval:public pack`: ok, 41 tarballs -> `$TMPDIR/keel-kit` (92s). Log: `$TMPDIR/keel-app-trials/pack.log`.
2. `pnpm eval:public prove --kit $TMPDIR/keel-kit`: ok (check docs test build probe, 11.9s). Log: `prove.log`.
3. golden-3, Claude `claude-sonnet-5-5` (no model named in evals/; default used), public mode, no throwaway home needed (the probe only needs `--setting-sources project`, which the harness passes).
   - Attempt A: stopped at iter=0, `probe=failed` (V0008 x9, 10.9s, 25138/285 tokens, $0.057). Harness cause below. Log `$TMPDIR/keel-app-trials/golden3-claude.log`.
   - Attempt B (after the fix): probe passed; iteration 1 was 3.5 minutes in (31 files written) when the coordinator asked for a stop; run killed, no transcript written (the harness writes it at the end of an iteration). Not converged, no trailers. Partial project (no node_modules): `/var/folders/7v/kffh1c8x40db4_1cmbryn2_c0000gn/T/keel-app-trials/partial/golden-3`; probe transcript `.../partial/transcript-probe.jsonl`. Log `golden3-claude2.log`.
4. Codex run: not started. `evals/h2h.ts --arm keel --agent codex` builds the Recipe box (`evals/headtohead/brief/BRIEF.md`), not golden-3; golden-3 has no Codex path (`evals/run.ts` runners are claude|none). Run as it is.

## Harness problem and fix

`replyFindings` (evals/public/isolation.ts) false-positived on the agent's honest answer to the probe question: (1) macOS spells the temp project `/private/var/...`, the harness `/var/...`; (2) relative `.claude/skills/keel/SKILL.md` was read as `/skills/keel/SKILL.md`. Fixed with a selftest case (`pnpm eval:public selftest` ok). Commit `fix(evals): the probe reads relative and realpath spellings ...`.

## Findings so far (a to f)

Only one: the probe itself (above) failed a clean public setup on macOS, so every macOS run of golden-3 public mode was blocked before the agent started. Nothing yet on agent stuck points, repeated diagnostics, missing docs, gate holes, quality, tokens. Note: the agent's own probe reply showed it loads `CLAUDE.md` and `.claude/skills/*` from the project only.

Also: the run takes more than 30 minutes per iteration; `pnpm eval` has no progress output until an iteration ends.

## Next run

```
cd /Users/jforsythe/orca/workspaces/keel/test-impl/.worktrees/app-trials
pnpm eval:public pack --out $TMPDIR/keel-kit   # only if the kit is gone
pnpm eval --task golden-3 --runner claude --model claude-sonnet-5-5 --max-iter 3 --keel-kit $TMPDIR/keel-kit > $TMPDIR/keel-app-trials/golden3-claude3.log 2>&1
```
Transcripts are in the throwaway `keel-public-*` folder under the temp dir while the run lives and are removed at its end: copy `transcript-*.jsonl` out first, and keep the import in `apps/golden-3`. Then Codex: `pnpm eval:h2h --arm keel --agent codex --keel-kit $TMPDIR/keel-kit`.

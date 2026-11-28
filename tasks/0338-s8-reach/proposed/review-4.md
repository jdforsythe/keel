# Review round 4: 94955772..HEAD and the rfc:0110 commits

Method: keel-review checklist per unit. Read RFC, spec section, diff, tests. Ran: `pnpm ledger --diff` (ok, 0 lowered, 0 uncovered, 36 stale W1714, 18 unsafe), `pnpm budgets` (ok, 135 measured), one throwaway vitest probe in @keel/check (deleted). Not run, by machine rules: root `pnpm check`, `pnpm test`, any suite. No `as`/`any`/`!`/`@ts-ignore` appears in added non-test lines of any unit.

Found no BLOCKING issue. 1 MAJOR, 8 MINOR.

## MAJOR

### M1. Server `req` path rule and last-resort behaviour live only in the README: no spec sentence, no conformance
- Files: spec/kernel/k.privacy.md:30 ("A secret route param is `[secret]` in the `req` path."), packages/server/README.md (rule paragraph), packages/server/src/internal/secretSegments.ts:1-53, packages/server/src/createApp.ts:152 and :192-206.
- Scenario: the rule (every route of the table incl. other deployables, line-up from first non-empty segment, tail ignored, case-flipped and undecodable static segments fit, prefix param may be omitted) and the last resort (diag names the matched route id; one fixed stderr line once per process) are pinned only by `packages/server/test/{reqPathEscapes.property,reqPathForwarded,lastResort}.test.ts`. `packages/server/conformance/privacy-req-path.test.ts` was not touched. Anyone may edit test/ without an RFC, so the privacy behaviour is not frozen. Definition of done says spec section cited and conformance green.
- Confirmed by running: no (reading spec/conformance diff).
- Smallest fix: one RFC adding two k.privacy/k.server clauses (the line-up rule in one sentence; last-resort diag names route id, stderr line once) and conformance-writer cases for the mistyped-link and forwarded-peer paths.

## MINOR

### m1. blankLabel misses a namespace import
- packages/check/src/rules/blankLabel.ts:48-52 (`o.name.type !== "JSXIdentifier"`, `n.callee.type !== "Identifier"`) and packages/check/src/internal/modules/localNames.ts (ImportSpecifier only).
- `import * as ui from '@keel/ui'; <ui.Box as="nav" label="">` -> 0 E1802 findings. Confirmed by running (probe: ns 0, named 1).
- Fix: follow `ImportNamespaceSpecifier` and match `JSXMemberExpression` / `MemberExpression` callee; or state in k.a11y that only named imports are read.

### m2. blankLabel reads a JSX entity as non-blank
- packages/check/src/rules/blankLabel.ts:23-26. `<Box as="nav" label="&#32;">` -> 0 findings (confirmed by probe), yet the DOM gets a space. Also `<Box as="div" label="">` is flagged although label is optional there (RFC C1 chose this; fine, just noting the spec sentence "A blank literal label ... is E1802 too" is the only support).
- Fix: decode `&#..;` entities in the attribute string before the test, or add the case to the "unchecked" list in the spec.

### m3. Stderr line from `logUnwritable` is not in the OUTPUT.md formats
- packages/server/src/internal/logUnwritable.ts:4. A plain sentence is written even when `KEEL_FORMAT=json`; OUTPUT.md says a built server's mode follows `KEEL_FORMAT`. Not run.
- Fix: emit it as the same `diag` record shape (`{"kind":"diag","code":"keel.unexpected",...}`) when format is json, or add it to OUTPUT.md as the one fixed unstructured line.

### m4. Rule 11 in a conformance header
- packages/std-schedules/conformance/first-fire-err.test.ts:1 ends with "(rfc:0113)". Task/RFC ids belong in the commit message. Fix: drop the tag.

### m5. Redundant branch in runSchedule
- packages/std-schedules/src/internal/runSchedule.ts (`mark === undefined || !had.has(p)`): after the start write every entry has a mark, so `mark === undefined` is dead; `had` is the only test needed. No wrong result. Also no test that an entry that already has a mark causes no start write, nor that a failing start write rejects `run` (RFC states it). Fix: add both cases to packages/std-schedules/test/startMark.test.ts; drop the dead test.

### m6. Over-marking in req path for routes with no static prefix
- secretSegments.ts:20-24. A route `/:token` or `/:lang/:token` with a secret `token` makes the first segment of every path `[secret]` (e.g. `/healthz`, `/static/app.js` -> `[secret]/app.js`). Follows the stated rule ("a param fits any segment"), so not a bug, but it blinds the log for such an app. Not run.
- Fix: none required; consider a W-code at `createApp` when a secret param is at index 0 or 1 of a route with no static segment before it.

### m7. Resume `mode: "dev"` has no conformance case
- RFC 0119 conformance covers `mount` with `mode: "dev"` (mount-onerror.test.ts) but the `resume` dev path (message in the island fallback, `rootCatcher(ctx, mode, ...)`) is pinned only in packages/runtime-dom/test/resumeRootCatcher.test.ts. k.runtime "Both take `mode`" is pinned for `resume` only through entry text. Fix: one resume dev case in packages/runtime-dom/conformance/resume-root-catcher.test.ts (rfc PR).

### m8. 0111: `keys` in `#k-state` and a second derivation of keys
- packages/std-sessions/src/group/internal/openHub.ts:~30 re-implements "keys from log entries" that `store.restore` already does (second way, P1). Fix: pass the snapshot through unchanged and let `restore` derive. Separately docs/THREAT-MODEL.md does not mention that `snapshot()` (so `#k-state`) now exposes the last `logLimit` keys including those of undone or folded entries; keys are client-chosen and entries already carried them, so the exposure is small. Not run.

### m9. Stale mutation claims
- `pnpm ledger --diff`: 36 W1714 stale claims (store.ts, runSchedule.ts, resumeEntry.ts, entryCode.ts, reactive dispose.ts/disposeOwned.ts/refresh.ts, among others). Scores shown (store 91.13, compiler 78.98, runtime-dom 77.97) are above thresholds but were measured before some of these edits. Fix: `pnpm --filter @keel/store mutate` etc. when the machine is free.

## Units
- RFC 0111 (store keys): clean apart from m8. Code matches spec bullets 6, 11, 12; undo/fold leave `keys`; restore without `keys` derives before fold and keeps latest `logLimit`; saveStores `before` is taken after restore so an old snapshot is not seen as changed. Conformance flips pin the sentences; a property test models `keys`. Untested: explicit `keys` longer than `logLimit` on restore (code is right).
- RFC 0113: clean apart from m4, m5.
- RFC 0118: m1, m2, m4-free. Rule otherwise matches the RFC (no fix, see k.a11y, per-file).
- RFC 0119: clean apart from m7. Confirmed a Vite production build folds `import.meta.env?.DEV` to `false` (probe in the scratchpad), so the entries give "production" in a bundle.
- RFC 0110: clean. `reveal` calls the slot before `Secret.open`; server memo is per scope set; conformance covers module, cached, runner, overlap and the stated limit; docs (THREAT-MODEL, COMPLIANCE, READMEs) updated; budgets pass (server 23.75kb, check 54.25kb, schema within).
- Server req path / last resort: M1, m3, m6; logic otherwise matches the README rule.
- Reactive disposal fix (72216f23, outside the range, before 94955772): clean. Order owned-then-hooks, fn error wins in `scope()`/`run()`, hook error wins over a rerun's own throw; property test over ownership trees present.
- Not reached: the compiler README/vite-project wording beyond the entry strings; a full read of runtime-dom test edits (boundary-effects etc.) and the std-statecharts fixture comment.

Note: an untracked file packages/server/test/zz-rt4-probe.test.ts exists in the tree; it is not mine and I did not touch it.

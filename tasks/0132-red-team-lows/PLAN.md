# Task 0132-0137: red-team 2026-11-07 lows, batch 4

**Spec:** k.compiler k.runtime (0132, 0133) · k.server (0134, 0136) · std.timings std.money (0135, 0137) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0132 (agent A done: rfc:0056, ADR-0045; data, srcset, imagesrcset, to/from/by/values policed; lists policed per item, one bad item → about:blank; `<base href>` is E1003 literal or bound and never rendered; k.compiler 1,500, k.runtime 1,498 tokens) URL policy covers `object data`, SVG `<set>`/`<animate>` `to`/`values`, `srcset`, `<base href>` (runtime-dom, compiler)
- [x] 0133 (agent A: `attr` drops /^on/i names silently; compiler E1002 on an on* string in a spread literal) `attr` refuses `on*` names so a JSX spread never creates an inline handler (runtime-dom)
- [x] 0134 (agent B done: rfc:0057, ADR-0046; `__Host-keel-caller` when secure (createApp({ secure }) or request scheme, x-forwarded-proto untrusted); value is token.mac HMAC-SHA-256 under createApp({ secret }), default 32 random bytes per createApp; unsigned value = no cookie; residual risk documented; old caller-token.test.ts removed, replaced by caller-token-signed + caller-cookie-host-prefix) `__Host-` caller cookie on https; a cookie that is not ours is not accepted (server)
- [x] 0136 (agent B: immutable only for manifest names ending -<8+>.<ext>, else no-cache; nosniff on every asset; realpath inside assets/; entry outside assets/ is E1555; server 11,724/11,776 B) `assets/` immutable only for hashed names, `nosniff`, no symlink following (server)
- [x] 0135 (agent C done: 256-name cap, first kept; re-register skipped when reader name and schema doc match; different definition still E1057) std-timings: cap on section names; re-registering the same section is idempotent, not E1057 (std-timings)
- [x] 0137 (agent C done: unit test asserts dedup and rejection with a plain Error; the schema registry has no code for it, old conformance import() test left in place) std-money registry test asserts dedup and rejection of a different schema (std-money)

## Steps
1. [x] PLAN; three agents in parallel: A runtime-dom+compiler (0132, 0133); B server (0134, 0136); C std-timings + std-money (0135, 0137).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 405 items, 361 verified, 6 unsafe, 0 lowered, 0 uncovered`. Reviewer + red-team running.
3. [x] 0159/0161/0163/0164 fixed in-batch (E1556 short secret, W1556 production without secret, hash rule + decoded paths + weak ETag, per-instance register, real dedup assertion; server budget 11.5 → 12 kB, 12,019 B, D7); final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 405 items, 361 verified, 6 unsafe, 0 lowered, 0 uncovered`; commit by path (rfc:0056/0057), flip backlog, handoff, push.

## Decisions
- D1: Ownership by package: A packages/runtime-dom, packages/compiler; B packages/server; C packages/std-timings, packages/std-money. RFC numbers 0056 (A), 0057 (B); C needs none unless a std spec clause changes (0058 reserved).

- D2: red-team batch 4 filed 0156-0164; 0159 (short/empty secret), 0161 (unhashed names immutable, undecoded paths, no ETag), 0163 (second std-timings copy skipped), 0164 (vacuous dedup test) are fixed in-batch by agents B and C; 0156 (server DOM lacks querySelector: bound elements below the root 500 on plain node; pre-existing, serious, first in batch 5), 0157 (`<script>{x}</script>` compiles silently), 0158 (meta refresh outside the URL policy), 0160 (fixation; secure default behind a proxy), 0162 (first-come cap crowding) stay as follow-ups.

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro is a failing-then-passing test

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1410 files` · `ok budgets 46 measured` · `ok ledger --diff 405 items, 361 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 5: 0156 first, then 0157, 0158, 0160, 0162, 0149, 0150, 0152, 0154, 0155.
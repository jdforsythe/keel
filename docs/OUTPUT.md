# Output contract

Every `keel` command and every `pnpm` script has one data model and three renderings. The agent-facing rendering is the default.

**Mode.** `--format=compact|json|pretty`. Default `compact` when stdout is not a TTY or `KEEL_AGENT=1`; `pretty` on a human terminal; `json` for tooling. A built server (`node server.mjs`) takes no flags: `KEEL_FORMAT=json` sets its mode.

**Diagnostic shape** (check, test, build, bench, audit, session):

```
E1042 src/cart/add.tsx:14:7 write to state not owned by this component
  fix: -  cart.items.push(item)
       +  tx.cart.addItem({ item })
```

Fields: `code` (stable, E/W/I prefix, never renumbered) · `path:line:col` · `message` under 90 chars · optional `fix` as a unified diff hunk · optional `see` (spec section id). The code is the key to `keel explain E1042` and `keel spec --for E1042`.

**Compact rules**
- Passing tests, successful builds, clean files are silent. One trailer line: `ok 412 tests, 0 failed, 3 skipped (1.8s)`.
- Group by code, cap at 5 per code, then `... +17 more E1042 (keel check --code E1042)`.
- Stack traces: app frames only, max 5, relative paths.
- Test failures: compact diff of serialized state, never two dumps.
- No progress bars, spinners, colors, banners, timestamps in compact or json.
- Relative paths. No ANSI.
- Every command accepts `--quiet` (trailer only) and `--limit N`.
- `--verbose` exists; skills say to use it only with a stated reason.

**JSON.** NDJSON: `{"kind":"diag","code":"E1042","path":…,"line":…,"col":…,"message":…,"fix":…,"see":…}` per line, then `{"kind":"summary",…}`. Other commands emit their own record kinds (`ledger`, `property`, `example`, `spec.section`, `spec.cite`, `explain.text`, `inspect.section`, `inspect.store`, `scaffold.edit`, `quickfix`, `invalid`, `unparsable`, `session`, `session.issue`, `conflicts.race`, `report.tally`, `mutate.run`, `ledger.mutation`, `session.monitor`, `csp`, `evidence`); warnings are `diag` records with a `W` code (W1005, W1556, W1557, W1706). With `--limit N` json caps too; otherwise json is uncapped.

`session` (std.sessions): `{ kind, id, fingerprint, route, events, inputs, error, file }`; compact `7f3a9c01d2e4 orders.show 42 events orders.locked`, `ok` for no error, ` -> <file>` when one was written. `session.issue` (`keel-session-action`): `{ kind, fingerprint, action, issue }`, `action` one of `created`, `updated`, `commented`; compact `7f3a9c01d2e4 created #12`.

`ledger.mutation` (k.ledger): `{ kind, file, score, survived, fresh }`, one per mutation claim of `keel ledger`, `score` in percent; compact `src/store.ts 84.2% 3 survived`, with ` stale` after it when `fresh` is false.

`csp` (k.security): `{ kind, directive, blocked, route }`, one per accepted policy report, `blocked` one of `inline`, `eval`, `trusted-types` or the blocked URL's origin, `route` a route id or `-`; past 100 reports in 60 s the window's end writes `{ kind, dropped }`.

`evidence` (k.evidence): `{ kind, dir, at, keyId, files }`, one per verified bundle; compact `ok evidence evidence/2026-11-10 6 files key 3f2a9c01d2e4b5a6`.

`session.monitor` (std.monitor): `{ kind, origin, transactions, runs, file }`; compact `ok session monitor 12 transactions, 340 runs -> .keel/monitored.json`.

`conflicts.race` (std.conflicts): `{ kind, code, path, store, entry, against, reason }`, `code` E2701 (a race) or W2702 (an unchecked entry), `path` the file the analysis read; compact `E2701 <file>:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board`, or `W2702 <file>:1:1 unchecked api.editTodo #6 on api.board (folded)`.

**Budgets, enforced in CI** (`tooling/budgets.json`): `keel check` (the real checker, compact) on a copy of golden app 1 with 10 injected errors <= 600 tokens; `keel explain` <= 300, `keel spec --for` <= 400, MCP `tools/list` <= 1,500 tokens; `keel test` with 3 failures <= 400 tokens; `keel spec <section>` <= 1,500 tokens; spec map <= 1,200 tokens. Package size (`size` entries, every package; `platform: "node"` for node-only ones): the package's own code bundled from `src/index.ts` by esbuild, minified, dependencies external, gzipped.

**Internal rule.** Keel's own scripts, runners, and hooks obey this contract from task 0001.

verified: ba2e93d07753bee6dc64c62cabd402f1b798b6df

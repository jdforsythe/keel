# Output contract

Every `keel` command and every `pnpm` script has one data model and three renderings. The agent-facing rendering is the default.

**Mode.** `--format=compact|json|pretty`. Default `compact` when stdout is not a TTY or `KEEL_AGENT=1`; `pretty` on a human terminal; `json` for tooling. A built server (`node server.mjs`) takes no flags: `KEEL_FORMAT=json` sets its mode.

**Diagnostic shape** (check, test, build, bench, audit, session):

```
E1042 src/cart/add.tsx:14:7 write to state not owned by this component
  fix: -  cart.items.push(item)
       +  tx.cart.addItem({ item })
```

Fields: `code` (stable, one letter and four digits, never renumbered) · `path:line:col` · `message` under 90 chars · optional `fix` as a unified diff hunk · optional `see` (spec section id). The code is the key to `keel explain E1042` and `keel spec --for E1042`.

**Compact rules**
- Passing tests, successful builds, clean files are silent. One trailer line: `ok 412 tests, 0 failed, 3 skipped (1.8s)` from a `pnpm` script; `keel` commands print the same line without the timing. A tooling script's trailer is `ok <name> <count> <unit>, ... (1.8s)` (`ok check 81 tasks (29.1s)`), and a script with a line of its own prints it whole (`ok voice-lint 2911 files`). A failed run ends on one `fail <name>` trailer (`fail build`) and prints no `ok` line.
- Group by code, cap at 5 per code, then `... +17 more E1042 (keel check --code E1042)`; a tooling script prints `(--code E1042)`.
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

`report.tally` (std.report): `{ kind, id, rows }`, `rows` of `{ key, n }` by `n` descending, then `key`; one per tally section `keel report` reads; compact `orders.status paid=3 open=1`, `orders.status 0` without rows, then `ok report 1 tallies`.

`conflicts.race` (std.conflicts): `{ kind, code, path, store, entry, against, reason }`, `code` E2701 (a race) or W2702 (an unchecked entry), `path` the file the analysis read; compact `E2701 <file>:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board`, or `W2702 <file>:1:1 unchecked api.editTodo #6 on api.board (folded)`.

**Server log.** A built server (`node server.mjs`) and `keel dev` write one record per line through the app's `log` sink, in compact or json. A `req` record is `GET /orders/7 orders.show 200 12ms` (method, path, route id omitted when none matched, status, time) or `{"kind":"req","method":…,"path":…,"route":…,"status":…,"ms":…}`; a `diag` record is `E1554 <message>` or `{"kind":"diag","code":…,"message":…,"see":…}` with `frames` (at most 5 app positions) for a throw; `csp` records are above. Each record is one line of at most 8,192 characters plus a `req` record's route id (k.serverlog): a control character, U+2028, U+2029 or `…` in a written value is `\u` and four hex digits, and a message or path past 2,048 characters, or a frame or method past 256, ends in `…+<n>`, `n` the characters left out, so `…` in a record always marks a cut. A value marked `.pii()` or a revealed `Secret` is `[pii]` or `[secret]` in every record of its request, the `req` path included (`GET [secret] app.reset 200 4ms`). When the sink's `write` throws on the last `diag`, stderr gets the one fixed line `keel.unexpected log write threw, records lost (once per process)`, once per process, holding no value. That record follows `KEEL_FORMAT` as the log does: under json it is the `diag` object `{"kind":"diag","code":"keel.unexpected",…}`.

**Budgets, enforced in CI** (`tooling/budgets.json`): `keel check` (the real checker, compact) on a copy of golden app 1 with 10 injected errors <= 600 tokens; `keel explain` <= 300, `keel spec --for` <= 400, MCP `tools/list` <= 1,750 tokens; `keel test` with 3 failures <= 400 tokens; `keel spec <section>` <= 1,500 tokens; spec map <= 1,200 tokens. Package size (`size` entries, every package; `platform: "node"` for node-only ones): the package's own code bundled by esbuild from `src/index.ts` (a subpath entry from `src/<sub>/index.ts` or `src/<sub>.ts`), minified, dependencies external, gzipped.

**Tooling codes.** Each `pnpm` script owns a code prefix (`T` is a failed test from `keel test` and the test reporter): `B` budgets, `D` docs-freshness, `E` spec, turbo, handoff and mutate plumbing, `F` format-check, `M` mutate, `O` orphans, `S` structure-lint, conformance-guard and generate, `V` voice-lint (V0003); `W` and `I` codes are advisory and never fail the run.

**Internal rule.** Keel's own scripts, runners, and hooks obey this contract from task 0001.

verified: 35de06f8d4339b737d647838e5ff50a923463c10

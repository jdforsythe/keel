# Spec status audit for backlog 0659

Audit of coverage only. No test or build was run; passing is taken from the green root gates of 2026-11-16. Rule applied: a Conformance clause is COVERED when a `// Spec:` header (or the twin header "Same clause as ...") quotes it in a file with no skipped test and a test body that asserts what the clause says. PARTIAL means the file quotes the clause but the assertion is narrower, or a comment says part is not observed. NONE means no test.

Paths are under `packages/`. Searching for headers needs the loose pattern `Spec: <section>`: k.topology and k.hosting headers also appear as `clause "..."`, `Conformance, "..."` and `Runners, "..."`. No file cited here contains `.skip`, `.todo`, `.fails`, `.skipIf` or `.runIf`.

## k.persist (status line: proposed), 12 clauses

1. COVERED. `read(keys)` order and `null`: `ctx/conformance/storage-read.test.ts`, test "`read(keys)` returns each key's value in the order asked...", on a sim ctx and on a file driver, asserts `toEqual` of the expected order.
2. COVERED. `commit` stores, stale resolves false, condition-only write: `ctx/conformance/storage-commit.test.ts`, one test with three assertions groups (all match, one stale stores nothing, write without `value`).
3. COVERED. Generated interleavings equal a serial order and no read cuts a commit: `ctx/conformance/storage-serial.test.ts` (property, 100 runs, `someSerialOrder` check and `result[0] === result[1]`).
4. COVERED. E1605 and E1606: `ctx/conformance/drivers-e1605-e1606.test.ts` (sim ctx with `drivers: {}` throws E1605; a key twice rejects E1606, on sim and file storage).
5. COVERED. `drivers.storage` is `ctx.storage`: `ctx/conformance/drivers-real.test.ts` asserts `toBe(storage)` for `real` and `shell`.
6. COVERED. Two `createApp`s on one sim ctx, later save 409, earlier values stored: `server/conformance/save-across-apps.test.ts`.
7. COVERED. Two-store action whose `commit` resolves false stores neither, one `commit` naming both keys: `server/conformance/save-atomic.test.ts`.
8. COVERED. `commitStores` refused twice then accepted runs `fn` three times; refused three times is `keel.conflict`: `server/conformance/commit-stores-retry.test.ts` (refusals 0 to 5, counts runs, commits, stored data).
9. COVERED. `commitStores` one `save` event per changed store, none when unchanged, `from` and `head` checked: `server/conformance/commit-stores-save-events.test.ts`.
10. COVERED. `restore` of a log naming an undeclared transaction: `store/conformance/restore-older-snapshot.test.ts` (ok, state, head, empty `log()`, `initial` equals `state`; also the refused-payload and refused-state cases).
11. COVERED. Second ctx on `f` reads the value: `ctx/conformance/storage-option-0088.test.ts`.
12. COVERED. `commitStores` and `loader` at `packages/p/src/run.ts` no E1551, at `modules/a/run.ts` two: `check/conformance/E1551-scope.test.ts`.

Rules codes: E1605 reported by `ctx/conformance/drivers-e1605-e1606.test.ts`; E1606 the same file; E1551 scope by `check/conformance/E1551-scope.test.ts` (also covers `*.server.ts`, test files, config files, `unsafe/`, `.keel/`, `node_modules/`).

Verdict: all 12 COVERED. Can move to `conformance-covered`.

## k.prove (status line: proposed), 9 clauses

All tests are in `testing/conformance/`.
1. COVERED. Counter proves, `n - 1` rejects E1716 with `{ n: 0 }`: `prove-counter.test.ts`, tests "a store { n: s.int({ min: 0, max: 9 }) } ... proves" and "with dec as n - 1 the proof rejects E1716 with state { n: 0 }".
2. COVERED. No `max` rejects E1716 at `9007199254740991` with the safe-range line (asserted equal to `safeLine`), and `a.length + 1` proves: `prove-counter.test.ts`.
3. COVERED. Imported helper rejects E1715 naming the call (message contains `isDeepStrictEqual`): `prove-e1715.test.ts`.
4. COVERED. Guarded append proves, unguarded rejects E1716 with a state holding two equal ids: `prove-unique-ids.test.ts`.
5. COVERED. True but not inductive rejects E1716 with state `n: 3` that `explore` never reaches: `prove-not-inductive.test.ts`.
6. COVERED. `initial` breaking an invariant rejects E1716 with the state and no payload: `prove-initial.test.ts`.
7. COVERED. Byte-equal verdicts and counterexamples over two runs: `prove-deterministic.test.ts`.
8. COVERED. `rlimit: 1` rejects E1717 where the default proves: `prove-e1717.test.ts`.
9. COVERED. Without `z3-solver` rejects E1718 (module mocked to throw, message names the package): `prove-e1718.test.ts`.

Rules codes: E1715 `prove-e1715.test.ts` (call, loop, reassignment, schema without a sort for payload and state, message shape, invariant form); E1716 `prove-e1716.test.ts`; E1717 `prove-e1717.test.ts`; E1718 `prove-e1718.test.ts`.

Verdict: all 9 COVERED. Can move to `conformance-covered`.

## k.shell (status line: proposed), 6 clauses

1. COVERED. Tauri files written, no Capacitor file, a changed byte is E1005 with a fix that restores it, removing `tauri` removes the files: `scaffold/conformance/shell-files.test.ts` (real `keel build` and `keel check` over a temp project; tampers each of the six files).
2. COVERED. `tauri.conf.json` identifier, productName, version, and the policy with `ipc: http://ipc.localhost` in `connect-src`: `scaffold/conformance/tauri-conf.test.ts`, compared to `dist/web/csp.txt`.
3. COVERED. E1573 for `shells` on a `node` deployable and for `id: 'golden'`: `check/conformance/E1573.test.ts`.
4. COVERED, with a weak reading. E1574 unset names the key, exit 1, no `dist/web`: `cli/conformance/build-target-e1574.test.ts`. "With `http://localhost:8080` it proceeds" is asserted as "reports no E1574" because the test runs with an empty `PATH` (header comment: proceeds is read as reports no E1574; it then stops at E1575). The proceeds half is checked by `compiler/conformance/shell-entry.test.ts`, which builds with `KEEL_ORIGIN=https://app.example` and fake tools to exit 0.
5. COVERED. No `cargo` prints one E1575 naming `cargo` and `1.95`, exit 1, nothing under `dist/web/tauri/`: `cli/conformance/build-target-e1575.test.ts`.
6. PARTIAL. `compiler/conformance/shell-entry.test.ts` asserts the `www` bundle matches `mode: 'shell'` and the plain `client` bundle is unchanged before and after (strong). For "the package's drivers" it asserts only `expect(joined(www)).toMatch(/drivers/)`. That word occurs in the bundled `createCtx` code itself, so the assertion cannot fail on a wrong or missing driver. Test to unblock: assert that the `www` bundle imports `@keel/std-tauri` and passes the result of `tauriDrivers({ origin })` as `drivers` to `createCtx` (and the Capacitor twin for a `capacitor` declaration).

Also tested but not a clause: `cli/conformance/build-target-tools.test.ts` covers the icon rule, the `www` layout and a failing tool printing at most 12 lines.

Rules codes: E1573 `check/conformance/E1573.test.ts`; E1574 `cli/conformance/build-target-e1574.test.ts`; E1575 `cli/conformance/build-target-e1575.test.ts` (missing `cargo` only; the file's header comment says "too old" and the Capacitor toolchain checks (JDK 21, Android SDK, Xcode 26, WebKitGTK) are UNTESTABLE as written, and no test covers them).

Verified only with fakes: every k.shell clause is about files the build writes, diagnostics the build or `check` prints, or the generated entry text. Clauses 5 and 6 and the Build tests use fake `cargo`, `rustc`, `pkg-config`, `java` and `npx tauri`/`cap` scripts that exit 0. No test runs Gradle, Xcode, `cargo` or `tauri build`, and no test runs a native app. The clauses do not ask for a running app, so fakes are an honest way to test them. The Shell ctx contract (origin map, cookies, native storage) is a prose section without its own clauses; its tests are the std.shells clauses below, over Capacitor's web implementations and Tauri `mockIPC`. That a built debug app starts and works on a device is covered by no test; it was checked by hand on one Mac.

Verdict: stays `proposed`. Blocking clause: 6 (PARTIAL). Unblock with the driver assertion above. E1575 "too old" is not a clause but is untested.

## k.topology (status line: implemented), 9 clauses

1. COVERED. `{ one: [a, b] }` and `{ x: [a], y: [b] }` give equal statuses, bodies and final store states over generated request scripts: `cli/conformance/topology-one-vs-split-equivalence.test.ts` (compares status and text per request, and `stateOf(xCtx, yCtx)` to `stateOf(oneCtx)`).
2. COVERED. Forwarding returns `y`'s status, headers and body, 502 `keel.unreachable` with `y` down (no host named), `x-keel-forwarded` not forwarded again: `server/conformance/topology-forwarding-unserved-paths.test.ts`.
3. COVERED. One deployable makes no `ctx.net.fetch`; split makes one to `http://y.test/b/<n>`: `cli/conformance/topology-service-in-process-vs-net.test.ts`.
4. COVERED. Runners run once, none of another deployable, `close()` aborts and resolves after each `run` settles, a rejection reruns at 1,000 ms on the sim clock (999 no, 1 more yes): `server/conformance/topology-runners.test.ts`; also `topology-close-aborts-event-streams.test.ts`, `runner-rejection-diag-0092.test.ts`.
5. COVERED. Same path in two deployables is one E1559 in `check` and in `build`, naming both routes, none when in one deployable or paths differ: `cli/conformance/topology-e1559-same-path.test.ts`.
6. COVERED. `origin` `https://a.example`: POST from that Origin to another host is not 403, action runs, cookie `__Host-keel-caller=` with `Secure`: `server/conformance/topology-origin.test.ts`.
7. COVERED. `keel dev` real child process answers `/`, `/ax`, `/by` of one `client` and two `node` deployables on one port: `cli/conformance/topology-keel-dev-one-origin.test.ts`.
8. COVERED. Loader or action naming `stores` and `async function*` loader in a `client` module are each one E1558 in `check` and `build`, `createApp` throws, none under `node`: `cli/conformance/topology-e1558-client-stores-0095.test.ts`.
9. COVERED. The three unreadable forms (`async function*` by name, `import * as r`, spread options) are each one E1558, a plain `async function` is none: `cli/conformance/topology-e1558-unreadable.test.ts`.

Rules codes: E1552 `check/conformance/E1552-nested-root.test.ts`, `server/conformance/e1552-topology-modules.test.ts`; E1553 `server/conformance/e1553-static-params.test.ts`; E1558 the three files above plus `server/conformance/e1558-live-loader-non-node.test.ts`; E1559 `cli/conformance/topology-e1559-same-path.test.ts`; E1511 (owned by k.api) `server/conformance/api-routes-0086.test.ts`; E1560 (owned by k.deploy) `server/conformance/e1560-deploy-env.test.ts`.

Verdict: all 9 COVERED. Can move to `conformance-covered`.

## k.hosting (status line: implemented), 6 clauses

All in `server/conformance/hosting-0087.test.ts` unless noted.
1. COVERED. `keel build` writes `dist/web/index.html` and hashed assets, every URL root-absolute or absolute, no relative module imports in JS.
2. PARTIAL. The built `index.html` has one `keel-peer` tag for `api` with content `https://api.test`, unset gives no tag, `KEEL_PEER_API=nope` fails with one E1565 naming the key and not the value: asserted. The `service({ module })` call fetching `https://api.test` plus the path with `credentials: 'include'`, and the unset call going to the document's origin, are not asserted. The header comment says: "GAP: the client entry's binding of `keel-peer` tags to `ctx` has no public API and runs only in a browser, so the `service({ module })` fetch URL and `credentials: 'include'` are not observed ... The unset case (document's origin) is likewise unobservable." The test checks only that the built entry text contains `keel-peer`. No other file covers it. Test to unblock: load the built client entry (or the compiler's generated entry code) in happy-dom with a `keel-peer` tag in the document and a sim ctx, call a `service({ module: 'api' })` endpoint, and assert the sim net sees `https://api.test/<path>` with `credentials: 'include'`; repeat without the tag and assert the document origin.
3. COVERED. Allowed origin preflight is 204 with the six headers (origin, methods without delete, headers list, credentials, max-age 600, vary), no guard, loader or action ran; POST runs once and carries the response headers; `https://other.test` gets 405 and 403 with no CORS header; page preflight 405. `bearer-0104.test.ts` adds the bearer interplay.
4. COVERED. `KEEL_ALLOW_ORIGINS=*` exits 1 with one E1560 naming the key.
5. COVERED. `sec-fetch-site: cross-site` from an allowed origin logs W1567 once per origin (second origin logs its own).
6. COVERED. `host: 'api'` serves `index.html` for `GET /` and an unknown page with `no-cache`, 404 for an unmatched runtime GET, a client asset `immutable`, and E1566 for `host` naming a `client` deployable.

Rules codes: E1565 `hosting-0087.test.ts` (also `scaffold/conformance/peer-key-0091.test.ts`); E1566 `hosting-0087.test.ts` (the four forms in one test) and `check/conformance/fix-diffs.test.ts`; W1567 `hosting-0087.test.ts`.

Verdict: stays `implemented`. Blocking clause: 2 (PARTIAL), unblock with the client-entry fetch test above.

## std.db (status line: proposed), 8 clauses

All in `std-db/conformance/`.
1. PARTIAL. `driver-contract.test.ts` runs the storage clauses (get/set, read order, commit all, stale, condition-only, serial, E1606) on a temp SQLite file and on PGlite. The clause names "a Postgres 17 service in CI". `fixtures.ts` uses a real Postgres only when `KEEL_TEST_POSTGRES_URL` is set, and no file under `.github/workflows/` sets it or declares a Postgres service, so no Postgres 17 run exists. Unblock: a CI job with a `postgres:17` service and `KEEL_TEST_POSTGRES_URL`, or an amendment of the clause to PGlite.
2. COVERED. Two real child processes on one SQLite file, overlapping actions: one 200, one 409, file holds the first's snapshot: `two-processes-409.test.ts`.
3. COVERED. Real SIGKILL then restart serves the same stored snapshot string and the next commit's head is `head + 1`: `sigkill-restart.test.ts`.
4. COVERED. Two connections, generated commit sequences equal a serial order of the resolved commits, per driver: `serial-commits.test.ts`.
5. COVERED. Empty database opens at layout 1; layout 2 to 50 is E2152 and exit 1 (child process for SQLite, `process.exit` stub for PGlite): `layout-e2152.test.ts`.
6. COVERED. Refused connection prints one E2153 naming `KEEL_DATABASE_URL`, with no user, password, database or URL part: `e2153-no-value.test.ts`, on SQLite and Postgres.
7. COVERED, with a weak second half. `@keel/std-db/sqlite` import in an app file is one E2151 (all four specifiers, no fix): `e2151.test.ts`. "The generated entry is not" is shown only by a project without the import; no generated entry is given to `check`, so that half cannot fail.
8. COVERED. After an overwrite and `close()` the SQLite file bytes hold the new marker and not the old one: `secure-delete.test.ts`. The test overwrites through `commit`, not through a store fold, as its comment says.

Rules codes: E2151 `e2151.test.ts`; E2152 `layout-e2152.test.ts`; E2153 `e2153-no-value.test.ts` ("also when its `layout` is not a version" has no test).

Verdict: stays `proposed`. Blocking clause: 1 (PARTIAL).

## std.workflows (status line: proposed), 8 clauses

All in `std-workflows/conformance/`.
1. COVERED. Event changes only its instance to `chart.next`, others unchanged, unknown id inert, `entered` and `attempt` checked: `next-per-instance.test.ts`.
2. COVERED. Step runs once with `key` `<id>:<flow>:<entered>`, moves by `done` with the `ok` value: `step-runs.test.ts`.
3. COVERED. Three `err` with `attempts: 3` ends in `failed` with the code; never-settling run ends with `workflows.attempts`: `step-fails.test.ts` (three tests).
4. COVERED. Wait moves at or after `ms` and not before, undo first leaves the wake job doing nothing: `wait.test.ts`.
5. COVERED. `close()` during a pending run, a second `createApp` on the same ctx reruns with the same `key`, `done` taken once: `restart-step.test.ts`.
6. COVERED. Restore of the snapshot, and replay of the log from `initial`, both equal the state: `replay.test.ts`.
7. COVERED. `/__keel/inspect` section `workflows.instances` has numeric counts and the generated secret string appears nowhere: `inspect.test.ts`.
8. COVERED. E2351, E2352, W2353, E2354, E2355 each fire and have a clean twin; `workflow` throws E2352 and E2355: `rules.test.ts`.

Rules codes: all five reported by `rules.test.ts`. Untested detail: E2354's "a module with no `jobs.server.ts` or `runners.server.ts` is reported on the workflow's file, without a fix" has no fixture (the project builder always writes both files); the E2354 clause itself is covered.

Verdict: all 8 COVERED. Can move to `conformance-covered`.

## std.shells (status line: proposed), 6 clauses

Each clause has a file in `std-capacitor/conformance/` with a `// Spec:` header and a twin in `std-tauri/conformance/` whose header reads "Same clause as packages/std-capacitor/conformance/<file>: Conformance ..." and not `// Spec:`. A header search for `// Spec: std.shells,` finds only the Capacitor files. The Tauri files assert the same properties (9 tests in `storage-contract`, 2 each in the others, 1 in `no-global-fetch`).
1. COVERED. Storage passes k.persist's clauses: `storage-contract.test.ts` in both (get/set, read order, commit all, stale, condition-only, one at a time, no read between two writes, E1606; Tauri adds the `keel.json` saved-when-resolved test).
2. COVERED. A value read by a new driver after `world.restart()`, for `set` and for a `true` `commit`: `restart.test.ts` in both.
3. COVERED. Page at `capacitor://localhost` and `https://localhost`, relative or absolute request reaches `origin` with method, path, search, headers, body; another origin keeps its URL: `origin-map.test.ts` in both.
4. COVERED. Cookie from `origin` sent to `origin` (and via the page URL), none to another origin, `document.cookie` stays empty: `cookies.test.ts` in both.
5. COVERED. Refused connection rejects `TypeError` for page, origin and other URLs; `service` call gives `api.network`: `network-error.test.ts` in both.
6. COVERED. `globalThis.fetch` replaced by a guard stays the guard and is never called: `no-global-fetch.test.ts` in both.

Rules codes: std.shells states none.

Verified only with fakes: the clause text itself says "Capacitor's web implementations and Tauri's `mockIPC` under jsdom". Capacitor runs over `@capacitor/preferences` web (localStorage) with `CapacitorHttp` replaced by a stand-in (`fixtures.ts`); Tauri runs the real `plugin-store` and `plugin-http` JS over `mockIPC` answered by a `FakeShell`. These are about driver logic, so the fakes match the clause. Neither the native cookie jar, native Preferences, the Tauri store file nor native HTTP is exercised, and no test runs a native app. The clauses do not claim that.

Verdict: all 6 COVERED. Can move to `conformance-covered`. Optional: give the Tauri twins a `// Spec:` header in an `rfc:` PR so header searches see them.

## Summary

| section | clauses | covered | partial | none | verdict |
| --- | --- | --- | --- | --- | --- |
| k.persist | 12 | 12 | 0 | 0 | conformance-covered |
| k.prove | 9 | 9 | 0 | 0 | conformance-covered |
| k.shell | 6 | 5 | 1 | 0 | stays proposed (clause 6) |
| k.topology | 9 | 9 | 0 | 0 | conformance-covered |
| k.hosting | 6 | 5 | 1 | 0 | stays implemented (clause 2) |
| std.db | 8 | 7 | 1 | 0 | stays proposed (clause 1) |
| std.workflows | 8 | 8 | 0 | 0 | conformance-covered |
| std.shells | 6 | 6 | 0 | 0 | conformance-covered |

Weak but counted as covered: k.shell clause 4 (proceeds read as no E1574), std.db clause 7 (generated-entry half cannot fail), std.db clause 8 (overwrite by `commit`).

## Edits that follow if the verdicts are accepted (not applied)

Five sections move to `conformance-covered`: k.persist, k.prove, k.topology, std.workflows, std.shells.

1. Line 2 of five spec files, `status: <old>` to `status: conformance-covered`: `spec/kernel/k.persist.md` (proposed), `spec/kernel/k.prove.md` (proposed), `spec/kernel/k.topology.md` (implemented), `spec/std/std.workflows.md` (proposed), `spec/std/std.shells.md` (proposed). Lines 2 of `k.shell.md`, `k.hosting.md` and `std.db.md` do not change.
2. `spec/00-map.md`, status column of three rows: k.prove (line 48), k.persist (line 53), k.topology (line 54), each to `conformance-covered`. Rows k.shell (56) and k.hosting (59) stay.
3. `spec/std/README.md`, status column of two rows: std.workflows (line 46) and std.shells (line 47) to `conformance-covered`. Row std.db (45) stays `proposed`.
4. `docs/freeze-review.md` section 1 table: rows k.topology (line 23), k.persist (45), k.prove (46), std.shells (69), std.workflows (76) get status `**conformance-covered**` and missing tests `none`. Rows k.hosting (37), k.shell (48), std.db (53) keep their status and replace "not audited clause by clause" with the blocking clause: k.hosting "clause 2: client entry fetch URL and credentials not observed", k.shell "clause 6: the package's drivers not asserted", std.db "clause 1: Postgres 17 service not run in CI".
5. `docs/freeze-review.md` Status paragraph (line 124): replace with: no section is `frozen`; k.hosting is `implemented`; k.shell, std.db are `proposed`; the other 65 are `conformance-covered` (60 plus the five). The sentence under the table heading ("the table is not a clause-by-clause audit") needs rewording for the rows now audited.
6. Backlog items to file for the three blocked sections: the three tests named above (k.shell clause 6 driver assertion, k.hosting clause 2 client-entry fetch, std.db clause 1 Postgres 17 CI job). Per CLAUDE.md rule 2, conformance files change only through an `rfc:NNNN` PR with the `conformance-writer` subagent.

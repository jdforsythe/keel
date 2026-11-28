# S8 red-team (2026-11-15). Scripts: the session scratchpad `redteam/` (not in the repo); each finding is restated here so it stands alone.

## Confirmed, fixes running
1. HIGH `prove` unsound (`packages/testing/src/prove/internal/translator.ts`): a read of a missing record key counts as present (`v.users[p.id] === undefined ? {...count+1} : v` proves `count === 0`); an out-of-range array read compared to `undefined`; exact-integer arithmetic where JS rounds (`a + p.x - p.x` proves `a === b`; x = MAX_SAFE_INTEGER, a = 2 gives 1). Fix: option reads or E1715; every `+`/`-`/`*` intermediate bounded to +-(2^53-1).
2. HIGH the ledger counts `prove` inside `.catch`, `try`, `.then(..., handler)` or a helper's arrow (`rejection(() => prove(...))`) as `proven` (`packages/cli/src/internal/testFacts.ts`): the 57 `proven` count is inflated by the negative conformance tests. Fix: only a `prove` awaited or returned at the test body's top level.
3. MED a workflow step or wait whose event leads back to its own state strands the instance (`entered` unchanged, the job key repeats; `packages/std-workflows/src/internal/compileStores.ts`).
4. MED the real `localStorage` driver's `commit` half-applies when a later `setItem` throws (`packages/ctx/src/internal/applyCommit.ts`).
5. LOW two factories in one `serverState` request sharing a store id: the unchanged copy overwrites the changed one and the save reports ok (`packages/store/src/internal/saveStores.ts`).

## Confirmed, to the backlog
6. E1112 misses, no finding: `process.stdout.write(reveal(k))`; a method argument (`'x'.concat(reveal(k))` into `storage.set`); `for (const v of [reveal(k)])`; `const open = reveal; open(k)`; `console.log.bind(console)`; `throw reveal(k)` (may reach the `keel.unexpected` log line: `scrubbedCause` scrubs only `.pii`); `String.raw`, `structuredClone`, `writeFileSync`.

## Suspected, needs a device or a real server
- Tauri: `tauri-plugin-http = "=2.9.0"` has no `features = ["cookies"]`; without it the client probably keeps no cookie store, so the caller cookie (D4) would be lost on every request. Capacitor: `capacitor.config.json` does not enable `CapacitorCookies`.
- Capacitor's net driver sends a URL on another origin as given through CapacitorHttp (no scope, no CORS) while Tauri's http scope refuses it: one rule for k.shell is needed.
- Whether plugin-http re-checks its scope on redirects.
- SQLite: `BEGIN IMMEDIATE` on `DatabaseSync` with `busy_timeout` 5,000 can block the event loop up to 5 s when another process holds the write lock.

## Held
Nine malformed `KEEL_DATABASE_URL`s against golden-1's `server.mjs` (password in userinfo, host, path, `%00`, query): only E1560 or E2153, no part of the URL printed. std-db SQL is parameterized constants. SQLite: odd keys round-trip; stale and partly stale commits store nothing; NUL and E1606 reject; calls after `close()` reject. golden-1 undo after purge is refused. E1574 against `localhost.evil.com`, `localhost.`, case, userinfo. Tauri `http.json` scope `${origin}/*` and the CSP match the spec. `mapUrl` userinfo and `//` tricks stay on the origin. No frozen section changed; the one new second way is D5 (a).

# Red team 5: RFC 0122, 0123, 0112 (`39e9ab5f..de073d1a`)

Counts: HIGH 0 · MEDIUM 2 · LOW 4. All probe files are deleted. `git status` is clean apart from this file.

## Findings

### F1 MEDIUM: a storage write that fails in `resolve(..., 'mine')` while a flush runs: the re-send is still posted and `resolve` reports the wrong result (RFC 0112 D1, "posts nothing more")
- Where: `packages/std-offline/src/resolve.ts:54-60` together with `internal/flush.ts:41-44`. The same pattern is in `send.ts:42-47` (reasoned, not run).
- Cause: `tx(c.resolve)` sets the entry to `queued` in memory before `persist` settles. A flush loop that is already running (`c.busy`) finishes the put it is waiting on, finds the entry `queued` (flush.ts:41) and takes it (`put(K,'sending')`). `resolve`'s write then rejects and settles the entry `failed`, but the loop already has the entry in hand. It posts it and settles it with the server's answer.
- Probe (ran it: `packages/std-offline/test/zzProbeRace.test.ts`, now deleted). Sim ctx, fixtures `createServer`/`makeClient`. Entry K is `conflict`. `ctx.storage.set` is wrapped as an ordered FIFO pumped by hand (an IndexedDB-like store slower than the network). The server is gated. `send` K2 stays unawaited, so the loop is busy on K2's post. Then `release()`, so the loop issues `put(K2,'sent')`. Then `resolve(ctx,o,K,'mine')` with its `set` set to reject `Error("QuotaExceeded /data/user/secret.db")`. Then pump.
- Observed:
  ```
  resolve -> {"state":"failed","error":{"code":"offline.storage","message":"Error: QuotaExceeded /data/user/secret.db","data":{}}}
  posts [["K","mine"],["K2","second"],["K","mine"]]        <- K posted after resolve said "failed, nothing posted"
  client entries [{"key":K,"state":"conflict","base":1,"head":2,...}]   <- entry is conflict, not failed
  ```
  The caller (golden-1 `resolveEdit`) acts on `failed` while the write was sent and answered. Had the server applied it, the user would see a failure for a write that landed.
- Principles: 10 (a test given state and events should find one answer). The new spec clause is false under this interleaving.
- Fix: in `resolve` and `send`, persist before the entry becomes `queued`. Write the new outbox value computed off-store, then apply the `tx`. Or keep the entry in a state the loop skips (e.g. `held`) until `persist` resolves. Add a conformance case with an ordered slow storage and a busy flush.

### F2 MEDIUM: a production build becomes a dev client whenever `NODE_ENV` at build time is anything but `production`, so the router and `mount` show thrown text (RFC 0122 "fail closed")
- Where: `packages/compiler/src/internal/entryCode.ts:73` and `entry/resumeEntry.ts:25` (`import.meta.env?.DEV === true`). `packages/cli/src/internal/viteRun.ts:15-17` passes `process.env` through to `vite build` unchanged. Vite 8 sets `DEV = NODE_ENV !== "production"` once `NODE_ENV` is set (`vite/dist/node/chunks/node.js:37539-37546,37686,37802`). A project `.env` holding `NODE_ENV=development` sets it too (`:37681-37684`).
- Probe (ran it: a scratch dir with the repo's vite 8.3.6, `main.js` = the entry's mode line, `vite build`):
  ```
  NODE_ENV=production -> MODE=production
  NODE_ENV unset      -> MODE=production
  NODE_ENV=staging    -> MODE=dev
  NODE_ENV=test       -> MODE=dev
  .env NODE_ENV=development, shell unset -> MODE=dev
  ```
  The bundle carries the literal `"dev"`, so `createRouter`'s alert, every `errorElement` and every `Form` get the thrown message. The inspector reporter (`entryCode.ts:78`) also posts every store snapshot to `/__keel/inspect` once a second. The server takes the opposite default: `nodeEnv()` treats anything but `development` or `test` as production. A staging build therefore pairs a production server with a dev client.
- Principles: 2 (an env var in the build shell changes what the entry does), and fail closed as `mount` and `createApp` intend.
- Fix: in `keel build` (`viteRun.ts`, `shellBuild.ts:88`), run vite with `NODE_ENV=production`, or pass `--mode production` and make the entry key on `import.meta.env.MODE === "development"`. Alternatively, warn (W code) when `NODE_ENV` is set to anything else. Add a compiler e2e case that builds with `NODE_ENV=staging` and asserts `"production"` in the bundle.

### F3 LOW: thrown text reaches the page under a std code that `publicError` passes (`offline.storage`)
- Where: `std-offline/src/resolve.ts:58`, `send.ts:45` (`stored.error.message`, the `keel.unexpected` describe of the thrown value), `internal/flush.ts:80` (`String(x)` of any throw in the loop, including a `service()` RangeError for a bad stored origin, which gets labelled storage).
- Probe (ran it, in F1): `error.message` = `Error: QuotaExceeded /data/user/secret.db`. An action that returns `send`'s `failed` error gives it to the `Form` error slot in production unchanged, because RFC 0122 hides `keel.unexpected` only. Reasoned for the Form path.
- Fix: give `offline.storage` a fixed message (`c.id` as `offline.full` does) and send the thrown value only to observers (`report`). In flush.ts, catch the storage write alone, not the whole loop body.

### F4 LOW: the runtime backstop marks secret route params but not `.pii()` ones, so a matched path writes personal data to the `req` line
- Where: `server/src/internal/secretSegments.ts` (secret only, via `secretKey`) and `createApp.ts:288`. The scrub set `pii` gets action input, loader and action outputs and store states (`notePii`), never route params.
- Probe (ran it: `createApp` production compact, route `/u/:email` with `email: s.string().pii("contact")`):
  ```
  /u/alice@example.com   => GET /u/alice@example.com app.who 200 0ms
  /u/alice%40example.com => GET /u/alice%40example.com app.who 200 0ms
  ```
  E1111 refuses this table in checked code. RFC 0123 argues that the runtime marks exist for tables check does not read, and that argument covers `.pii()` params equally.
- Fix: mark pii params by the same rule as `[pii]`, or note the param values of the matched route (`piiValues(def.params, params)`) into `rq.pii`. Alternatively, state the gap in k.privacy.

### F5 LOW: an encoded separator between the static segment and the secret is logged as sent
- Where: `secretSegments.ts:43-46` (the path splits on a raw `/` only).
- Probe (ran it: `createApp` production, `/reset/:token` secret):
  ```
  /reset%2FSECRETx => GET /reset%2FSECRETx 404
  /reset%2fSECRETx => GET /reset%2fSECRETx 404
  /RESET%2FSECRETx => GET /RESET%2FSECRETx 404
  /reset%5CSECRETx => GET /reset%5CSECRETx 404
  ```
  This happens when a link is built as `encodeURIComponent("reset/" + token)`. It is not among RFC 0123's stated limits (raw `/` in an earlier param, typo, extra leading segment, double encoding, `&`).
- Fix: also line up on the first segment's decoded form split at `/` (and `\`), and cut there. Or add it to the stated limits and their conformance.

### F6 LOW: `errorName` passes any identifier-shaped `name`
- Where: `server/src/internal/errorName.ts:9`.
- Probe (ran it): `errorName(Object.assign(new Error("m"), { name: "tok_a3f9c2e1b4d5" }))` gives `tok_a3f9c2e1b4d5`. A Proxy whose `get` throws gives `Error`, which holds. Only an in-process peer (app code) chooses the name, and the `diag` is written unscrubbed (`createApp.ts:284`).
- Fix: allowlist the runtime names (`TypeError`, `AbortError`, `TimeoutError`, `Error`, `RangeError`, `DOMException`), else `Error`.

## Probes that held
- RFC 0122, production (`mode` undefined, `"Dev"`, `"development"`): ran each in a `happy-dom` router probe. Each of these shows `unexpected` with `data-keel-error="keel.unexpected"`:
  - a guard that throws;
  - a page that throws an object;
  - a page that throws a string;
  - an `errorElement` that itself throws;
  - a child page under a layout `errorElement` (`layoutEE:unexpected`).
  A loader `err` with code `app.db` shows its own message, as designed. With `mode:"dev"` each shows the message.
- `submit` reports the full error before `shown`. The returned `Result` and `onResult` both get the public form (read).
- `attempt` and runtime-dom turn every throw into `keel.unexpected` (read). An app code is only ever a returned value.
- A hostile page cannot flip the mode: `import.meta.env` is a build-time literal, and an unbundled entry has none, so it is production (read; F2 is the build-time route).
- Resume uses `readError` (code only) and no router. The server's `publicError` changed from `=== "production"` to `!== "dev"`, which is stricter (read).
- E1508 in production shows `unexpected` (conformance, read).
- RFC 0123:
  - `/reset\SECRETx` and `/reset/SECRETx%2Fmore` give `/reset/[secret]` (ran).
  - Cost is linear: 201 secret routes (including a `/:token` lead) over 32 KB, 320 KB and 3.2 MB paths took 3, 33 and 337 ms (ran).
  - Earliest cut, empty segments and the trailing slash behave as stated (read).
  - A Proxy or a throwing `name` getter gives `Error` (ran).
- RFC 0112:
  - Concurrent `mine`+`mine`, `mine`+`theirs` and `theirs`+`mine` on one key: the second sees `queued` and resolves `false` (read; the check and the `tx` are synchronous after `load`).
  - The `c.waits` key cannot be overwritten for a `mine` key (read).
  - A re-send that never answers ends at the service timeout (10 s, `services/src/service.ts:13`) as `queued` (read).
  - A disposed drain (`c.live` false) resolves `queued` (read).
  - The re-send keeps its write key, so a lost response is deduped by k.sync (read).

## Proposed backlog lines
- 0750 P1 std-offline: a storage write that rejects in `resolve('mine')` or `send` while a flush runs still posts the entry and returns `failed`; persist before the entry becomes `queued` (red team 5 F1; repro: ordered slow `ctx.storage.set` + gated server, see tasks/0338-s8-reach/proposed/red-team-5.md).
- 0751 P1 cli/compiler: `keel build` inherits `NODE_ENV`; `staging`, `test` or a `.env` `NODE_ENV=development` builds a client whose router and mount show thrown text; force production or warn (red team 5 F2; repro: `NODE_ENV=staging vite build` of the entry mode line gives `"dev"`).
- 0752 P2 std-offline: `offline.storage` carries the thrown text (`String(x)`, `stored.error.message`), which reaches a Form in production; fixed message, thrown value to observers; flush catches the storage write only (F3).
- 0753 P2 server: `.pii()` route params are written raw in the `req` path (`GET /u/alice@example.com app.who 200`); mark or note them, or state the gap in k.privacy (F4).
- 0754 P3 server: `/reset%2F<v>` logs as sent; line up on a decoded first segment split at `/`, or list it as a stated limit with conformance (F5).
- 0755 P3 server: `errorName` passes any identifier-shaped name; allowlist the runtime error names (F6).

# RFC 0132: the Tauri store keeps two whole copies, a debug Android build reaches an http origin, and Capacitor streams through Keel's own native client

Status: accepted (orchestrator under the owner's standing leave, 2026-11-18), ADR-0154. From the native shell runs of 2026-11-18 (`tasks/0338-s8-reach/proposed/s8-shells.md`, proposals P1 to P4).

## Problem
The S8 shell exit clauses were run on real shells for the first time: Tauri on macOS and Capacitor on an Android 16 emulator, each built with `keel build --target`, started against golden-1's built `api` behind a logging proxy, written to and killed mid-write. Four things came out that the spec did not say or got wrong.

1. **A crash inside a Tauri save empties the store.** `@tauri-apps/plugin-store`'s `save` is `fs::write` (open with truncate, then write, no rename, no fsync), and a load that fails is ignored, so a cut `keel.json` opens as an empty store with no error. A loop of `fs::write` killed after 50 to 150 ms left 118 of 200 files empty. Every key is lost, not only the one being written. std.shells says the store is "file `keel.json` ... saved before a write resolves", which holds for a write that finishes and says nothing of one that does not.
2. **Android refuses the `http://localhost` origin k.shell accepts.** k.shell lets `KEEL_ORIGIN` be `http:` on `localhost`, the one local loop it allows, but Android blocks cleartext from API 28, and the generated project allowed none: every request failed with `Cleartext HTTP traffic to localhost not permitted`.
3. **A server-sent-events stream never arrives through std-capacitor.** `net.fetch` awaits `CapacitorHttp.request`, whose Android handler reads the whole body before it answers (`HttpRequestHandler.buildResponse` reads the input stream to a string; `HttpResponseType` has no stream type). An event stream never ends, so golden-1's live badge stays `Connecting`; k.services' events call times out, aborts and retries at about 1, 2, 4 and 8 s. `CapacitorHttp` has no cancel, so each aborted request keeps its native connection open: the proxy saw 7. Tauri's `plugin-http` streams, and its badge reads `Live`.
4. **The caller cookie lasts one run of the app, in both shells.** The cookie has no `Max-Age` or `Expires`. Tauri's cookie store saves only persistent cookies; Capacitor removes session cookies at start and stop. Each app start is a new caller, so Undo after a restart does not reach a write made before it (`undoWhere` matches `meta.caller`). A browser drops the same cookie when it quits.

## Proposal

### 1. Tauri storage: two whole copies (built)
`storeStorage` (`packages/std-tauri/src/internal/storeStorage.ts`) keeps `keel.json` and `keel.b.json` in the app's data directory. Each holds one plugin-store key, `keel`, whose value is `{ gen, sum, data }`: a generation (a safe integer from 1), `data` the store's keys as JSON text, and `sum` an FNV-1a checksum of `` `${gen}:${data}` ``. A document is a whole copy only when the generation, checksum and shape all hold.

- **Load.** Both files are read with `reload({ ignoreDefaults: true })`; plugin-store's error tells a file it cannot parse (`Failed to deserialize store`) from a missing one (`os error 2` or `3`), and any other read error rejects naming the file. The newer whole copy wins, `keel.json` on equal generations.
- **Write.** The next copy (generation plus one, every key) is saved first to the file the held copy was not read from, then to the other, before the write resolves. The only whole copy is therefore never the file being truncated. Writing in a fixed order failed the property test: a torn `keel.json` from one crash, then a crash inside the backup's save, left no whole copy.
- **No whole copy.** When `keel.json` is missing (a fresh install, or a crash inside the very first save, which goes to `keel.b.json`), the store is empty. Otherwise every call rejects with `ctx.storage: keel.json and keel.b.json hold no whole copy of the store; delete both to start empty` and neither file is overwritten, as `fileStorage` does for a file it cannot parse. The load is tried again on the next call.
- **Cost.** Two whole-file saves per write, no new plugin, permission or Rust code (`store:default` already allows `load`, `reload`, `set`, `get`, `length` and `save`). No fsync, so power loss is not covered.

Shown: a harness running the real driver over `fs::write` semantics, killed 200 times at random, read whole 200 of 200 times for 300-byte and 1 MB values (88 and 20 kills landed inside a save); the single-file driver read empty 66 and 51 times. On the built app, a cut `keel.json` beside a whole `keel.b.json` started from the backup and drained its queued write; 200 kills during the outbox's drain read whole 200 times.

### 2. Android cleartext to an http origin, debug builds only (built)
`shellBuild` runs `androidNetworkSecurity` before Gradle. When `KEEL_ORIGIN` is `http:` and the build is not `--release`, the Android project gets `res/xml/keel_network_security.xml` (`base-config cleartextTrafficPermitted="false"`, one `domain-config cleartextTrafficPermitted="true"` for the origin's host, `includeSubdomains="false"`) and `AndroidManifest.xml` names it. An `https:` origin or `--release` gets neither, and a config an earlier build wrote is taken out, since the platform folder persists between builds. A manifest that names another config is left alone and gets no cleartext. `capacitor.config.json` and `deploy/` stay as generated: Capacitor's `server.cleartext` turns into `usesCleartextTraffic="true"` for every host, so it is not used. A release build with an `http:` origin cannot reach it on Android; release builds take an `https:` origin. On a device `localhost` is the device itself, so an `http:` origin works through `adb reverse`; the emulator's host address `10.0.2.2` is E1574.

### 3. Capacitor streams through std-capacitor's own native plugin (choice C3, not built)
`@keel/std-capacitor` becomes a Capacitor plugin, `KeelHttp`, and its `net.fetch` sends every request through it in place of `CapacitorHttp`:
- Android: `HttpURLConnection`, which uses the default `CookieHandler`. `CapacitorCookies.load()` always installs `CapacitorCookieManager` there, so this is the cookie store `CapacitorHttp` uses today. iOS: `URLSession(configuration: .default)`, whose `HTTPCookieStorage.shared` is the store `CapacitorHttp` uses (`CapacitorUrlRequest.swift`).
- `request({ id, url, method, headers, data })` resolves when the response headers arrive, with `{ status, headers }` minus `set-cookie`. The body follows as `chunk` events (`{ id, data }`, base64, at most 16 KiB each), then `end` or `fail`. `cancel({ id })` disconnects the native request.
- The JS side returns a `Response` whose body is a `ReadableStream` fed by the chunks; the request's `AbortSignal` calls `cancel`. A failure before the headers rejects with a `TypeError`, as now; one after them errors the body stream.
- The plugin ships in the package (`android/`, `ios/` with a `Package.swift`, the `capacitor` field in `package.json`), so `cap sync` installs it from the app's `dependencies`; the generated shell files do not change.

**Why the native client.** The caller cookie lives in the native client's store, so a stream sent through that client carries the same caller as every write, by construction. Nothing in k.security, k.hosting or the policy changes.

**Why not the WebView's own `fetch`, for streams only (option b).** The page is `https://localhost` on Android and `capacitor://localhost` on iOS, so a fetch to `KEEL_ORIGIN` is cross-site and three things refuse it before identity comes up. The Capacitor page's policy is the `client` policy with `connect-src 'self'` (k.shell Build 3), which blocks it. The server answers it only for an origin in `KEEL_ALLOW_ORIGINS` (k.hosting), which takes http(s) origins, so `capacitor://localhost` is E1560; and `https://localhost` is the origin of every Capacitor Android app and of any local server a person's browser opens, so listing it in production trusts all of them. Past those, the cookie does not travel. The caller cookie is `SameSite=Lax`, which a cross-site fetch does not send; Android's WebView refuses third-party cookies by default and iOS's WKWebView blocks them; and on iOS the WebView's cookie store is not the native one at all. The stream request therefore reaches the server with no caller cookie and runs with `caller` `""` (k.server mints a caller only on a write), while the page's writes run as the native caller. That split breaks any stream that reads `caller`: a live loader returning the caller's own rows streams the anonymous view, so the page's live list disagrees with the same loader read once; a channel route whose `member` check reads the caller refuses the subscription or admits the anonymous one. Making the cookie reach it needs `SameSite=None`, which gives up Lax's protection against cross-site writes for every browser user to fix one shell.

**Why not the WebView's `fetch` for everything.** Every request is then cross-site with no cookie. Each write mints a caller in a `set-cookie` the WebView refuses as third-party, so every write is a new caller and Undo matches nothing; writes pass the same-site check only through `KEEL_ALLOW_ORIGINS`. It breaks k.shell's cookie rule for all requests, where (b) broke it for streams.

**Why one native path for every request, not a selector.** k.services' events call is Keel's only sender of `accept: text/event-stream`, so a selector on that header would catch live loaders and channel subscriptions. It would miss an app's own `ctx.net.fetch` of a stream, keep `CapacitorHttp`'s missing cancel for every other request, and leave two native clients to keep equal on origin mapping, headers and errors. One plugin for every request gives streaming and cancel to all of them.

**Why not state the limit (option a).** golden-1's board, std-live views and std-channels subscriptions are part of what a shell app is; a stated limit plus a timer fallback is a second way to read live data, used on one platform. The record's recommendation of (a) is reversed here.

The operator can reverse C3: to the selector variant (only `accept: text/event-stream` requests through `KeelHttp`), or to (a).

**The run that proves it** (a builder step; nothing above is shown yet). On the Android emulator as in the record (scratch AVD, `adb reverse`, golden-1 built with `KEEL_ORIGIN=http://localhost:4182`, the logging proxy): the badge reads `Live` within 2 s of start; the proxy shows one `GET /api/board/events` carrying the same caller hash as the POSTs; a list created from curl appears on the emulator's board within 1 s without a reload; leaving the view closes the event connection at the proxy, and no request stays open after its abort; the record's cookie, origin and kill runs pass again. On the iOS simulator, the same checks once `xcodebuild -resolvePackageDependencies` completes. Until the iOS run passes, the iOS half is a source reading.

### 4. Open question for the operator: the caller cookie across an app restart
Not decided here. Options:
- **Keep the session cookie (no change).** A shell user is a new caller at every app start, as a browser user is after quitting the browser. Undo reaches only writes made since the app started. No identifier outlives the app. A k.shell sentence states "a shell start is a new caller".
- **Make the caller persistent: `Max-Age=34560000` (400 days, the longest a browser keeps) on the cookie, for browsers and shells alike.** A shell user keeps one caller across restarts and Undo reaches writes from earlier runs. The caller becomes a 400-day identifier in every browser too. k.security's Caller cookie sentence gains the attribute (that section is at 1,499 tokens, so 4 tokens come out elsewhere in it), with conformance that a minted cookie carries it and a sent valid cookie gets no new `set-cookie`.

The operator answers in one line: "session" or "persistent".

## Alternatives
- Tauri: an atomic write (temporary file, fsync, rename) in the generated `src/lib.rs` in place of plugin-store. Durable on power loss too, but Rust code Keel owns in a generated file, and `@tauri-apps/plugin-fs` with an `fs:` scope to do it from JS.
- Tauri: one file with a write-ahead copy that the load replays. A second file either way, with a replay step the two whole copies do not need.
- Android: `server.cleartext` in `capacitor.config.json`. Allows cleartext to every host, and stays in a release build.
- Android: a cleartext config in release builds too. A release app talking to an `http:` origin is a misconfiguration the build should not carry.
- Capacitor streams: (a) the stated limit, (b) the WebView's `fetch` for streams, the WebView's `fetch` for everything, and the selector variant, each weighed above.

## Spec diff
`spec/std/std.shells.md` (560 to 877 tokens by file characters, 877 printed):
- API, the std-capacitor bullet: `net` on `CapacitorHttp` from `@capacitor/core` becomes "`net` on the package's native plugin `KeelHttp` (Android `HttpURLConnection`, iOS `URLSession` with the default configuration), whose cookies the native cookie store keeps, the one `CapacitorHttp` uses (`CapacitorCookies`)."
- API, the std-tauri bullet: "file `keel.json` in the app's data directory, saved before a write resolves;" becomes "files `keel.json` and `keel.b.json` in the app's data directory, each a whole copy `{ gen, sum, data }` (generation, checksum, keys), saved before a write resolves, first to the file the held copy was not read from, then to the other. A load takes the newer whole copy, so a crash inside a save leaves the earlier or the new state. With no whole copy the store is empty only when `keel.json` is missing (a fresh install, or a crash inside the first save); otherwise every call rejects and neither file is overwritten."
- API, a new last bullet: "A `net.fetch` response resolves when its headers arrive and its body yields each chunk as the server sends it, an event stream included; aborting the request cancels the native request."
- Conformance, two bullets appended:
  - "With `tauriDrivers`, a save cut at any byte of `keel.json` or `keel.b.json` leaves a new driver reading the earlier or the new value of every key; a copy of a lower generation or a wrong checksum is not read; with no whole copy and `keel.json` present every call rejects and both files keep their bytes."
  - "With each package, a response whose body the native side sends in two chunks resolves before the second is sent and its body yields the first; aborting it cancels the native request; no `set-cookie` header reaches the page."

`spec/kernel/k.shell.md` (1,319 to 1,468 tokens by file characters, 1,469 printed):
- Build 3 gains a sentence after the meta-tag sentence: "A debug Android build whose `KEEL_ORIGIN` is `http:` gets a network security config, named in `AndroidManifest.xml`, that allows cleartext to that origin's host and no other; an `https:` origin or `--release` allows none and removes one an earlier build wrote."
- Conformance, one bullet appended: "`KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`; a next build with `https://golden-1.example`, or with `--release`, leaves neither; `capacitor.config.json` is the generated one each time."

No existing Conformance bullet changes; none is reordered. k.security and k.hosting are unchanged until the operator answers the open question.

## Conformance diff
One `rfc:0132` commit by the `conformance-writer`:
- `packages/std-tauri/conformance/crash-copies.test.ts` and `crash-copies.property.test.ts` (std.shells clause 7): over the plugin-store stand-in whose `save` truncates and can be cut at a given byte, a save cut at every offset of each file reads the earlier or the new value; a lower generation and a wrong `sum` are not read; four no-whole-copy layouts with `keel.json` present reject on every call and keep both files' bytes; `keel.json` missing reads empty.
- `packages/std-capacitor/conformance/fixtures.ts`: the stand-in moves from `CapacitorHttp` to the `KeelHttp` plugin (`request`, `cancel`, `chunk`, `end`, `fail`), since the API bullet's meaning changed; `cookies`, `network-error`, `origin-map` and `no-global-fetch` then run over it unchanged in what they assert.
- `packages/std-capacitor/conformance/stream.test.ts` and `packages/std-tauri/conformance/stream.test.ts` (clause 8): two chunks with a gate between them; the `Response` resolves and the body reads the first chunk before the gate opens; an abort reaches `cancel` (Tauri: `plugin-http`'s cancel command under `mockIPC`); a `set-cookie` response header is absent from the `Response`.
- `packages/cli/conformance/android-cleartext.test.ts` (k.shell's new bullet): with the native tools faked as in `build-target-tools.test.ts`, the three builds and their files.

## Migration
Tauri: a store written by the single-file driver is a `keel.json` of plain keys, which is not a whole copy, so the built driver rejects it and asks for both files to be deleted. No shell app has shipped; golden-1's dev store was removed after the runs. Android: rebuilding is enough. Capacitor: none for apps; the change is inside `@keel/std-capacitor`.

### What was run, and what was not
Run on one macOS 26 arm64 machine: Tauri 2 on macOS (WKWebView), built, started, written to through the outbox and killed mid-write 200 times; Capacitor on an Android 16 arm64 emulator, built with an `http:` origin and no hand edit, started, written to, and killed mid-write 12 times. Not run: iOS (the Xcode simulator build stalled downloading Capacitor's binary packages, so no app was built); Tauri on Linux and Windows (no host); the Tauri replay of a recorded session, which needs Linux `tauri-driver` under `xvfb-run`; a physical device; release builds and signing; power loss. Nothing in this RFC claims those.

## Build order
1. Orchestrator: the spec diff (done with this RFC). `conformance-writer`: the conformance diff.
2. Builders, already built and green against their unit and property tests: `@keel/std-tauri` (1,694 of 1,792 bytes gzip) and `@keel/cli/shell` (4,448 of 4,608). Each confirms the new conformance and adds its changeset.
3. Builder, `@keel/std-capacitor`: the `KeelHttp` plugin (Java and Swift, about 150 to 250 lines in all), `capacitorNet` over it, README, changeset (minor). The JS side is estimated at +250 to +400 bytes gzip against 167 left (1,113 of 1,280), so a raise to 1.5kb is proposed. Then the proving run in Proposal 3.
4. Orchestrator: ledger, backlog, HANDOFF; the operator's answer to the open question.

## Token impact
std.shells 560 to 877 tokens (877 printed). k.shell 1,319 to 1,468 (1,469 printed). No trims were needed. No other section changes.

## Choices
Each is the orchestrator's call; the operator can reverse any of them.
- C1: two whole copies over plugin-store, written to the file not read from first, with no fsync.
- C2: cleartext only in debug Android builds, only to the `http:` origin's host.
- C3: every Capacitor request goes through std-capacitor's own native plugin, so streams arrive and every request can be cancelled, on the cookie store `CapacitorHttp` uses.
- C4: a raise of `@keel/std-capacitor` to 1.5kb; budgets are the owner's gate.
- Open: the caller cookie across an app restart (Proposal 4).

## Amendment
RFC 0139 answers Proposal 4 with neither option as posed: the caller cookie stays session-only by default and is not a credential; a `node` deployable may opt in to a caller of 1 to 400 days; a sign-in that outlives a relaunch is the auth library's or platform's, which an app plugs in through `identity.server.ts` (k.user). The shells keep a cookie with `Max-Age` in their native store; whether it survives a relaunch on each platform is a shell smoke check RFC 0139 lists.

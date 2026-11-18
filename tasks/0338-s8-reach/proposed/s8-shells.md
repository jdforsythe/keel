# S8 shell exit clauses: native runs on this machine (0607, 0609)

Machine: macOS 26 (Darwin 25.3.0), arm64. Every command below ran from the repo; each result is quoted.

## 1. Toolchain

| Command | Result |
|---|---|
| `rustc --version` | `rustc 1.100.0 (0ef1bc386 2026-11-09)` |
| `cargo --version` | `cargo 1.100.0 (3acc79c0c 2026-11-05)` |
| `rustup target list --installed` | aarch64-apple-darwin, x86_64-apple-darwin, aarch64/x86_64-unknown-linux-gnu, x86_64-unknown-linux-musl |
| `pnpm exec tauri --version` (apps/golden-1) | `tauri-cli 2.12.4` |
| `java -version` | `openjdk version "21.0.6"` Corretto, `JAVA_HOME` set to it |
| Android SDK | `ANDROID_HOME=~/Library/Android/sdk`; platforms 28, 30, 33, 35, 36, 36.1; build-tools 29.0.2 to 37.0.0; cmdline-tools latest |
| System images | android-36 google_apis arm64-v8a, android-28 google_apis arm64-v8a |
| `emulator -list-avds` | 7 AVDs; `Illumina_API36` uses the android-36 arm64 image |
| `emulator -version` | 36.6.11.0 |
| `xcodebuild -version` | `Xcode 26.6` (17F113); simulators iOS 26.5 (iPhone 17 and others) |

## 2. Tauri on this Mac

Local server: `dist/api/server.mjs` (golden-1's built `api`) with `PORT=4181 KEEL_ORIGIN=http://localhost:4181 KEEL_FORMAT=json KEEL_DATABASE_URL=file://<scratch>/api.sqlite` and a 38-byte `KEEL_SECRET`. The `req` log has no caller field, so a logging proxy on 4182 (scratch, not in the repo) forwards to 4181 and logs per request the method, path, `Origin`, `User-Agent` and a sha256 prefix of the `keel-caller` cookie sent and of any `keel-caller` set-cookie returned (never a value).

**Build.** `KEEL_ORIGIN=http://localhost:4181 pnpm exec keel build --target tauri` (apps/golden-1) printed `ok build web tauri dist/web/tauri/target/debug/golden-1`, exit 0; the binary is 53,374,248 bytes. Rebuilt with `KEEL_ORIGIN=http://localhost:4182`: the same trailer; the bundle names `localhost:4182` once; `capabilities/http.json` allows `http://localhost:4182/*` only.

**Start.** `./target/debug/golden-1` (from `dist/web/tauri`): the window "Golden 1" opens; `screencapture -R` of the window shows the header (Keel, golden-1 / todos, the stream badge `Live`, Home, Undo), the Lists heading and the List name form. The proxy logs on load: `GET /api/lists`, `GET /api/board/events` (the board stream, 200, so the badge reads Live) and `GET /api/lists`, each `origin: tauri://localhost`, `user-agent: tauri-plugin-http/2.9.0`.

**Caller cookie: survives across requests (yes).** Keystrokes through System Events (`osascript`; `click at` is refused with -25204, keys work) typed "Shell one" and Enter, then "Shell two" and Enter. Proxy lines:
- `POST /api/lists` cookieSent `-`, setCookie `74a0e8e7f8`, 200 (the first write mints the caller)
- `GET /api/lists` cookieSent `74a0e8e7f8` (twice)
- `POST /api/lists` cookieSent `74a0e8e7f8`, setCookie `-`, 200 (the second write is the same caller; no new cookie)
- the window shows both lists, each `0 open`.

So the Tauri half of 0607 does not reproduce: `tauri-plugin-http` 2.9.0 has `cookies` in its **default** features (`[features] default = ["rustls-tls", "http2", "charset", "system-proxy", "cookies"]` in the crate's `Cargo.toml`), and the generated `Cargo.toml` takes the defaults. The plugin builds its reqwest client with `cookie_provider(state.cookies_jar)` (`src/commands.rs:345-347`).

**Caller cookie across an app restart: lost (finding).** After Cmd-Q, `~/Library/Caches/dev.keel.golden1/.cookies` is 2 bytes (`[]`, no `keel-caller`): the plugin saves only persistent cookies (`cookies_to_str` keeps `is_persistent()` ones, `src/reqwest_cookie_store.rs`), and the caller cookie has no `Max-Age` or `Expires` (`callerOf.ts`: `Path=/; HttpOnly; SameSite=Lax`). After restarting the app the first write went with cookieSent `-` and got setCookie `9864ef51bc`: a new caller. A browser drops the same session cookie when it quits, so this matches the browser; its effect in golden-1 is that Undo does not reach a write made before the restart (`api.undo` matches `meta.caller`). The outbox does not depend on it (golden-1's owner is `""`). Proposal P2 below.

**One write across a crash: no (the store can come back empty).** The driver's write is `@tauri-apps/plugin-store`'s `save`, which in `tauri-plugin-store` 2.5.1 is `fs::write(&self.path, bytes)` (`src/store.rs:318-325`): open with truncate, then write; no temporary file, no rename, no fsync. A load that fails is ignored (`build_inner`: `let _ = store_inner.load()`), so a file emptied or cut by a crash opens as an empty store with no error. Shown at the primitive level (the GUI app saves too rarely for a hand-timed kill to land in the window): a scratch Rust binary doing exactly `std::fs::write` of a valid JSON document in a loop, SIGKILLed after a random 50-150 ms, 200 trials each (`killprobe.py`, seed 1337):
- 1 MB documents: `{"whole": 82, "empty": 118, "torn": 0}`
- 300-byte documents: `{"whole": 81, "empty": 119, "torn": 0}`
A kill inside a save loses every key, not only the one being written: neither the earlier nor the new state. In the real app the store file `~/Library/Application Support/dev.keel.golden1/keel.json` held `keel.outbox.todos.outbox` after the writes above, so that is the state a crash in a save would drop. Proposal P1 below; the reproducing test is `packages/std-tauri/test/storeStorage.crash.test.ts` (`test.fails`).

## 3. Capacitor on Android

**Build.** `ANDROID_HOME=~/Library/Android/sdk KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target capacitor --platform android` printed `ok build web capacitor dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`, exit 0; APK 4,724,258 bytes; minSdk 24, compile and target SDK 36. The staged `capacitor.config.json` is `appId`, `appName`, `webDir` only.

**Emulator.** A scratch AVD (`avdmanager create avd -n keel-s8-shells -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_6`, deleted afterwards; the user's seven AVDs untouched), started `emulator -avd keel-s8-shells -no-window -no-audio -no-boot-anim -no-snapshot -port 5584`; `adb wait-for-device`, then `sys.boot_completed` was 1 after the 4th 3 s poll. `adb reverse tcp:4182 tcp:4182` lets the emulator's `localhost:4182` reach the proxy (k.shell takes `http:` on `localhost` only, so `10.0.2.2` would be E1574). `adb install -r` Success; `am start -n dev.keel.golden1/.MainActivity`.

**Start: loads, but cannot reach an http origin (finding).** logcat: `Capacitor: Loading app at https://localhost`, the bundle and CSS served locally, then every `CapacitorHttp.request` to `http://localhost:4182/...` fails with `java.io.IOException: Cleartext HTTP traffic to localhost not permitted` (Android blocks cleartext by default from API 28; the generated project does not allow it). The build accepts an origin the Android app cannot use. To go on, the staged copy only (`dist/web/capacitor/capacitor.config.json`, gitignored, not the generated `deploy/` file) got `"server": { "cleartext": true }`, then `cap sync android` and `./gradlew assembleDebug` (exit 0, 4,726,092 bytes) and reinstall. Proposal P3.

After that: `adb exec-out screencap` shows the header, Lists, the lists the Tauri run made, a removal bar and the List name form, so the board came from the server; the proxy logs `GET /api/lists` and `GET /api/board/events` with `user-agent: Dalvik/2.1.0 (Linux; U; Android 16; ...)` and no `Origin`. The stream badge stays `Connecting`: `CapacitorHttp.request` returns a body only when the response ends, so a server-sent-events stream never delivers an event (Tauri's showed `Live`). Proposal P4.

**Caller cookie: survives across requests (yes), with `CapacitorCookies` not enabled.** `adb shell input tap` on the field, `input text`, `keyevent 66`, twice:
- `POST /api/lists` cookieSent `-`, setCookie `a8b346636b`, 200
- `GET /api/lists` cookieSent `a8b346636b`
- `POST /api/lists` cookieSent `a8b346636b`, setCookie `-`, 200
- `GET /api/board/events` cookieSent `a8b346636b`
So the Capacitor half of 0607 does not reproduce on Android: `CapacitorCookies.load()` always runs `CookieHandler.setDefault(new CapacitorCookieManager(...))` (`@capacitor/android` `CapacitorCookies.java:22-28`), which `HttpURLConnection` under `CapacitorHttp` uses; the `enabled` flag only answers `isEnabled()` for the JS `document.cookie` patch (`:36-40`). On iOS `CapacitorHttp` uses `URLSession(configuration: URLSessionConfiguration.default)` (`CapacitorUrlRequest.swift:244`), whose shared cookie storage keeps cookies whatever `enabled` says (source reading; not run). Enabling `CapacitorCookies` would hand the native jar to `document.cookie` in the page, which the driver's contract ("`set-cookie` never reaches the page") rules out, so no template change is made.

**Caller cookie across a restart: lost, as in Tauri.** `am force-stop`, `am start`, a write: `POST /api/lists` cookieSent `-`, setCookie `9197904c09`. `CapacitorCookies.load()` and `handleOnDestroy()` call `removeSessionCookies()`, and the caller cookie is a session cookie. Proposal P2.

**One write across a crash: yes (12 of 12 whole).** `androidkill.py` (scratch, seed 1337), 12 trials: start the proxy, start the app and let the board load (5 s), stop the proxy, type a list name and Enter (the write queues and the outbox is stored with `Preferences.set`), `run-as dev.keel.golden1 kill -9 <pid>` after a random 0-300 ms, then read `shared_prefs/CapacitorStorage.xml`; `pm clear` between trials. Result: 10 trials `xml whole, keel JSON whole, keys ["keel.outbox.todos.outbox"], entries 1` (the new state); 2 trials (kills at 50 and 61 ms) no `CapacitorStorage.xml` yet (the earlier state: nothing stored); no `.bak` left; 0 torn. This matches `SharedPreferencesImpl`, which writes a new file after keeping the old one as `.bak` and restores the `.bak` on load. (A first run with a mis-aimed tap posted nothing; its 12 "whole" lines are discarded, not counted.)

Afterwards: `adb emu kill`, `./gradlew --stop` (`1 Daemon stopped`), `adb kill-server`, `avdmanager delete avd -n keel-s8-shells`.

## 4. `packages/compiler/conformance/shell-entry.test.ts`

Not skipped: since rfc:0085 conformance commit 8a2a0bd6 it fakes the native tool (`node_modules/.bin/tauri`, `cargo`, `rustc`, `npx` on a private `PATH`) and runs three `keel build`s. The backlog line 0609 still calls it skipped; that part of the line is stale. Run once: `pnpm exec vitest run conformance/shell-entry.test.ts --reporter=dot` (packages/compiler): `Test Files 1 passed (1)`, `Tests 1 passed (1)`, 3.15 s. Its weak `drivers` match is backlog 0692. The real native builds are sections 2, 3 and 5.

## Proposals (spec or conformance changes: not built)

### P1. Tauri storage: a crash inside a save empties the store (std.shells, std-tauri)
Choice (b): the fix needs a second file, which std.shells names.
- std.shells, API bullet: today "`storage` on `@tauri-apps/plugin-store`, file `keel.json` in the app's data directory, saved before a write resolves;". Proposed: "`storage` on `@tauri-apps/plugin-store`, files `keel.json` and `keel.b.json` in the app's data directory, saved in turn before a write resolves, each document with a generation; a load takes the newer one that parses, so a crash inside a save leaves the earlier or the new state;". Conformance gains: "A save that stops after emptying its file (a crash) leaves a new driver reading the earlier or the new value of every key." The section goes from 560 to 632 tokens.
- Conformance that quotes or depends on the sentence: `packages/std-tauri/conformance/storage-contract.test.ts:171-178` ("saved before a write resolves", reads `keel.json`), `restart.test.ts:4` (only the saved `keel.json` survives), `fixtures.ts`.
- Cases for a writer: over the plugin-store stand-in whose `save` empties the file and then throws (as `test/storeStorage.crash.test.ts` does): `set('k','1')`; crash in the save of `set('k','2')`; a new driver reads `'1'` or `'2'`. Twice in a row (crash, then a good save, then a crash) still reads a value some resolved or crashed `set` gave. A file holding a valid document of a lower generation than the other is not read.
- Code outline: `storeStorage` opens both stores, keeps `{ gen, data }` in each, reads the higher `gen` among those that parse, and writes the whole next document to the other file. Each write rewrites the whole document (as Capacitor's already does).
- Alternative: the generated `src/lib.rs` replaces plugin-store with an atomic write (temporary file, fsync, rename): a k.shell Files change and Rust code Keel would own. The two-file driver keeps the plugins unmodified.
- The user decides: the file names, and whether the doubled write cost is acceptable.
- Recommendation: build the two-file driver; it is JS-only, testable without a device, and plugin-store's `fs::write` stays out of the durability claim.

### P2. The caller cookie lasts one run of the app in both shells (k.security)
Choice (b): a cookie attribute is a security choice.
- Shown: Tauri saves only persistent cookies, and Capacitor removes session cookies at start and stop; the caller cookie has no expiry, so each app start is a new caller. A browser drops it when it quits, so the shells behave like a browser. In golden-1 the effect is that Undo after a restart does not reach a write made before it (`undoWhere` on `meta.caller`); the outbox is not affected (owner `""`).
- k.security, Caller cookie: today "The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, ...". Option: "The cookie (`HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000`) ...". The section goes from 1,499 to 1,504 tokens, over the 1,500 cap, so 4 tokens must be cut elsewhere in it. Conformance cases: a minted caller cookie carries `Max-Age=34560000`; a sent valid cookie gets no new `set-cookie`.
- The user decides: keep the browser's session rule (no change; then state in k.shell that a shell start is a new caller), or make the caller persistent for browsers and shells alike (400 days, the longest a browser keeps).
- Recommendation: keep the session cookie and add the k.shell sentence. A caller that outlives the app is a tracking identifier this design has not needed.

### P3. Android refuses the `http://localhost` origin that k.shell accepts (k.shell Build, cli)
Choice (b): Build step 3 lists what is staged beside the shell files.
- k.shell Build 3: today "beside the shell files, for Capacitor the app's `package.json` and, for Tauri, the http permission for `KEEL_ORIGIN`." Proposed: "beside the shell files, for Capacitor the app's `package.json` (and `server.cleartext` when `KEEL_ORIGIN` is `http:`, which Android refuses otherwise) and, for Tauri, the http permission for `KEEL_ORIGIN`." Conformance gains: "`KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` stages a `capacitor.config.json` with `server.cleartext` `true`; with an `https:` origin it has no `server`." The section goes from 1,320 to 1,391 tokens.
- Conformance quoting the sentence: `packages/cli/conformance/build-target-tools.test.ts:2`.
- Code outline: `shellBuild` writes the staged `capacitor.config.json` (the copy in `dist/`, made writable) with `server: { cleartext: true }` when `plan.origin` is `http:`; `deploy/` stays as generated. A unit test in `packages/cli/test/` over the staged file.
- Also note: `localhost` on a device is the device itself, so an `http:` origin works only with `adb reverse`; the emulator's host address `10.0.2.2` is E1574.
- Recommendation: build it; without it the one local loop k.shell allows does not work on Android.

### P4. Server-sent events never arrive through Capacitor's net (std.shells, std-capacitor)
Choice (b): there is no standard-only fix, and the options change the API or the cookie rule.
- Shown: the board stream answers 200 but `CapacitorHttp.request` resolves only when the response ends, so golden-1's badge stays `Connecting` on Android; on Tauri it reads `Live`.
- Options: (a) state the limit in std.shells ("a server-sent-events response arrives only when it ends") and have channels fall back to re-reading on a timer in a Capacitor shell; (b) send `accept: text/event-stream` requests through the webview's `fetch` to `origin`: that needs CORS for `https://localhost` and `capacitor://localhost`, and the native caller cookie does not reach it, against k.shell's cookie rule; (c) a native streaming plugin, which Keel would own.
- Recommendation: (a) now, as a spec sentence and a test in std-capacitor that the stream request resolves when the body ends; decide (c) only if live updates on mobile are needed.

### 0607 outcome
Neither half reproduces: the Tauri crate takes plugin-http's default features, which include `cookies`, and Capacitor's native cookie jar is installed whatever `CapacitorCookies.enabled` says. No template change; the std-tauri and std-capacitor READMEs now state both, and P2 records the restart behaviour.

## 5. Capacitor iOS build (attempted)

`KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target capacitor --platform ios` (Xcode 26.6, SDK iphonesimulator26.5): `cap add ios` and `cap sync ios` ran, and `xcodebuild -project App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build` started, resolved the package graph (`Checking out 8.6.2 of package 'capacitor-swift-pm'`) and then sat at 0% CPU with `build/SourcePackages/artifacts/` empty for over 7 minutes, fetching the `Capacitor.xcframework.zip` and `Cordova.xcframework.zip` binary targets. The network was fine: `curl -L` fetched the same `Cordova.xcframework.zip` (1,842,455 bytes) in 0.24 s. It was stopped with SIGTERM; `keel build` printed `fail build 103 files, 14 artifacts, 1 errors`, exit 1. So the `xcodebuild` flags were accepted (no argument error) but no simulator app was built: a limit, not a result. A next try could run `xcodebuild -resolvePackageDependencies` once in a session with Xcode's download prompts answered.

## Limits (not claimed)

- **iOS.** The simulator build stalled in Xcode's package download (section 5), so no app was built, installed or started; storage on UserDefaults across a crash and the iOS cookie jar are source readings only.
- **Tauri on Linux and Windows.** Built and run on macOS (WKWebView) only. Linux needs WebKitGTK 4.1 and its apt packages (no Linux host here), Windows needs WebView2 (no Windows host). `tauri-driver` and the RFC's Tauri replay smoke run on Linux only.
- **The Tauri replay** (RFC 0085 exit: a recorded session replayed inside the Tauri shell over WebDriver) needs Linux `tauri-driver` under `xvfb-run`; macOS has no WebDriver for WKWebView. Not run.
- **A physical device.** Only an Android 16 arm64 emulator. Vendor storage stacks and OEM WebViews are not covered.
- **Release signing and store upload.** Not Keel's (k.shell), and no signing identity is used here: `--release` was not run.
- **Power loss.** The kills are SIGKILL, so the page cache survives. plugin-store's `fs::write` does not fsync, so power loss is a wider window than the one shown; not tested.
- **CI shell jobs** (0609): not run here; they are `.github/` work, which this lane does not touch.

## Changes and checks

Files changed: `packages/std-tauri/README.md` and `packages/std-capacitor/README.md` (Platform: what crash safety and cookies are on each shell), `packages/std-tauri/test/storeStorage.crash.test.ts` (new, `test.fails`, P1), this record. No code, template, spec or conformance change, so no changeset. Build outputs under `apps/golden-1/dist/web/` (gitignored) were built with `KEEL_ORIGIN=http://localhost:4182`, and the staged Capacitor config there has the P3 cleartext patch; the next `keel build --target` replaces both.

- `pnpm --filter @keel/std-tauri check`: tsc clean, biome `Checked 14 files ... No fixes applied.`
- `pnpm --filter @keel/std-capacitor check`: tsc clean, biome `Checked 13 files ... No fixes applied.`
- `vitest run test/storeStorage.crash.test.ts` (std-tauri): `Tests 1 expected fail (1)`; with `test.fails` changed to `test` it fails with `AssertionError: expected [ 'earlier', 'new' ] to include null`.
- `vitest run conformance/shell-entry.test.ts` (compiler): `1 passed`.
- `pnpm --filter @keel/std-tauri build`, `pnpm --filter @keel/std-capacitor build`: `tsc -p tsconfig.build.json`, exit 0.
- `node tooling/budgets.mjs --quiet`: `ok budgets 138 measured`.
- `node tooling/generate.mjs --check`: `ok generate 12 files, 3 apps`.
- `node tooling/voice-lint.mjs`: `ok voice-lint 2929 files`.
- `pnpm orphans`: `ok orphans 0 found`.
- `ps aux | grep -E 'emulator|qemu|gradle|tauri|golden-1|xcodebuild|adb|proxy.mjs|server.mjs|fswrite'`: nothing. Ports 4181, 4182 and 5584 have no listener. The scratch AVD is deleted; `~/Library/Application Support/dev.keel.golden1` (the Tauri store this run made) is removed.

## Fixes and re-runs (P1 built, P3 built, P4 proposed, P2 left to the operator)

Same machine and toolchain as section 1. Scratch files (proxy, harnesses, logs) under the session scratchpad, not the repo. The api server and the logging proxy were started as in section 2 (`dist/api/server.mjs` on 4181 with a scratch `KEEL_DATABASE_URL` and a 38-byte `KEEL_SECRET`; a proxy on 4182 logging method, path, `Origin`, `User-Agent`, `Accept` and sha256 prefixes of the caller cookie sent and set, and each streamed chunk of `/api/board/events`).

### P1 built: two whole copies over plugin-store
Design: `storeStorage` keeps `keel.json` and `keel.b.json`, each one plugin-store key `keel` = `{ gen, sum, data }` (`sum` FNV-1a of `gen:data`). A load reads both through `reload({ ignoreDefaults: true })` (its error tells `Failed to deserialize store` from a missing file, `os error 2`/`3`) and takes the newer whole copy. A write saves the next copy first to the file the copy was not read from, then to the other, so the only whole copy is never the one being truncated. No whole copy: empty only when `keel.json` is missing (a fresh install, or a crash inside the very first save); otherwise every call rejects with `ctx.storage: keel.json and keel.b.json hold no whole copy of the store; delete both to start empty` and nothing is overwritten (as `fileStorage` does for a file it cannot parse). Why not write-to-temp and rename: plugin-store has no rename, and `@tauri-apps/plugin-fs` is a new JS dependency, a new crate in the generated `Cargo.toml`, and an `fs:` scope in the generated capability; `store:default` already allows `load`, `reload`, `set`, `get`, `length` and `save`, so the two-file design adds no permission, plugin or Rust code. Cost: two whole-file saves per write, no `fsync` (power loss not covered). Spec note: std.shells' API bullet names one file (`file keel.json ... saved before a write resolves`); the conformance (`storage-contract.test.ts` reads `keel.json` after each write) still holds because both files hold the new copy when a write resolves, but the sentence should name `keel.b.json` too (P1's spec text above, adjusted to "the file not read from first").

- Unit: `test/storeStorage.crash.test.ts` is now 8 plain tests (crash at offsets 0/1/40/200/400; crash inside the first save reads empty; both files whole after a write; damaged `keel.json` falls back; newer generation wins; checksum mismatch rejected; four no-whole-copy layouts reject and are not overwritten; another read error rejects naming the file): `Tests 8 passed (8)`.
- Property: `test/storeStorage.crash.property.test.ts` (seed 1337): a save cut at every byte offset of both files, over random earlier and new states via `set` and `commit` (60 runs), and runs of writes killed at random offsets each followed by a restart (200 runs): `Tests 2 passed (2)`. Before the write-order fix it failed with `[["a","",57],["a","",0]]` (a torn `keel.json` left by one crash, then a crash inside the backup's save): that is why the write goes to the file not read from first.
- `test/storeStorage.failure.property.test.ts` rewritten for the new driver: `Tests 4 passed (4)`. Conformance, each file alone: cookies 2, network-error 2, no-global-fetch 1, origin-map 2, restart 2, storage-contract 9, all passed. Package suite once: `ok 37 tests, 0 failed, 0 skipped`.

**Kill loop, harness (the driver's code over real files).** `loop.mjs`: a child `node` runs the real `storeStorage` (repo source) over plugin-store's file semantics on real files (`save` = `writeFileSync`, open with truncate then write, as `fs::write`), writing `keel.outbox` in a loop and logging each resolved generation; SIGKILL after a random 50-150 ms (seed 1337); then a fresh driver reads the files. Whole = the read is the last logged or the next generation, byte-exact.
- 300-byte values: `{"trials":200,"whole":200,"empty":0,"torn":0,"fault":0,"damagedFileSeen":88}`
- 1 MB values: `{"trials":200,"whole":200,"empty":0,"torn":0,"fault":0,"damagedFileSeen":20}`
- The same loop over the single-file driver (`git show HEAD:` copy): 300 B `{"whole":134,"empty":66,"damagedFileSeen":66}`, 1 MB `{"whole":149,"empty":51,"damagedFileSeen":51}`, matching section 2's finding.
`damagedFileSeen` counts kills that left a file cut short: 88 and 20 kills landed inside a save, and every one read whole.

**Tauri: build, start, the app's own write path.**
- `KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target tauri` (apps/golden-1): `ok build web tauri dist/web/tauri/target/debug/golden-1`, exit 0; 53,374,248 bytes; the bundle names `keel.b.json` and `localhost:4182` once.
- Start: the proxy logs `GET /api/lists`, `GET /api/board/events` (`accept: text/event-stream`, 200, first chunk 44 bytes on arrival) and `GET /api/lists`, each `origin: tauri://localhost`, `user-agent: tauri-plugin-http/2.9.0`. The screen was locked (a `screencapture` showed the lock screen), so System Events keystrokes could not reach the window this time; writes were driven through the outbox instead.
- Fallback from a crash's leftovers: `~/Library/Application Support/dev.keel.golden1/keel.b.json` seeded with a whole generation-2 copy holding one queued `createList` ("Seeded from keel.b.json"), `keel.json` with the first 37 bytes of a generation-3 copy (a cut save). Started the app: proxy `POST /api/lists` 200 (setCookie `180c00c93a`), then `GET /api/lists` with that cookie; `GET /api/lists` from curl shows the list "Seeded from keel.b.json"; afterwards both files are 126 bytes, generation 4, `entries: []` (the drain's two writes, each saved to both files).
- Kill loop on the built app (`appkill.mjs`): each trial seeds both files with a whole copy of 5 queued `createList` entries, starts `target/debug/golden-1`, SIGKILLs it after a random 400-1600 ms (seed 1337) while the outbox drains and saves, then reads the files with the real driver: `{"trials":200,"whole":200,"notWhole":0,"damagedFileSeen":0,"wroteAfterSeed":191}`: 200 of 200 whole, 191 trials had saved at least one later state before the kill. No kill in this loop left a file cut short (the app's saves are short next to the delays), so a cut inside a save is shown by the harness loop above, not by this one.

### P3 built: cleartext to an `http:` origin's host, debug builds only
Rule (`packages/cli/src/shell/androidNetworkSecurity.ts`, run by `shellBuild` before Gradle): when `KEEL_ORIGIN` is `http:` and the build is not `--release`, the Android project gets `res/xml/keel_network_security.xml` (`base-config cleartextTrafficPermitted="false"`, one `domain-config cleartextTrafficPermitted="true"` for the origin's host, `includeSubdomains="false"`) and `AndroidManifest.xml` names it. An `https:` origin or `--release`: neither, and a config an earlier build wrote is taken out (the platform folder persists between builds). A manifest that names another config is left alone and gets no cleartext. `capacitor.config.json` and `deploy/` stay as generated (`server.cleartext` was not used: Capacitor turns it into `usesCleartextTraffic="true"` for every host). A release build with an `http:` origin therefore cannot reach it on Android: release builds take an `https:` origin. Tests: `test/androidNetworkSecurity.test.ts` `Tests 7 passed (7)` (incl. a property, seed 1337); `test/shellBuild.test.ts` `Tests 10 passed (10)` (new case: http debug writes it, https removes it, release removes it, `capacitor.config.json` untouched). `packages/cli/conformance/build-target-tools.test.ts`: `Tests 4 passed (4)`. Spec note: k.shell Build 3 lists what is staged beside the shell files and does not mention this config; P3's sentence above should say "a network security config allowing cleartext to the `http:` origin's host in a debug Android build" instead of `server.cleartext`.

**Android: build with an `http:` origin, no hand edit.** `ANDROID_HOME=~/Library/Android/sdk KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target capacitor --platform android`: `ok build web capacitor dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`, exit 0; APK 4,724,773 bytes. Staged `capacitor.config.json` is `appId`, `appName`, `webDir` only; `android/app/src/main/res/xml/keel_network_security.xml` allows `localhost` only; the manifest has `android:networkSecurityConfig="@xml/keel_network_security"`. (This build replaced `dist/web/`, the Tauri build folder included, so Tauri was rebuilt afterwards: same trailer, same size.)

**Start.** Scratch AVD `keel-s8-fix` (android-36 google_apis arm64-v8a, pixel_6), `emulator -no-window -no-audio -no-boot-anim -no-snapshot -port 5584`, booted after the 4th 3 s poll; `adb reverse tcp:4182 tcp:4182`; `adb install -r` Success; `am start -n dev.keel.golden1/.MainActivity`. logcat: `Capacitor: Loading app at https://localhost`, no cleartext error for our requests (the only `Cleartext HTTP traffic ... not permitted` line is the WebView component updater's, pid of `com.google.android.webview:webview_apk`, to `edgedl.me.gvt1.com`).

**Requests succeed.** Proxy: `GET /api/lists` 200 and `GET /api/board/events` 200, `user-agent: Dalvik/2.1.0 (Linux; U; Android 16; ...)`, no `Origin`. Two lists typed (`input tap` on the field found with `uiautomator dump`, `input text`, `keyevent 66`): `POST /api/lists` cookieSent `-` setCookie `5d2d90caa7` 200; `GET /api/lists` cookieSent `5d2d90caa7`; `POST /api/lists` cookieSent `5d2d90caa7` setCookie `-` 200. The screen shows the board from the server (the lists the Tauri runs made).

**The live badge: `Connecting` (P4, not fixed).** `uiautomator dump` text `Connecting`; the proxy shows `GET /api/board/events` again at about +1 s, +2 s, +4 s, +8 s (7 in all), each answered 200.

### P4 proposed: the cause, and why it is not a configuration fix
Cause: not `CapacitorHttp` patching `fetch` (the staged config has no `plugins.CapacitorHttp`; the global `fetch` is unpatched and std-capacitor calls `CapacitorHttp.request` itself). std-capacitor's `net.fetch` awaits `CapacitorHttp.request`, and the Android handler reads the whole body before it answers (`HttpRequestHandler.buildResponse` -> `readStreamAsString(connection.getInputStream())`, `@capacitor/android` 8.6.2); `HttpResponseType` has no stream type (`arraybuffer | blob | json | text | document`). An event stream never ends, so no `Response` is ever returned; k.services' events call hits its response-start timeout (`api.timeout`), aborts, and the live view retries with back-off, which is the +1/+2/+4/+8 s pattern above. `CapacitorHttp` has no cancel, so the abort does not reach the native request (source reading).
Options, each beyond a configuration or adapter change:
- (a) std.shells states the limit: "Under Capacitor a server-sent-events response arrives only when it ends", and live views in a Capacitor shell fall back to re-reading on a timer. A spec sentence and a conformance case (std-capacitor: an events request resolves only when the body ends).
- (b) Send `accept: text/event-stream` requests through the WebView's own `fetch`: it streams, but the page is `https://localhost` or `capacitor://localhost`, so the server needs CORS for those origins, and the caller cookie lives in the native jar: on Android `CapacitorCookieManager` writes to the WebView's `CookieManager`, but the request is cross-site and the cookie is `SameSite=Lax`, so it is not sent; this breaks k.shell's cookie rule ("Cookies ... stay in the shell's cookie store"). Needs k.shell and k.security changes.
- (c) A native streaming plugin (Keel-owned Java and Swift) answering chunks to the page. New surface in the generated project.
Recommendation: (a) now; (c) only if live updates on mobile are needed. The user decides.

### P2: not changed (operator's security choice). The Android run shows it again: one run's writes are one caller (`5d2d90caa7`).

### Closing checks
- `pnpm --filter @keel/std-tauri check`: `Checked 17 files ... No fixes applied.`; `@keel/cli`: `Checked 314 files ... No fixes applied.`; `@keel/std-capacitor` (README only): `Checked 13 files ... No fixes applied.`
- std-capacitor conformance, each alone: cookies 2, network-error 2, no-global-fetch 1, origin-map 2, restart 2, storage-contract 8, all passed. `packages/compiler/conformance/shell-entry.test.ts`: `Tests 1 passed (1)`.
- `pnpm --filter @keel/std-tauri build`, `pnpm --filter @keel/cli build`: exit 0.
- `node tooling/budgets.mjs --quiet`: `fail budgets 138 measured`: B0002 `@keel/std-tauri 1694 bytes gzip exceeds budget 1.25kb (1280 bytes)` (1,025 before) and B0002 `@keel/cli/shell 4448 bytes gzip exceeds budget 4kb (4096 bytes)` (4,019 before). Not re-based and not trimmed by dropping behaviour: the operator decides.
- `node tooling/generate.mjs --check`: `ok generate 12 files, 3 apps`. `node tooling/voice-lint.mjs`: `ok voice-lint 2931 files`. `node tooling/structure-lint.mjs`: `ok structure-lint 3953 files`. `pnpm orphans`: `ok orphans 0 found`.

Afterwards: `adb -s emulator-5584 emu kill` (`OK: killing emulator, bye bye`), `./gradlew --stop` (`1 Daemon stopped`), `adb kill-server`, `avdmanager delete avd -n keel-s8-fix` (`AVD 'keel-s8-fix' deleted.`), the api server and proxy stopped, `~/Library/Application Support/dev.keel.golden1` removed. `ps aux | grep -E 'emulator|qemu|gradle|tauri|golden-1|adb' | grep -v grep`: nothing; no listener on 4181, 4182 or 5584.

## The `KeelHttp` plugin: Capacitor streams (std-capacitor, P4 built as choice C3)

Same machine and toolchain as section 1. Scratch files (proxy, logs) under the session scratchpad, not the repo.

**What was built.** `@keel/std-capacitor` is a Capacitor plugin: `android/` (`KeelHttpPlugin.java`, `HttpURLConnection` on a cached thread pool, the default `CookieHandler`), `ios/Sources/KeelHttpPlugin/KeelHttpPlugin.swift` (`URLSession(configuration: .default)` with a data delegate, `HTTPCookieStorage.shared`, 600 s request timeout as `CapacitorHttp` had), `Package.swift` (`KeelStdCapacitor`, the name the Capacitor CLI derives from the package name) and the `capacitor` field in `package.json`. `capacitorNet` sends every request through `registerPlugin('KeelHttp')`: three listeners (`chunk`, `end`, `fail`) are added before `request`, the `Response` resolves on the headers with a `ReadableStream` body, and the listeners are removed on end, fail, abort or a reader's cancel; abort and cancel call `cancel({ id })`. `package.json` exports `./package.json` too: the Capacitor CLI finds plugins with `require.resolve('<name>/package.json')`, and without that export the first build installed no `KeelHttp` (`capacitor.plugins.json` listed only Preferences). No cli or scaffold file changed.

**Build.** `ANDROID_HOME=~/Library/Android/sdk KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target capacitor --platform android` (apps/golden-1): `ok build web capacitor dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`, exit 0; APK 4,729,319 bytes; `capacitor.plugins.json` lists `dev.keel.capacitor.KeelHttpPlugin`. The api (`dist/api/server.mjs`, 4181, scratch sqlite, 38-byte secret) and the logging proxy (4182; also logs each `/api/board/events` chunk and each connection's close with the set still open) as before.

**Emulator.** Scratch AVD `keel-s8-stream` (android-36 google_apis arm64-v8a, pixel_6), `-no-window -no-audio -no-boot-anim -no-snapshot -port 5584`, booted after the 6th 4 s poll; `adb reverse tcp:4182 tcp:4182`; `adb install -r` Success. logcat: `Registering plugin instance: KeelHttp`.

Proxy times below are seconds since the proxy started.
- **Live badge: yes.** Launch marked by a curl at 217.19; the app's `GET /api/board/events` 200 at 217.84 with its first 44-byte event at once; `uiautomator dump` reads `Live` (and on the first start, `Live` at the first dump, 2.5 s after `am start`).
- **The stream carries the caller of the POSTs: yes.** First `POST /api/lists` (typed in the app) cookieSent `-` setCookie `de51268743`; after leaving and reopening the view the new `GET /api/board/events` (id 13) has cookieSent `de51268743`, and the next app write, `POST /api/lists/<id>/todos`, cookieSent `de51268743`, setCookie `-`. (The stream opened at the very first start precedes the first write, so it had no cookie yet.)
- **A list created from outside shows within a second: yes.** `curl -X POST /api/lists` (through the proxy) at 147.52; the event chunk (73 bytes) went down the stream at 147.52; the app's re-read `GET /api/lists` at 147.53; the next dump shows `FromCurl` on the board.
- **Leaving the view closes the stream: yes.** Tapping a list: old stream (id 3, then id 23) `close` at 165.61 and 248.55, the new one opened 10 ms later; in logcat for that process: 7 `request`, 1 `cancel`, 21 `addListener`, 18 `removeListener` (three listeners per request, the open stream's three the only ones left).
- **Stopping the app closes the stream: yes.** `am force-stop` at about 186: stream id 13 `close` at 187.62 with `open: []`; again id 19 at 215.67; `lsof` showed no established connection to 4182.
- **No hung connection: yes.** Every proxy `close` line after a navigation or stop lists only the one new stream (or nothing) as open; no repeated `GET /api/board/events` back-off pattern.
- **A normal GET and POST still work: yes.** `GET /api/lists`, `GET /api/suggestions` 200; `POST /api/lists` and `POST /api/lists/<id>/todos` 200, both shown on screen (`AppOne`, `Bread`).

Afterwards: `adb emu kill` (`OK`), `./gradlew --stop` (`1 Daemon stopped`), `adb kill-server`, `avdmanager delete avd -n keel-s8-stream` (`AVD 'keel-s8-stream' deleted.`).

**iOS: not run (the Xcode package download stalled again).** `KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target capacitor --platform ios` under a 900 s bound: `cap sync ios` wrote `CapApp-SPM/Package.swift` with `.package(name: "KeelStdCapacitor", path: ".../packages/std-capacitor")` and its product, so the CLI picks the plugin up; `xcodebuild` then sat at 0% CPU with `build/SourcePackages/artifacts/capacitor-swift-pm/{Capacitor,Cordova}` empty for over 21 minutes, as in section 5, and was stopped with SIGTERM. The same two zips fetched with `curl -L` in seconds, their sha256 matching `capacitor-swift-pm` 8.6.2's `Package.swift` checksums. With those frameworks, `xcrun --sdk iphonesimulator swiftc -typecheck -target arm64-apple-ios15.0-simulator -F <Capacitor/Cordova simulator slices> KeelHttpPlugin.swift` exits 0. So the Swift plugin compiles against Capacitor 8.6.2, but no iOS app was built, installed or started: the iOS half is unproven on a simulator or device.

Afterwards: the api server and the proxy stopped; no listener on 4181, 4182 or 5584.

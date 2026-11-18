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

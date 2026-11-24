# std.capacitor: Capacitor shell target
status: implemented

**Extension points.** Shell target (k.shell): `@keel/std-capacitor/tools` calls `shellTarget('capacitor', target)`. Its drivers are std.shells'. It follows Capacitor 8's releases and Android's and Xcode's toolchains: the versions here change with this section, not the kernel's.

**Files.** `platforms` is `['android', 'ios']`. `files` gives `deploy/<name>/capacitor/capacitor.config.json`: `appId` the `id`, `appName` the `name`, `webDir` `www`.

**Plugins.** `plugins` (k.shell), each at the version this package's own `dependencies` pin, so the native half `cap sync` installs is the one the bundled JavaScript half calls:
| plugin | need | given |
|-|-|-|
| `@capacitor/preferences` | `storage` | always |
| `@capacitor/app` | `launch and return links` | always |
| `@capacitor/browser` | `the external browser of identity.ts` | with `identity` |
`cap sync` installs a native plugin only when the app's own `package.json` lists it; without `@capacitor/app` the launch read fails and no link arrives, without `@capacitor/browser` no sign-in page opens, and neither fails a build.

**App packages.** What an app declaring `capacitor` lists beside `@keel/std-capacitor` (k.scaffold-shell writes them): in `dependencies`, `@capacitor/core` (the Capacitor CLI reads it from the app) at the version this package's `dependencies` hold, and the `plugins` (Plugins); in `devDependencies`, `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios`, each at the exact version this package's `package.json` `peerDependencies` hold, marked optional in `peerDependenciesMeta`. Both platforms are listed, as the CI jobs build both.

**Tools.** `@capacitor/cli` in the app's `devDependencies` (App packages); Android: JDK 21 (`java`, or `JAVA_HOME`) and the Android SDK (`ANDROID_HOME` or `ANDROID_SDK_ROOT`, holding `platform-tools`); iOS: macOS and Xcode 26 (`xcodebuild`). A missing or older one is an entry naming it and what is needed.

**Build.** Into `dir`: the app's `package.json` (the Capacitor CLI reads the app's plugins from it); `www/index.html` carries the `client` policy in a `<meta http-equiv>`, without the directives a meta tag ignores; `capacitor.config.json` there gains `plugins.KeelHttp.allow`, `origin` then `connect` (k.shell Origins); with no `origin` (k.shell Without a server), `connect` alone, `[]` when it is empty. `KeelHttp` reads it natively: a URL whose origin is not listed is rejected before any connection, with no `allow` every URL is, and it follows no redirect. Then `cap add <platform>` when the platform folder is missing, `cap sync <platform>`, the `id` scheme registered in the platform project, and the platform build: Gradle `assembleDebug`, or `xcodebuild` for the simulator without signing. A debug Android build whose `origin` is `http:` gets a network security config, named in `AndroidManifest.xml`, that allows cleartext to that origin's host and no other; an `https:` origin, no `origin` or `--release` allows none and removes one an earlier build wrote. `--release` builds unsigned release artifacts. The artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, or the simulator's `App.app`, under `dir`. Signing and store upload are not Keel's.

**Return links.** The `id` scheme: an Android intent filter (`VIEW`, `DEFAULT`, `BROWSABLE`) and iOS `CFBundleURLTypes`. `shellMount` reports the launch when `@capacitor/app` `getLaunchUrl` settles, then listens to `appUrlOpen`, dropping the first delivery that repeats the launch link; after a webview reload the launch URL can be delivered again and is read as any other return link. The external browser is `@capacitor/browser`: Custom Tabs on Android, an in-app Safari view on iOS, which a link that takes an opening closes (Android has none to close).

**CI.** Two `ShellJob`s: `android` on `ubuntu-24.04` with JDK 21, uploading the debug APK; `ios` on `macos-15` with Xcode 26, `manual`.

**Limits.** These need a device: that `KeelHttp` refuses an unlisted origin called from script, that each native store keeps a cookie set on a manual redirect, and one with `Max-Age` past a relaunch; that a return link reaches a cold-started and a running app.

**Rules.** None.

**Conformance.** A case that sets `KEEL_ORIGIN` has a `node` deployable `api` in its topology (k.shell Build 2).
- `KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`; a next build with `https://golden-1.example`, or with `--release`, leaves neither; `capacitor.config.json` is the generated one each time.
- The Capacitor shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`.
- With `web` declaring `capacitor`, `keel build` writes `deploy/web/capacitor/capacitor.config.json` with `appId`, `appName` and `webDir` `www`, and no Tauri file.
- A build runs `cap sync android` in `dist/web/capacitor/` beside `www/` and the app's `package.json`, and `www/index.html` holds the policy in a `<meta http-equiv>`.
- `--target capacitor` with no `java` on `PATH` and no `JAVA_HOME` prints one E1575 naming `java` and JDK 21.
- The generated workflow of a project declaring `capacitor` has a `web-android` job and a `web-ios` job that runs on `workflow_dispatch` only.
- A build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` leaves `dist/web/capacitor/capacitor.config.json` with `plugins.KeelHttp.allow` `["https://golden-1.example", "https://api.example"]`; with no `origins`, the first alone. The file under `deploy/` has no `plugins`.
- The target's `plugins` for an app with `identity` false: `@capacitor/preferences` and `@capacitor/app`, each at the version `@keel/std-capacitor`'s `package.json` `dependencies` hold, and no other; with `identity` true, `@capacitor/browser` too.
- `keel check` of a project declaring `capacitor`, with no `identity.ts`, whose `dependencies` hold `@keel/std-capacitor` and those two at those versions: no E1572. Adding `identity.ts` (and its source, a `node` deployable serving it): one E1572 naming `@capacitor/browser` and `(the external browser of identity.ts)`. Removing `@capacitor/app` instead: one naming it.
- With `web` alone (no `node` deployable), `keel build --target capacitor --platform android` with no `KEEL_ORIGIN`, after a build with an `api` deployable and `KEEL_ORIGIN=http://localhost:8080`, leaves `plugins.KeelHttp.allow` `[]` and no network security config; declaring `origins.connect` `https://api.example`, `["https://api.example"]`.
- `keel scaffold shell capacitor` writes `@capacitor/core` and the `plugins` for the app at the versions `@keel/std-capacitor`'s `package.json` `dependencies` hold, and `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios` at those its `peerDependencies` hold, each exact; with `identity.ts`, `@capacitor/browser` too. After the install and `keel build`, `keel check` reports no diagnostic and `keel build --target capacitor --platform android` with every native tool present prints no E1572, E1574 or E1575.

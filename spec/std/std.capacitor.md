# std.capacitor: Capacitor shell target
status: implemented

**Extension points.** Shell target (k.shell): `@keel/std-capacitor/tools` calls `shellTarget('capacitor', target)`. Its drivers are std.shells'. It follows Capacitor 8's releases and Android's and Xcode's toolchains: the versions here change with this section, not the kernel's.

**Files.** `platforms` is `['android', 'ios']`. `files` gives `deploy/<name>/capacitor/capacitor.config.json`: `appId` the `id`, `appName` the `name`, `webDir` `www`.

**Tools.** `@capacitor/cli` in the app's `devDependencies`; Android: JDK 21 (`java`, or `JAVA_HOME`) and the Android SDK (`ANDROID_HOME` or `ANDROID_SDK_ROOT`, holding `platform-tools`); iOS: macOS and Xcode 26 (`xcodebuild`). A missing or older one is an entry naming it and what is needed.

**Build.** Into `dir`: the app's `package.json` (the Capacitor CLI reads the app's plugins from it); `www/index.html` carries the `client` policy in a `<meta http-equiv>`, without the directives a meta tag ignores. Then `cap add <platform>` when the platform folder is missing, `cap sync <platform>`, the `id` scheme registered in the platform project, and the platform build: Gradle `assembleDebug`, or `xcodebuild` for the simulator without signing. A debug Android build whose `KEEL_ORIGIN` is `http:` gets a network security config, named in `AndroidManifest.xml`, that allows cleartext to that origin's host and no other; an `https:` origin or `--release` allows none and removes one an earlier build wrote. `--release` builds unsigned release artifacts. The artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, or the simulator's `App.app`, under `dir`. Signing and store upload are not Keel's.

**Return links.** The `id` scheme: an Android intent filter (`VIEW`, `DEFAULT`, `BROWSABLE`) and iOS `CFBundleURLTypes`. `shellMount` reports the launch when `@capacitor/app` `getLaunchUrl` settles, then listens to `appUrlOpen`, dropping the first delivery that repeats the launch link; after a webview reload the launch URL can be delivered again and is read as any other return link. The external browser is `@capacitor/browser`: Custom Tabs on Android, an in-app Safari view on iOS, which a link that takes an opening closes (Android has none to close).

**CI.** Two `ShellJob`s: `android` on `ubuntu-24.04` with JDK 21, uploading the debug APK; `ios` on `macos-15` with Xcode 26, `manual`.

**Limits.** These need a device: that each native store keeps a cookie set on a manual redirect, and one with `Max-Age` past a relaunch; that a return link reaches a cold-started and a running app.

**Rules.** None.

**Conformance.**
- `KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`; a next build with `https://golden-1.example`, or with `--release`, leaves neither; `capacitor.config.json` is the generated one each time.
- The Capacitor shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`.
- With `web` declaring `capacitor`, `keel build` writes `deploy/web/capacitor/capacitor.config.json` with `appId`, `appName` and `webDir` `www`, and no Tauri file.
- A build runs `cap sync android` in `dist/web/capacitor/` beside `www/` and the app's `package.json`, and `www/index.html` holds the policy in a `<meta http-equiv>`.
- `--target capacitor` with no `java` on `PATH` and no `JAVA_HOME` prints one E1575 naming `java` and JDK 21.
- The generated workflow of a project declaring `capacitor` has a `web-android` job and a `web-ios` job that runs on `workflow_dispatch` only.

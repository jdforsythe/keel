# native-capacitor

One page in a Capacitor shell, and no server. `topology.ts` has one deployable, `web`, with `adapter: "client"` and `shells.capacitor`; its `id`, `dev.keel.nativecapacitor`, is the app id. A Capacitor shell lists the plugins the app must list itself, `@capacitor/app` and `@capacitor/preferences`, at exact versions; `keel check` is E1572 when one is missing. `package.json` also holds `@keel/std-capacitor`, `@capacitor/core` and the Capacitor CLI and platform packages. The app has no `identity.ts`, so it makes no request to a server.

`keel build` writes the web build to `dist/web/`; `deploy/web/capacitor/` holds the Capacitor config Keel generates and the repository commits. `KEEL_ORIGIN=http://localhost:4182 keel build --target capacitor --platform ios` builds the Simulator app with `xcodebuild`; `--platform android` builds a debug APK with Gradle, with `ANDROID_HOME` set.

`test/home.test.ts` renders the page as it runs in the shell (`renderRoute` with `shell`), with the a11y checks every render runs. Run `keel check`, `keel test` and `keel build`.

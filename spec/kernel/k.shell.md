# k.shell: Native shells
status: proposed

**Declaration.** A `client` deployable may name the native shells that package it as an app: `shells: { capacitor?: { id, name }, tauri?: { id, name } }` in `topology.ts`. `id` is a reverse-DNS app id (`dev.keel.golden1`), `name` the title people see; the version is the app's `package.json` `version`. Capacitor makes the Android and iOS apps, Tauri the Linux, macOS and Windows apps. Each needs its package in `dependencies` (`@keel/std-capacitor`, `@keel/std-tauri`, std.shells; E1572, k.deploy). `shells` on another adapter, or an `id` that is not reverse-DNS, is E1573.

**Shell ctx.** A shell build's entry is the `client` entry with `createCtx({ mode: 'shell', drivers })`, the package's `storage` and `net` drivers (k.persist). The page loads from the shell's own origin (`capacitor://localhost`, `https://localhost`, `tauri://localhost`), so the drivers keep this contract:
- `net.fetch`: a request to the page's origin (a relative URL included) goes to the build's `KEEL_ORIGIN`, same method, path, search, headers and body, through the shell's native HTTP client; another origin's request goes as given. Cookies, the caller cookie included (k.security), stay in the shell's cookie store and go only to their origin. A failure rejects with a `TypeError`. `online()` and `net` events: as real.
- `storage`: the shell's native store, kept across app restarts, written before `set` or a `true` `commit` resolves.
- `clock`, `random` and registered capabilities: as real, unless a capability's `shell` factory differs.
So `modules/` run unchanged in a browser and in a shell.

**Files.** Derived from `topology.ts` by `@keel/scaffold`, as deploy files are (k.deploy); read-only (E1005, fix: the regenerated file):
- `deploy/<name>/capacitor/capacitor.config.json`: `appId`, `appName`, `webDir` `www`.
- `deploy/<name>/tauri/`: `tauri.conf.json` (`identifier`, `productName`, `version`, `build.frontendDist` `www`, one window titled `name`, `app.security.csp` the `client` policy (k.security) without peer origins, with `ipc: http://ipc.localhost` added to `connect-src`), `Cargo.toml` (exact versions of `tauri`, `tauri-build`, `tauri-plugin-store`, `tauri-plugin-http`), `build.rs`, `src/main.rs`, `src/lib.rs`, `capabilities/default.json`. Cargo writes `Cargo.lock` there on the first build; it is committed and not generated. `icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark.

**Build.** `keel build --target capacitor --platform android|ios` or `keel build --target tauri` [`--release`] builds each `client` deployable declaring that shell:
1. `KEEL_ORIGIN` from the environment: unset, or not `https:` outside `localhost`, is E1574.
2. The toolchain, before any work: JDK 21 and the Android SDK; Xcode 26; Rust 1.95 and, on Linux, WebKitGTK 4.1. A missing or older one is E1575 naming it and the version needed; each missing one, WebKitGTK through `pkg-config`, is its own E1575.
3. The shell entry and web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), beside the shell files, for Capacitor the app's `package.json` and, for Tauri, the http permission for `KEEL_ORIGIN`. Capacitor's `www/index.html` carries that policy in a `<meta http-equiv>`, without the directives a meta tag ignores. A debug Android build whose `KEEL_ORIGIN` is `http:` gets a network security config, named in `AndroidManifest.xml`, that allows cleartext to that origin's host and no other; an `https:` origin or `--release` allows none and removes one an earlier build wrote.
4. The shell's tools: `cap sync`, then Gradle `assembleDebug` or `xcodebuild` for the simulator without signing; `tauri build --debug --no-bundle`. `--release` builds unsigned release artifacts. A failing tool ends the build with its error lines, at most 12.
`--platform` without `--target capacitor`, or that target without it, is E1052 (k.cli), as is a target no `client` deployable declares. The trailer names the artifact: `ok build web tauri dist/web/tauri/target/debug/golden-1`. Signing and store upload are not Keel's.

**CI.** The generated workflow gains a job per shell on its deployable's paths: Tauri on Ubuntu (WebKitGTK packages), Capacitor Android on Ubuntu (JDK 21), each uploading its artifact; Capacitor iOS on macOS, on manual dispatch only.

**Rules.** E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS · E1574 a shell build without a valid `KEEL_ORIGIN` (names the key) · E1575 a shell build's tool missing or too old (names it and the version needed).

**Conformance.**
- With `web` (`client`) declaring `tauri`, `keel build` writes the `deploy/web/tauri/` files and no Capacitor file; a changed byte is E1005 whose fix restores it; removing `tauri` from `topology.ts` removes them.
- `tauri.conf.json` holds the declared `identifier` and `productName`, the `package.json` `version`, and the deployable's policy with `ipc: http://ipc.localhost` in `connect-src`.
- `shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573.
- `keel build --target tauri` with `KEEL_ORIGIN` unset prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds.
- With no `cargo` on `PATH`, `keel build --target tauri` prints one E1575 naming `cargo` and Rust 1.95, exits 1 and writes nothing under `dist/web/tauri/`.
- The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged.
- `KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`; a next build with `https://golden-1.example`, or with `--release`, leaves neither; `capacitor.config.json` is the generated one each time.

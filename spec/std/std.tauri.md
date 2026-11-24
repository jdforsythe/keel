# std.tauri: Tauri shell target
status: implemented

**Extension points.** Shell target (k.shell): `@keel/std-tauri/tools` calls `shellTarget('tauri', target)`. Its drivers are std.shells'. It follows Tauri 2's releases: the versions here change with this section, not the kernel's.

**Files.** `platforms` is `[]`. `files` gives, under `deploy/<name>/tauri/`: `tauri.conf.json` (`identifier`, `productName`, `version`, `build.frontendDist` `www`, one window titled `name`, `app.security.csp` the `client` policy (k.security) without peer origins, with `ipc: http://ipc.localhost` added to `connect-src`, `id` as deep-link scheme, `plugins.http.scopeRedirects` `true`; none while `policy` is unset), `Cargo.toml` (the crate named from `pkg`, exact versions of `tauri`, `tauri-build`, `serde_json`, `tauri-plugin-store`, `tauri-plugin-http`, and for launch and return links (k.links) `tauri-plugin-deep-link`, `tauri-plugin-single-instance`; with `identity` also `tauri-plugin-opener`), `build.rs`, `src/main.rs`, `src/lib.rs` (starting each of those plugins), `capabilities/default.json` (core, store and deep-link; with `identity` the opener for `https:` URLs). Cargo writes `Cargo.lock` there on the first build; it is committed and not generated, and a build copies a new one back. `icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark.

**Plugins.** `plugins` (k.shell) is `[]`: each plugin's JavaScript half is this package's own dependency and its crate is in the generated `Cargo.toml`, so a Tauri app lists none.

**Tools.** `@tauri-apps/cli` in the app's `devDependencies`; Rust 1.95 (`cargo`, on `PATH` or under `CARGO_HOME`); on Linux WebKitGTK 4.1, read through `pkg-config`. A missing or older one is an entry naming it and what is needed.

**Build.** Into `dir`: `capabilities/http.json`, the http permission for `<o>/*` of `origin` and each `connect` origin (k.shell Origins) and no other URL (with `identity`, the opener's for `origin` too). With no `origin` (k.shell Without a server) it lists the `connect` origins alone; with none of those either, the build writes no `capabilities/http.json` and removes one an earlier build left in `dir`, so the http plugin sends nothing. `tauri-plugin-http` 2.9 checks a redirect hop against that scope only under `scopeRedirects`, and hands a response from outside it to the page otherwise; the driver asks it to follow none (std.shells). Also and, when `deploy/<name>/tauri/` has no `icons/icon.png`, Keel's mark as `icons/icon.png` in `dir`; then `tauri build --debug --no-bundle` with Cargo's `bin` first on `PATH`. `--release` builds an unsigned release binary. The artifact: `dist/<name>/tauri/target/debug/<crate>` (`release/` with `--release`). Signing and store upload are not Keel's.

**Return links.** The `id` scheme is registered from `tauri.conf.json` (`plugins.deep-link.desktop.schemes`). `shellMount` reports the launch when `@tauri-apps/plugin-deep-link` `getCurrent` settles, its URLs as the links, `null` as none, a rejection as a failed read, then listens to `onOpenUrl`, dropping the first delivery that repeats the launch links. The external browser is the default browser (`@tauri-apps/plugin-opener`), a root-relative URL opened on `KEEL_ORIGIN`.

**CI.** One `ShellJob`: `tauri`, on `ubuntu-24.04`, installing the WebKitGTK 4.1 Debian packages, uploading the debug binary.

**Limits.** These need an installed bundle on a desktop: that the plugin refuses an unlisted origin called from script, that the scheme registers (a debug binary registers none), and that a return link reaches a cold-started and a running app.

**Rules.** None.

**Conformance.** A case that sets `KEEL_ORIGIN` has a `node` deployable `api` in its topology (k.shell Build 2).
- With `web` (`client`) declaring `tauri`, `keel build` writes the `deploy/web/tauri/` files and no Capacitor file; a changed byte is E1005 whose fix restores it; removing `tauri` from `topology.ts` removes them.
- `tauri.conf.json` holds the declared `identifier` and `productName`, the `package.json` `version`, and the deployable's policy with `ipc: http://ipc.localhost` in `connect-src`.
- With no `cargo` on `PATH`, `keel build --target tauri` prints one E1575 naming `cargo` and Rust 1.95, exits 1 and writes nothing under `dist/web/tauri/`.
- The Tauri shell files register `id` as a scheme: Tauri's deep-link schemes.
- A build runs `tauri build --debug --no-bundle` in `dist/web/tauri/`, beside `www/`, with `capabilities/http.json` allowing `KEEL_ORIGIN`; without `icons/icon.png` in `deploy/web/tauri/` it writes Keel's mark there, with one it copies the app's.
- The generated workflow of a project declaring `tauri` has a `web-tauri` job on `ubuntu-24.04` that installs `libwebkit2gtk-4.1-dev` and runs `keel build --target tauri`.
- `tauri.conf.json` holds `plugins.http.scopeRedirects` `true`. With no `identity.ts`, `Cargo.toml` names `tauri-plugin-deep-link` and `tauri-plugin-single-instance` and not `tauri-plugin-opener`, `src/lib.rs` starts both, and `capabilities/default.json` holds `deep-link:default` and no opener permission; with `identity.ts`, the opener in all three.
- A build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` writes a `capabilities/http.json` whose http permission allows exactly `https://golden-1.example/*` and `https://api.example/*`. The target's `plugins` is `[]` with `identity` true and false.
- With `web` alone (no `node` deployable) and no `KEEL_ORIGIN`, a build after one with an `api` deployable and `KEEL_ORIGIN=https://golden-1.example` leaves no `capabilities/http.json` in `dist/web/tauri/`; declaring `origins.connect` `https://api.example`, one whose http permission allows exactly `https://api.example/*`.

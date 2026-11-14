# targets lane: record and spec sentences to apply (orchestrator, before the root gates)

Commits: 571d40a, 4a2cac4 (shell packages), 8848c1a (scaffold shell files, Dockerfile and compose storage), e285b2f, 29248c0 (`keel build --target`).
Exports: `capacitorDrivers({ origin: URL })`, `tauriDrivers({ origin: URL })`, each `{ storage: KeyValueStorage; net: Net }`. Flags: `--target capacitor|tauri`, `--platform android|ios`, `--release`; lazy `@keel/cli/shell` entry (3,008 B, no budget entry yet: add one).
Crates pinned exact: tauri =2.12.5, tauri-build =2.7.4, plugin-store =2.5.1, plugin-http =2.9.0.

## Proposed k.shell sentences (about 290 tokens of room)
1. Files: replace "the deployable's `csp.txt` policy (k.security)" with "the `client` policy (k.security) without peer origins" (+3).
2. Build 3: after "into `dist/<name>/<shell>/www/`" add "(the Vite plugin, given `KEEL_SHELL`)" (+9).
3. Build 2: add "each missing one, WebKitGTK through `pkg-config`, is its own E1575" (+14).
4. Build: add "`--platform` without `--target capacitor`, or that target without it, is E1052" (+16).

## Decisions (confirm or reverse)
- `tauri.conf.json` holds `cspPolicy({ peers: [] })` from the project's `@keel/server/csp`, independent of the environment (the native client reaches peers; the policy does not govern that). Without the policy loaded the file is neither checked nor written.
- Tauri's http permission is a separate `capabilities/http.json` written at build time.
- Conformance setup change only: `scaffold/conformance/shell-files.test.ts` gets `chmodSync(..., 0o644)` before its tamper write (generated files are 0444).

## Over budget (re-base with measured bytes when the lanes finish)
`@keel/cli` 25,163 of 24,832 after targets (25,405 after verify; more after the kernel's surface edit); `@keel/scaffold` 18,914 of 17,152. std-capacitor 957, std-tauri 952 of 1,024.

## Unverified until the toolchain exists (user installs Rust 1.95, the tauri CLI; the golden lane adds the native CLI packages)
- Tauri: `KEEL_ORIGIN=https://... keel build --target tauri` (Cargo, tauri.conf and capabilities validity; `tauri build --debug --no-bundle` in `dist/<name>/tauri`; Cargo.lock copied back).
- Android: `keel build --target capacitor --platform android` (`cap add`, `cap sync`, `./gradlew assembleDebug`, the APK path).
- iOS: `--platform ios`; the `xcodebuild -project App/App.xcodeproj` flags are unverified (Capacitor 8 uses SPM).
- CI jobs (`<name>-tauri`, `-android`, `-ios` on manual dispatch) need a pushed branch; the iOS job's `DEVELOPER_DIR`.
- Whether the native client keeps the caller cookie needs a device run.

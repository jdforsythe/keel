# ADR-0107: Capacitor packages the `client` deployable for mobile and Tauri for desktop, through generated files and shell drivers (RFC 0085)

**Status:** accepted (2026-11-11), user decisions D1, D3, D4 and D6, under the WORKFLOW RFC defaults 2, 3 and 5.

**Context.** The `shell` ctx mode delegated to the real implementations. In a native webview the page origin is the shell's own, so relative API calls miss the server, and the OS can clear the webview's `localStorage`, which holds the offline outbox. Capacitor 8 builds Android and iOS without Rust; Tauri 2 builds small desktop apps and has WebDriver on Linux; Tauri's mobile path needs Rust and the NDK and states no stability level.

**Decision.** `shells: { capacitor?, tauri? }` on a `client` deployable in `topology.ts`, each with a reverse-DNS `id` and a `name` (E1573). The deploy generator writes read-only `capacitor.config.json` and the Tauri project files (E1005). `keel build --target capacitor --platform android|ios` or `--target tauri` checks `KEEL_ORIGIN` (E1574) and the toolchain (E1575) first, then stages the web build and runs the shell's own tools; artifacts are unsigned (D4). The shell entry creates `createCtx({ mode: 'shell', drivers })` with `@keel/std-capacitor` or `@keel/std-tauri`: native storage, and native HTTP that sends the page's own-origin requests to `KEEL_ORIGIN`, keeping the caller cookie in the native cookie store (D6). Tauri applies the deployable's policy from its config; Capacitor carries it as a meta tag. CI builds the Tauri Linux binary and the Android APK per PR, the emulator replay runs nightly, iOS on manual dispatch (D3).

**Alternatives.**
- Tauri Mobile for every platform, rejected: Rust and the NDK for mobile builds and no stated stability.
- The webview's `localStorage`, rejected: the OS may clear it and drop queued writes.
- Committed native `android/` and `ios/` projects, rejected: thousands of generated files edited by hand.
- Native tools inside every `keel build`, rejected: every build would need Xcode or Rust.

**Consequences.**
- `modules/` run unchanged in a browser and in either shell.
- Signing, notarization and store upload stay outside Keel.
- macOS and Windows runs, and the iOS replay, need a developer machine.
- Icons are the shells' template defaults until a later RFC.

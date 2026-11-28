# ADR-0154: the Tauri store keeps two whole copies, a debug Android build reaches an http origin, and Capacitor streams through Keel's own native client (RFC 0132)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** The first native shell runs (Tauri on macOS, Capacitor on an Android 16 emulator) showed that a crash inside a Tauri save empties the store, that Android refuses the `http://localhost` origin k.shell accepts, that `CapacitorHttp` returns a body only when the response ends so an event stream never arrives, and that the caller cookie lasts one run of the app in both shells.

**Decision.**
- D1: std-tauri keeps `keel.json` and `keel.b.json`, each `{ gen, sum, data }`. A load takes the newer whole copy; a write saves first to the file the held copy was not read from, then to the other. With no whole copy the store is empty only when `keel.json` is missing; otherwise every call rejects and nothing is overwritten.
- D2: a debug Android build with an `http:` `KEEL_ORIGIN` gets a network security config allowing cleartext to that host only; an `https:` origin or `--release` gets none, and an earlier one is removed. `capacitor.config.json` stays as generated.
- D3: std-capacitor sends every request through its own native plugin, `KeelHttp`, on the cookie store `CapacitorHttp` uses; a response resolves at its headers, its body streams, and an abort cancels the native request. Not built; an Android emulator run and an iOS simulator run prove it.
- D4: the caller cookie's lifetime is left to the operator: a session cookie (a new caller per app start) or `Max-Age=34560000` everywhere.

**Alternatives.**
- An atomic rename in generated Rust for Tauri: Rust code Keel owns.
- `server.cleartext`: cleartext to every host, release builds included.
- A stated limit for Capacitor streams with a timer fallback: a second way to read live data.
- The WebView's own `fetch` for streams: blocked by the page policy and by `KEEL_ALLOW_ORIGINS`, and without the caller cookie, so the stream runs as caller `""` while writes run as the native caller.
- The WebView's `fetch` for everything: no caller cookie on any request, a new caller per write.

**Consequences.**
- A Tauri write costs two whole-file saves; power loss is still not covered.
- A release Android build cannot reach an `http:` origin.
- std-capacitor ships Java and Swift and likely passes 1.25kb; a raise to 1.5kb is the owner's call.
- iOS, Linux and Windows Tauri, the Tauri replay, a physical device and release signing remain unrun.

# @keel/std-tauri

**Spec:** std.shells · **Status:** proposed · **verified:** (none)

The storage and net drivers of an app packaged with Tauri for Linux, macOS and Windows.

## Contract

- **Public API:** `tauriDrivers({ origin: URL }): { storage, net }`. A shell build's generated entry passes the result to `createCtx({ mode: 'shell', drivers })`; app code never imports it.
- **Invariants:** `storage` keeps k.persist's contract on `@tauri-apps/plugin-store`, over two files in the app's data directory, `keel.json` and `keel.b.json`, each holding one whole copy of every key with its generation and a checksum. The first call loads both and takes the newer whole copy (`keel.json` on equal generations). A `set` or a `true` `commit` saves the next copy first to the file the copy was not read from, then to the other, before it resolves, so a value survives an app restart and a crash at any point of a save leaves a whole copy of the earlier or the new state. A file that is missing, cut short or fails its checksum is never read as an empty store: the other file's copy is read. Only a fresh install, or a crash inside the very first save (`keel.b.json` alone, cut short), starts empty; files holding no whole copy otherwise make every call reject with an error naming both files and are never overwritten. Calls run one at a time, so `read` is one cut and `commit` stores all of its values or none. A write that rejects rejects with the plugin's error, and the next call loads again from the files, so the driver reads what they hold. A failed load is tried again on the next call. A key twice in a `commit` rejects with E1606, whose message names no key.
- **Platform:** plugin-store's `save()` is `fs::write`, which truncates its file before writing it, and the plugin opens a file it cannot parse as an empty store; the driver reads each file through `reload`, whose error tells a missing file (`os error 2` or `3`) from one that does not parse, so the two-file save above is what keeps a crash from losing keys. A write costs two whole-file saves and no `fsync`: a SIGKILL leaves a whole copy, while a power loss inside the system's write-back window is not covered. `net.fetch` sends a request on the page's own scheme and host (`tauri://localhost`, read from `location`) to `origin` with its method, path, search, headers and body, and any other request as given, through `@tauri-apps/plugin-http`'s `fetch`, which the generated capability allows for `origin` only. The Rust client's cookie store (the plugin's default `cookies` feature) keeps every cookie, the caller cookie too, and sends each to its own origin only; no `set-cookie` header reaches the page. The plugin writes only cookies with an expiry to its file, so the caller cookie, which has none, lasts one run of the app. A failure rejects with a `TypeError` that names no URL, which k.services reports as `api.network`; an aborted request rejects with the signal's reason. The global `fetch` stays unpatched. `net.online()` reads `navigator.onLine`.
- **Dependencies:** `@keel/ctx`, `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-http`.
- **Rungs:** conformance (example + probabilistic, both plugins unmodified over Tauri's `mockIPC` under happy-dom), properties for storage against a model map, with injected save failures and a restart, for a save cut at every byte offset and for writes killed at random offsets (the read is always the earlier or the new state), and for the origin map.

## Extension points

Supplies the **storage and net drivers** (k.persist) a shell build's generated entry passes to `createCtx`.

## Unsafe

count: 0

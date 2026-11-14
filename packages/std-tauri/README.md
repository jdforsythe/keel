# @keel/std-tauri

**Spec:** std.shells · **Status:** proposed · **verified:** (none)

The storage and net drivers of an app packaged with Tauri for Linux, macOS and Windows.

## Contract

- **Public API:** `tauriDrivers({ origin: URL }): { storage, net }`. A shell build's generated entry passes the result to `createCtx({ mode: 'shell', drivers })`; app code never imports it.
- **Invariants:** `storage` keeps k.persist's contract on `@tauri-apps/plugin-store`, the file `keel.json` in the app's data directory, loaded on the first call and saved before `set` or a `true` `commit` resolves, so a value survives an app restart. Calls run one at a time, so `read` is one cut and `commit` stores all of its values or none in one save; a key twice in a `commit` rejects with E1606, whose message names no key. `net.fetch` sends a request on the page's own scheme and host (`tauri://localhost`, read from `location`) to `origin` with its method, path, search, headers and body, and any other request as given, through `@tauri-apps/plugin-http`'s `fetch`, which the generated capability allows for `origin` only. The Rust client's cookie store keeps every cookie, the caller cookie too, and sends each to its own origin only; no `set-cookie` header reaches the page. A failure rejects with a `TypeError` that names no URL, which k.services reports as `api.network`; an aborted request rejects with the signal's reason. The global `fetch` stays unpatched. `net.online()` reads `navigator.onLine`.
- **Dependencies:** `@keel/ctx`, `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-http`.
- **Rungs:** conformance (example + probabilistic, both plugins unmodified over Tauri's `mockIPC` under happy-dom), properties for storage against a model map and for the origin map.

## Extension points

Supplies the **storage and net drivers** (k.persist) a shell build's generated entry passes to `createCtx`.

## Unsafe

count: 0

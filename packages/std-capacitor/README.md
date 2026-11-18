# @keel/std-capacitor

**Spec:** std.shells · **Status:** proposed · **verified:** (none)

The storage and net drivers of an app packaged with Capacitor for Android and iOS.

## Contract

- **Public API:** `capacitorDrivers({ origin: URL }): { storage, net }`. A shell build's generated entry passes the result to `createCtx({ mode: 'shell', drivers })`; app code never imports it.
- **Invariants:** `storage` keeps k.persist's contract on `@capacitor/preferences` (SharedPreferences, UserDefaults), so a value survives an app restart. Every key lives in one Preferences entry, `keel`: a JSON document of `[key, value]` pairs, read on the first call and cached, since one page owns the store. Calls run one at a time, so `read` is one cut, and a `set` or a `true` `commit` is one `Preferences.set` of the whole next document: when it rejects, the call rejects with the plugin's error and the cache keeps the document as it was, so `commit` stores all of its values or none. A key twice in a `commit` rejects with E1606, whose message names no key. A stored document that is not `[key, value]` string pairs makes every call reject with an `Error` whose message names no key or value.
- **Platform:** on Android one `Preferences.set` reaches the disk whole or not at all across a crash: SharedPreferences keeps the old file as a backup until the new one is written, and a SIGKILL of golden-1 at a write on an Android 16 emulator left the earlier or the new document, never a torn one; UserDefaults on iOS is not verified here. Capacitor's documentation calls Preferences storage for lightweight data, not a local database, and states no size limit; the document grows with the stored state and is rewritten whole on each write. `net.fetch` sends a request on the page's own scheme and host (`capacitor://localhost`, `https://localhost`, read from `location`) to `origin` with its method, path, search, headers and body, and any other request as given, through `CapacitorHttp`. The native cookie store keeps every cookie, the caller cookie too, and sends each to its own origin only, whether or not the `CapacitorCookies` plugin is enabled (that flag only patches `document.cookie`, and is left off); no `set-cookie` header reaches the page. Capacitor removes session cookies when the app starts and stops, so the caller cookie, which has no expiry, lasts one run of the app. `CapacitorHttp` returns a body only when the response ends, so a server-sent-events stream delivers no event. Android refuses `http:` requests unless the app allows cleartext traffic: `keel build --target capacitor --platform android` allows it to the `KEEL_ORIGIN` host and no other in a debug build whose origin is `http:`, and allows none for an `https:` origin or a `--release` build. A failure rejects with a `TypeError` that names no URL, which k.services reports as `api.network`. The global `fetch` stays unpatched. `net.online()` reads `navigator.onLine`.
- **Dependencies:** `@keel/ctx`, `@capacitor/core`, `@capacitor/preferences`.
- **Rungs:** conformance (example + probabilistic, Capacitor's web Preferences and a stand-in `CapacitorHttp` under happy-dom), properties for storage against a model map, with injected write failures and a restart, and for the origin map.

## Extension points

Supplies the **storage and net drivers** (k.persist) a shell build's generated entry passes to `createCtx`.

## Unsafe

count: 0

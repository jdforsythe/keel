# @keel/std-capacitor

**Spec:** std.shells · **Status:** proposed · **verified:** (none)

The storage and net drivers of an app packaged with Capacitor for Android and iOS.

## Contract

- **Public API:** `capacitorDrivers({ origin: URL }): { storage, net }`. A shell build's generated entry passes the result to `createCtx({ mode: 'shell', drivers })`; app code never imports it.
- **Invariants:** `storage` keeps k.persist's contract on `@capacitor/preferences` (SharedPreferences, UserDefaults), so a value survives an app restart. Calls run one at a time, so `read` is one cut and `commit` stores all of its values or none; a key twice in a `commit` rejects with E1606, whose message names no key. `net.fetch` sends a request on the page's own scheme and host (`capacitor://localhost`, `https://localhost`, read from `location`) to `origin` with its method, path, search, headers and body, and any other request as given, through `CapacitorHttp`. The native cookie store keeps every cookie, the caller cookie too, and sends each to its own origin only; no `set-cookie` header reaches the page. A failure rejects with a `TypeError` that names no URL, which k.services reports as `api.network`. The global `fetch` stays unpatched. `net.online()` reads `navigator.onLine`.
- **Dependencies:** `@keel/ctx`, `@capacitor/core`, `@capacitor/preferences`.
- **Rungs:** conformance (example + probabilistic, Capacitor's web Preferences and a stand-in `CapacitorHttp` under happy-dom), properties for storage against a model map and for the origin map.

## Extension points

Supplies the **storage and net drivers** (k.persist) a shell build's generated entry passes to `createCtx`.

## Unsafe

count: 0

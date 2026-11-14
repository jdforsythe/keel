# std.shells: Shell drivers
status: proposed

**Extension points.** Drivers (k.persist): `@keel/std-capacitor` and `@keel/std-tauri` supply the `storage` and `net` a shell build's generated entry passes to `createCtx({ mode: 'shell', drivers })` (k.shell). App code never imports them.

**API** (browser; one export each).
```ts
const drivers = capacitorDrivers({ origin: new URL('https://golden-1.example') })   // @keel/std-capacitor
const drivers = tauriDrivers({ origin: new URL('https://golden-1.example') })       // @keel/std-tauri
```
Each returns `{ storage, net }` keeping k.persist's and k.shell's contracts:
- `@keel/std-capacitor` (Capacitor 8): `storage` on `@capacitor/preferences`; `net` on `CapacitorHttp` from `@capacitor/core`, whose cookies the native cookie store keeps (`CapacitorCookies`). The global `fetch` stays unpatched.
- `@keel/std-tauri` (Tauri 2, desktop): `storage` on `@tauri-apps/plugin-store`, file `keel.json` in the app's data directory, saved before a write resolves; `net` on `@tauri-apps/plugin-http`'s `fetch`, which the generated capability allows for `origin` only.
- `commit` is atomic because the package runs its storage calls one at a time, and one page owns the store.
- `net.fetch` maps a request on the page's origin to `origin` and returns a standard `Response`; a failure rejects with a `TypeError`, which k.services reports as `api.network`.

**Conformance** (Capacitor's web implementations and Tauri's `mockIPC` under jsdom).
- Each package's `storage` passes k.persist's storage clauses.
- A value `set` through one driver is read by a new driver over the same native store, as after an app restart.
- From a page at `capacitor://localhost`, `fetch('/api/lists')` reaches `https://golden-1.example/api/lists` with its method, headers and body; `https://other.example/x` keeps its URL.
- A cookie set by a response from `origin` is sent on the next request to `origin` and on none to another origin.
- A refused connection rejects with a `TypeError`, and a k.services call over it is `api.network`.
- Neither package replaces the global `fetch`.

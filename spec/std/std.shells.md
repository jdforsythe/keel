# std.shells: Shell drivers
status: implemented

**Extension points.** Drivers (k.persist): `@keel/std-capacitor` and `@keel/std-tauri` supply the `storage` and `net` a shell build's generated entry passes to `createCtx({ mode: 'shell', drivers })` (k.shell). App code never imports them. Each package's shell target is std.capacitor's or std.tauri's.

**API** (browser; one export each).
```ts
const drivers = capacitorDrivers({ origin: new URL('https://golden-1.example'), connect: [] })   // @keel/std-capacitor
const drivers = tauriDrivers({ origin: new URL('https://golden-1.example'), connect: [] })       // @keel/std-tauri
```
`connect` is a `readonly string[]` of exact origins (k.shell Origins). Each returns `{ storage, net }` keeping k.persist's and k.shell's contracts:
- `@keel/std-capacitor` (Capacitor 8): `storage` on `@capacitor/preferences`; `net` on the package's native plugin `KeelHttp` (Android `HttpURLConnection`, iOS `URLSession` with the default configuration), whose cookies the native cookie store keeps, the one `CapacitorHttp` uses (`CapacitorCookies`). `KeelHttp` follows no redirect and sends only to the origins of its `allow` configuration (std.capacitor). The global `fetch` stays unpatched.
- `@keel/std-tauri` (Tauri 2, desktop): `storage` on `@tauri-apps/plugin-store`, files `keel.json` and `keel.b.json` in the app's data directory, each a whole copy `{ gen, sum, data }` (generation, checksum, keys), saved before a write resolves, first to the file the held copy was not read from, then to the other. A load takes the newer whole copy, so a crash inside a save leaves the earlier or the new state. With no whole copy the store is empty only when `keel.json` is missing (a fresh install, or a crash inside the first save); otherwise every call rejects and neither file is overwritten. `net` on `@tauri-apps/plugin-http`'s `fetch`, each request sent with `maxRedirections: 0`, which the generated capability allows for `origin` and the `connect` origins only (std.tauri).
- `commit` is atomic: storage calls run one at a time (one page owns the store), each write is one native write (Capacitor keeps every key in one Preferences entry), and a failed write leaves the driver reading what the store holds.
- `net.fetch` maps a request on the page's origin to `origin` and returns a standard `Response`; a failure rejects with a `TypeError`, which k.services reports as `api.network`. Before each native request, the first and every redirect hop, the driver holds the URL to k.shell Origins: a refused one makes no native call.
- A `net.fetch` response resolves when its headers arrive and its body yields each chunk as the server sends it, an event stream included; aborting the request cancels the native request.

**Conformance.** Under Capacitor's web implementations and Tauri's `mockIPC` in jsdom:
- Each package's `storage` passes k.persist's storage clauses.
- A value `set` through one driver is read by a new driver over the same native store, as after an app restart.
- From a page at `capacitor://localhost`, `fetch('/api/lists')` reaches `https://golden-1.example/api/lists` with its method, headers and body. With `connect: ['https://other.example']`, `https://other.example/x` keeps its URL; with `connect: []` it rejects with a `TypeError` whose message holds no part of the URL, makes no native request, and a k.services `base` call to it is `api.network`. So do `http://other.example/x` against `connect: ['https://other.example']`, and `https://other.example.evil.test/x`.
- A cookie set by a response from `origin` is sent on the next request to `origin` and on none to another origin.
- A refused connection rejects with a `TypeError`, and a k.services call over it is `api.network`.
- Neither package replaces the global `fetch`.
- With `tauriDrivers`, a save cut at any byte of `keel.json` or `keel.b.json` leaves a new driver reading the earlier or the new value of every key; a copy of a lower generation or a wrong checksum is not read; with no whole copy and `keel.json` present every call rejects and both files keep their bytes.
- With each package, a response whose body the native side sends in two chunks resolves before the second is sent and its body yields the first; aborting it cancels the native request; no `set-cookie` header reaches the page.
- With `redirect: 'manual'`, std-capacitor's and std-tauri's `net` resolve a 303 with its `location` and no `set-cookie`, and the next request to that origin carries the cookie.
- With the default `redirect`, a GET of `/a` answered 302 to `/b` then 200 resolves with the 200 after two native requests, neither asking the native client to follow. Answered 302 to `https://evil.example/x`, it rejects with a `TypeError` and no native request names `evil.example`. Answered 302 to a `connect` origin, the second request goes there without the first's `authorization`.
- A POST with a body answered 303 to `/done` sends a GET of `/done` with no body and no `content-type`; answered 307, a POST with the same body. Every answer a 302 to the next path: 21 native requests, then a `TypeError`. A 302 with no `location` resolves as the 302.
- With `redirect: 'error'`, a 302 rejects with a `TypeError` after one native request.

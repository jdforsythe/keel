---
"@keel/std-capacitor": minor
"@keel/std-tauri": minor
---

`capacitorDrivers({ origin })` and `tauriDrivers({ origin })`: the `storage` and `net` drivers a shell build's entry passes to `createCtx({ mode: 'shell', drivers })`. Storage keeps k.persist's contract on Capacitor Preferences or the Tauri store file `keel.json`; net sends the page's own-origin requests to `origin` through the native HTTP client, whose cookie store keeps the cookies, and leaves the global `fetch` alone.

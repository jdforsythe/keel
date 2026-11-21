---
"@keel/router": minor
"@keel/testing": minor
"@keel/std-capacitor": minor
"@keel/std-tauri": minor
"@keel/std-offline": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/compiler": minor
"@keel/check": patch
---

A page in a native shell signs in through the app's auth library (k.return). In a shell build with `identity.ts`, a `Link`, `navigate`, `ok(href)` or `Form` to the identity mount is a request through `net` with manual redirects: the library's cookie stays in the native cookie store, a redirect to a provider opens the external browser, and a return link on the shell's `id` scheme comes back as a redirect. The shell files register that scheme (Tauri deep-link schemes, an Android intent filter, iOS `CFBundleURLTypes`). `renderRoute(id, { shell: true })` and `returnLink(url)` test it. E1581 no longer fires for a hosted `client` deployable with `shells`. `writeFor` answers `offline.signin` for a request with no user: the outbox pauses with its entries `queued` until that owner returns, and the owner `""` holds other owners' entries instead of failing them.

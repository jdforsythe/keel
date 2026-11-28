---
"@keel/compiler": minor
---

A `client` build with `KEEL_SHELL` (`capacitor` or `tauri`, set by `keel build --target`) writes `dist/<name>/<shell>/www/`, and its entry creates `createCtx({ mode: 'shell', drivers })` from that shell's std.shells drivers for `KEEL_ORIGIN`. The plain client entry is unchanged.

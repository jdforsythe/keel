---
"@keel/check": patch
"@keel/cli": patch
"@keel/std-capacitor": patch
---

E1572's plugin message reads `<deployable>: <shell> needs <plugin> <version> (<need>)` and fits whole; the plugin, version and need hold at most 50 characters together. `@capacitor/browser`'s need reads `external browser sign-in`.

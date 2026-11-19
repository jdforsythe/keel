---
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": minor
---

Every browser bundle, each worker's included, gets the server-only stubs and the E1007 walk; server-only is the name on disk, any case and extension, and a non-JS server-only file fails the build. A handler is known by binding (E1551, E1009, E1007 `handler`); Node built-ins come from a shipped list; a project `envPrefix` or `define`, and a `KEEL_*` value in an emitted file, fail the build with E1007. E1010 reports a miscased specifier in `keel check` and every build; `keel build` prints a Vite failure's Keel-coded lines.

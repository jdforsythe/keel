---
"@keel/cli": minor
"@keel/scaffold": minor
---

`keel build --target capacitor --platform android|ios` and `keel build --target tauri` [`--release`] check `KEEL_ORIGIN` (E1574) and the toolchain (E1575) before any work, then build the web app, stage the shell entry's build in `dist/<name>/<shell>/www/` beside the shell files, and run the shell's own tools. The trailer names the artifact. `@keel/scaffold` exports `shellDeployables`, `crateName` and `tauriHttpCapability`.

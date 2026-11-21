---
"@keel/cli": minor
"@keel/scaffold": minor
---

`@keel/cli` exports `shellTarget(shell, target)` and the types `ShellTarget`, `ShellApp`, `ShellJob`, `ShellProbe`, `ShellBuild` and `Probe`; Capacitor and Tauri knowledge lives in `@keel/std-capacitor/tools` and `@keel/std-tauri/tools`. `keel check` and `keel build` import the tools of each shell a `client` deployable declares (E1159 when one cannot be imported, E1585 when it registers no target or a `files` path leaves its folder). `@keel/scaffold`'s `deployFiles`, `deployDrift`, `scaffold` and the CI workflow take the registered targets (`DeployShells`) and stay pure.

`tauriHttpCapability` and `crateName` (from the package name) are exported from `@keel/std-tauri/tools`; `deployFiles` takes the package name as `pkg`.

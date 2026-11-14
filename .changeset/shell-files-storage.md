---
"@keel/scaffold": minor
"@keel/cli": minor
---

The deploy generator reads `storage` and `shells` from `topology.ts`. A `'sqlite'` deployable's Dockerfile keeps `/data` and drops the storage flags, a `'postgres'` one has no volume, and `compose.yaml` takes `KEEL_DATABASE_URL` from the environment. A `client` deployable's shells get `deploy/<name>/capacitor/capacitor.config.json` or the `deploy/<name>/tauri/` project (`tauri.conf.json` with the deployable's policy and Tauri's IPC origin, `Cargo.toml` with exact crate versions, `build.rs`, `src/main.rs`, `src/lib.rs`, `capabilities/default.json`) and CI jobs. `keel build` writes them and `keel check` reports a changed one as E1005.

---
"@keel/cli": minor
---

`keel build` writes `.keel/surface.json` (routes with params, search, GET answer and action input and answer; `service({ module })` endpoints with their calling module; source hashes), evaluated through a Vite SSR server. `keel check --base <surface.json>` hands the deployed surface to `check` for E1562; an unusable file is E1052. `Io.read` reads a flag's file outside the loaded scope.

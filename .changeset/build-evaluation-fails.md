---
"@keel/compiler": minor
"@keel/cli": minor
---

The build-time evaluation bundles as the server build does, so a `routes.ts` whose graph reaches a CommonJS package that requires a Node built-in (`pg`) evaluates. Each evaluation problem (E1006, E1807) fails `keel build` and `vite build` with exit 1 and counts in the summary's errors; `keel dev` prints it and keeps serving. `keel build` copies the served modules' `migrations/` folders into `dist/<name>/modules/<id>/migrations/`, the built `server.mjs` sets `KEEL_APP_DIR` to its folder when unset, and `keel dev` sets `KEEL_DEV_DIR` to the app's `.keel-dev/`.

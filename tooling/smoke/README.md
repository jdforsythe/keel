# Browser smoke

`node tooling/smoke/smoke.mjs <png>` loads http://localhost:4180 (or SMOKE_URL)/ (run `pnpm --filter golden-1 build && pnpm --filter golden-1 exec vite preview --port 4173` first) in headless Chromium and prints text, element ids, and console errors. `interact.mjs` adds a list and follows its link. Needs `pnpm exec playwright install chromium` once.

`inspector.mjs [png]`: serve golden-1 with `keel dev --port 4180` from `apps/golden-1` (the dev entry reports live graph and stores to the `/__keel/inspect` that `keel dev` serves; or set SMOKE_TARGET); build and serve `apps/inspector` with `vite preview --port 4182` (SMOKE_INSPECTOR). It adds a list in golden-1, opens the inspector at `?url=<target>`, and prints the graph, stores, and ids views.

`persist.mjs [png]`: golden-1 data lives behind the api. Run `pnpm dev > dev.log` from `apps/golden-1` (`keel dev` serves the web app and both api modules on one origin) and set `SMOKE_URL` to the address it serves (default http://localhost:4182/), `SMOKE_API_LOG=dev.log`. It creates a list, reloads, opens it, adds a todo, reloads, toggles, undoes, reloads, then prints the POST `req` lines of the log and a trailer. To smoke the built entry instead, run `pnpm --filter ./apps/golden-1 build`, then `KEEL_SECRET=<32+ bytes> PORT=<port> pnpm --filter ./apps/golden-1 api > api.log` and point `SMOKE_URL` at that port.

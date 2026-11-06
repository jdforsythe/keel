# Browser smoke

`node tooling/smoke/smoke.mjs <png>` loads http://localhost:4180 (or SMOKE_URL)/ (run `pnpm --filter golden-1 build && pnpm --filter golden-1 exec vite preview --port 4173` first) in headless Chromium and prints text, element ids, and console errors. `interact.mjs` adds a list and follows its link. Needs `pnpm exec playwright install chromium` once.

`inspector.mjs [png]` (task 0031): build golden-1 with `NODE_ENV=development pnpm --filter golden-1 exec vite build` (the dev entry reports live graph and stores) and serve it with `vite preview --port 4180` (or set SMOKE_TARGET); build and serve `apps/inspector` with `vite preview --port 4182` (SMOKE_INSPECTOR). It adds a list in golden-1, opens the inspector at `?url=<target>`, and prints the graph, stores, and ids views.

`persist.mjs [png]` (0032 D-next): golden-1 data lives behind the api. Run `KEEL_API_PORT=<port> node apps/golden-1/server.ts > api.log` and `KEEL_API_PORT=<port> pnpm --filter golden-1 exec vite preview --port 4182` after a build; `SMOKE_URL` (default http://localhost:4182/), `SMOKE_API_LOG=api.log`. It creates a list, reloads, opens it, adds a todo, reloads, toggles, undoes, reloads, then prints the api's POST `req` lines and a trailer.

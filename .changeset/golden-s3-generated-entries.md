---
"golden-1": minor
"golden-2": patch
"sessions": patch
---

The three apps run from the generated entry `dist/<name>/server.mjs` that `keel build` writes, and none keeps a hand-written `server.ts`. Each reads `PORT`, `KEEL_SECRET` and `KEEL_ORIGIN` from the environment, and each has generated `deploy/` files and `.keel/surface.json`; `apps/sessions` takes `KEEL_SECRET` and `PORT` in place of `KEEL_SESSIONS_SECRET` and `KEEL_SESSIONS_PORT`. golden-1 gains the `digest` module: the job `digest.recount` reads the board through `service({ module: 'api' })` and stores open and done counts, on `POST /digest/refresh` and at the start of every hour (UTC); `GET /digest` answers the newest count and `GET /digest/feed` streams each new one. golden-1 and golden-2 drop the Vite proxy for `/api` and gain a `dev` script (`keel dev`, every deployable on one origin), and golden-1's `check` script runs `keel check`.

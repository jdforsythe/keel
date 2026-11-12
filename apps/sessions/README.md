# sessions

Keel's own session ingest service. `topology.ts` defines one deployable, `sessions` (`node`). It places the `sessions` module, whose package serves the ingest routes, and `ops`, the home page.

The home page records its own session in the browser and posts it to `/sessions` on the first error. Uploads are same-origin: an app that records places the `sessions` module in its own `node` deployable, as this one does, and uploads to its own origin; `record` throws E2006 for any other. The recorder outlives the home component and gets the errors the page reported before it started, including a failed loader the server rendered. On a page with an opaque origin (`file:`, a sandboxed frame) it records without uploading. `vitest.config.ts` includes `.keel/sessions/*.test.ts` and `modules/*/test/`, so `keel session replay`, `minimize` and `to-test` run here and the tests `to-test` writes run under `pnpm test`.

- `POST /sessions` takes a recorded session as JSON, up to 256 KiB. The service computes the fingerprint from the session itself. The archive keeps 64 fingerprints, the newest 5 sessions of each and 4 MiB in all; past a limit the fingerprint seen longest ago goes. Anyone can post, so put rate limiting in front of the service: a flood of 4 MiB replaces the archive.
- `GET /sessions/list` returns the archive to a reader. Anyone else is redirected to `/sessions`.

## Readers
1. Make one write to the service, for example `POST /sessions` with a session. The response sets a `keel-caller` cookie.
2. Hash the cookie value: `node -e 'console.log(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("base64url"))' <value>`.
3. Add the hash to `readers` in `modules/ops/module.ts` and rebuild. The service admits a cookie only if it signed it, so a reader's hash always comes from a minted cookie, and it stays valid only while `KEEL_SECRET` stays the same.
4. Give the cookie value to `keel session ingest` as `KEEL_SESSIONS_TOKEN`.

Set `KEEL_SECRET` (32 or more bytes) where the service runs; it exits with E1560 without one. It signs the caller cookies, so a reader hash stays valid across restarts. Set `KEEL_ORIGIN` to the public https origin as well: behind a proxy that terminates TLS it makes the caller cookie `__Host-keel-caller` and `Secure`.

## Nightly Action
The `sessions-nightly` workflow (`tooling/sessions-nightly.source.json`) runs `packages/std-sessions/action` at 05:00 UTC and on demand. Each run ingests the failing sessions of the last 26 hours from the deployed service, replays them in `apps/sessions`, and opens or updates one `keel-session` issue per fingerprint that reproduces. It runs only when both the repo variable `KEEL_SESSIONS_URL` and the secret `KEEL_SESSIONS_TOKEN` are set; with either missing it skips. To turn it on:
1. Deploy the service at a public https URL with `KEEL_SECRET` and `KEEL_ORIGIN` set (`deploy/sessions/Dockerfile`, or `deploy/compose.yaml`).
2. Make one write to it and keep the value of the caller cookie it mints, `__Host-keel-caller` over https (Readers, steps 1 and 2).
3. Add the cookie's hash to `readers` in `modules/ops/module.ts` and deploy again.
4. In the repo's Actions settings, set the variable `KEEL_SESSIONS_URL` to the service's base URL and the secret `KEEL_SESSIONS_TOKEN` to the cookie value. Both are required.
5. Run the workflow once from the Actions tab (`workflow_dispatch`) and read its summary line.

## Run
Run these from `apps/sessions`:
1. `pnpm build` runs `keel build`. It writes the `.keel/` artifacts, `dist/sessions/` (`server.mjs`, the generated entry with every dependency bundled, beside the client build, `routes.json` and `std.json`) and `deploy/`.
2. `PORT=4200 KEEL_SECRET=<32+ bytes> pnpm start` serves `dist/sessions/server.mjs` on port 4200 (default 8080). Node's localStorage in `.sessions.storage` backs `ctx.storage`. On SIGTERM or SIGINT it stops listening and exits 0.

`pnpm test` runs the service in plain node over a sim ctx.

## Deploy
`deploy/sessions/Dockerfile` copies `dist/sessions/` into `node:22-slim` and keeps storage on the `/data` volume. Build it from `apps/sessions` after `pnpm build`: `docker build -f deploy/sessions/Dockerfile .`. `deploy/compose.yaml` runs it on port 8080 and takes `KEEL_SECRET` and `KEEL_ORIGIN` from the environment. Both files are generated from `topology.ts`; `keel check` reports a hand edit as E1005.

## Smoke
Port 4200 keeps clear of the golden apps. After `pnpm build`, from the repo root:
1. `PORT=4200 KEEL_SECRET=<32+ bytes> node --experimental-webstorage --localstorage-file=apps/sessions/.sessions.storage apps/sessions/dist/sessions/server.mjs` starts the service on 4200.
2. `open http://localhost:4200/` shows the home page. `curl -i http://localhost:4200/sessions/list` answers 302 to `/sessions?next=...` for a caller outside `readers`.

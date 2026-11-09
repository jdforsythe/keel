# sessions

Keel's own session ingest service. `topology.ts` defines one deployable, `sessions` (`node`). It serves `@keel/std-sessions/routes` and a home page.

- `POST /sessions` takes a recorded session as JSON, up to 256 KiB. The service computes the fingerprint from the session itself. The archive keeps 64 fingerprints, 5 sessions of each and 4 MiB in all. One caller (one `keel-caller` cookie) keeps at most 1 MiB in 16 fingerprints. Past a limit the caller holding the most loses its oldest session first, so one caller's flood never pushes out another caller's sessions.
- `GET /sessions/list` returns the archive to a reader. Anyone else is redirected to `/sessions`.

## Readers
1. Make one write to the service, for example `POST /sessions` with a session. The response sets a `keel-caller` cookie.
2. Hash the cookie value: `node -e 'console.log(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("base64url"))' <value>`.
3. Add the hash to `readers` in `modules/ops/module.ts` and rebuild. The sample entry is the hash of `sample-reader-token`.
4. Give the cookie value to `keel session ingest` as `KEEL_SESSIONS_TOKEN`.

Set `KEEL_SESSIONS_SECRET` (32 or more bytes) in production. It signs the caller cookies, so a reader hash stays valid across restarts.

## Run
Run these from `apps/sessions`:
1. `pnpm build` runs `keel build`. It writes the `.keel/` artifacts and `dist/sessions/`.
2. `pnpm start` serves on port 4200 (`KEEL_SESSIONS_PORT` overrides). Node's localStorage in `.sessions.storage` backs `ctx.storage`. Add `NODE_ENV=development` for dev mode.

`pnpm test` runs the service in plain node over a sim ctx.

## Smoke
Port 4200 keeps clear of the golden apps (golden-1 4180/4181, golden-2 4190/4191). After `pnpm build`, from the repo root:
1. `NODE_ENV=production node --experimental-webstorage --localstorage-file=apps/sessions/.sessions.storage apps/sessions/server.ts` starts the service on 4200.
2. `open http://localhost:4200/` shows the home page. `curl -i http://localhost:4200/sessions/list` answers 302 to `/sessions?next=...` for a caller outside `readers`.

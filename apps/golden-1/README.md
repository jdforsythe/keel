# golden-1

The todo app. `topology.ts` defines two deployables:

- `web` (`client`, `host: 'api'`): the browser app, built to `dist/web/` and copied into `dist/api/`, so `api` serves it. It reads and writes the board over HTTP.
- `api` (`node`): the `api` module, which owns the board (`api.board`), and the `digest` module, which counts open and done todos.

`digest` recounts the board on `POST /digest/refresh` and at the start of every hour (UTC). Its job, `digest.recount`, reads `GET /api/lists` through `service({ module: 'api' })` and stores the counts; `GET /digest` answers the newest count and `GET /digest/feed` streams each new one as server-sent events. The job queue and the schedule are the module's runners (`modules/digest/runners.server.ts`), so they run wherever `topology.ts` places `digest`.

## Dev
Run `pnpm dev` from `apps/golden-1`. `keel dev` serves `web` with hot reload and both `api` modules on one origin, with their runners; storage lives in `.keel-dev/`.

## Production
1. `pnpm --filter ./apps/golden-1 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/web/`, the `web` client as static files (`index.html`, `assets/`, `keel-mark.svg`);
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside a copy of the `web` client, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in `.api.storage`. It serves the whole app: `GET /` returns the client's `index.html`, `/api/*` answers the board, and `dist/web/` is the same client for a static host (`docs/guide/deploy-client.md`). It reads its settings from the environment and exits with E1560 when one is missing or invalid:
   - `KEEL_SECRET`: 32 or more random bytes. It signs caller cookies, so set the same value for every deployable of the app.
   - `PORT`: default 8080.
   - `KEEL_ORIGIN`: the public origin, such as `https://todo.example`. Behind a proxy that terminates TLS it makes the caller cookie `Secure` and the same-site check compare against the public host.
3. On SIGTERM or SIGINT the server stops listening, lets the runners settle and exits 0. A job that was running when it stopped runs again at the next start.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with storage on the `api-data` volume; it takes `KEEL_SECRET` and `KEEL_ORIGIN` from the environment.

## Splitting
Moving `digest` into its own deployable edits `topology.ts` alone:

```ts
api: { modules: ["api"], adapter: "node" },
digest: { modules: ["digest"], adapter: "node" },
```

`keel build` then writes `dist/digest/server.mjs` and `deploy/digest/Dockerfile`. Each server gets the other's URL as `KEEL_PEER_API` or `KEEL_PEER_DIGEST`; `digest`'s board read goes to its `api` peer, and `api` forwards `/digest` requests to `digest`.

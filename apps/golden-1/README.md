# golden-1

The todo app. `topology.ts` defines two deployables:

- `web` (`client`, `host: 'api'`): the browser app, built to `dist/web/` and copied into `dist/api/`, so `api` serves it. It reads and writes the board over HTTP.
- `api` (`node`, `storage: 'sqlite'`): the `api` module, which owns the board (`api.board`); the `digest` module, which counts open and done todos; and the `sessions` module of `@keel/std-sessions`, which answers the production tally (Production tallies below).

## Several users
Every open page follows the board. `api` serves the board channel at `GET /api/board/events`; after any save, each page re-reads `GET /api/lists` into `todos.view`, its own writes included. The header shows the stream's state: Live, Connecting, Offline or No access.

Writes go through an outbox (`todos.outbox`, kept in the browser's storage). Each write names the board head its page last read and a key of its own. Offline, a write waits in the outbox panel and the pages open from the board as last read; on reconnect the outbox sends the waiting writes in order, and a write the server already took is not applied twice. Adding a list, adding a todo and marking a todo done apply over newer writes. An edit carries both fields as the editor saw them, so the server refuses an edit made from an older board; the panel then offers Keep mine, which sends it again over the newer board, and Keep theirs, which drops it.

The edit page keeps its status in a state chart, `editorChart` (`modules/todos/editorChart.ts`, store `todos.editor`): opening the page moves it from `viewing` to `editing`, Save to `saving`, and the outbox's answer to `viewing` (sent), `conflict` (refused) or `saving` again (failed, up to 3 tries, then `gaveUp`). A queued edit stays in `saving` until the outbox sends it; the chart catches up when an edit page opens. In `conflict`, Keep mine in the outbox panel sends the edit again within the 3 tries and Keep theirs drops it; once the tries are used, Keep mine is off. The page names a failed try, a refused edit and a given-up one in `todos.edit.status`, and Save is off in `conflict` and `gaveUp`.

The server state lives in one SQLite file. Every `api` process on that host shares it: a save from one is a 409 `keel.conflict` in another that read the board before it. Pushes reach only the streams open in the process that saved.

`digest` recounts the board on `POST /digest/refresh` and at the start of every hour (UTC). Its job, `digest.recount`, reads `GET /api/lists` through `service({ module: 'api' })` and stores the counts; `GET /digest` answers the newest count and `GET /digest/feed` streams each new one as server-sent events. The job queue and the schedule are the module's runners (`modules/digest/runners.server.ts`), so they run wherever `topology.ts` places `digest`.

## Production tallies
`api` runs the `monitor` runner of `@keel/std-sessions/monitor` (`modules/api/runners.server.ts`). It counts each commit of an `api.*` transaction by name, and only by name, into `ctx.storage` key `sessions.tally`, merged every 60 seconds and at shutdown. `GET /sessions/tally` (route `sessions.tally`, listed in `modules/api/routes.ts`) answers the tally to a caller whose cookie hash is in `readers` (`modules/api/module.ts`, empty as shipped), else 403. `keel session monitor <url>` with the reader cookie in `KEEL_SESSIONS_TOKEN` writes it to `.keel/monitored.json`, which `keel ledger` reads as `monitored` evidence. `node tooling/smoke/monitor.mjs` does all of it against a production build on a local port. Placing `sessions` in `api` also serves the package's `POST /sessions` and `GET /sessions/list`.

## Tests and rungs
- `test/editorChart.test.ts` explores every state of `editorChart` under every event (closed-form `explore`), finds no unreached or dead state (`coverage`), and runs `properties` on each event's transaction.
- `test/board.explore.test.ts` explores `api.addList`, `api.addTodo`, `api.toggleTodo` and `api.editTodo` 3 writes deep from Home with Milk and Bread, over payloads with two titles, two priorities, and todo ids `t1` (taken) and `t3` (free): 112 states, each keeping the board's invariant.
- `test/board.prove.test.ts` proves with Z3 (`prove`, `@keel/testing/prove`) that `api.addList`, `api.addTodo`, `api.toggleTodo`, `api.editTodo`, `api.hideList` and `api.showList` keep the board's invariant from every state it allows, with every payload their schemas allow: the `proven` rung. `board.explore` stays the bounded check of the same transactions.
- `test/outbox.sim.test.ts` runs 100 generated schedules (seed 11) of delays, dropped, lost and unavailable requests, storage failures and offline windows while one user toggles Bread and edits Milk through `boardOutbox`. A write that left the outbox was applied once; any other waits as queued, conflict or failed.

## Dev
Run `pnpm dev` from `apps/golden-1`. `keel dev` serves `web` with hot reload and both `api` modules on one origin, with their runners; storage lives in `.keel-dev/`.

## Production
1. `pnpm --filter ./apps/golden-1 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/web/`, the `web` client as static files (`index.html`, `assets/`, `keel-mark.svg`);
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside a copy of the `web` client, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in the SQLite file `.api.sqlite` (`@keel/std-db`). A board kept in an older `.api.storage` file is not read: the server starts on an empty database. It serves the whole app: `GET /` returns the client's `index.html`, `/api/*` answers the board, and `dist/web/` is the same client for a static host (`docs/guide/deploy-client.md`). It reads its settings from the environment and exits with E1560 when one is missing or invalid:
   - `KEEL_SECRET`: 32 or more random bytes. It signs caller cookies, so set the same value for every deployable of the app.
   - `PORT`: default 8080.
   - `KEEL_ORIGIN`: the public origin, such as `https://todo.example`. Behind a proxy that terminates TLS it makes the caller cookie `Secure` and the same-site check compare against the public host.
   - `KEEL_DATABASE_URL`: the SQLite file as a `file:` URL, default `file:/data/keel.sqlite`. Processes on one host may share it; replicas on several hosts need `storage: 'postgres'` and a `postgres:` URL. A file that cannot be opened prints E2153 and exits 1; the URL never appears in a log line.
3. On SIGTERM or SIGINT the server stops listening, lets the runners settle and exits 0. A job that was running when it stopped runs again at the next start.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with the SQLite file on the `api-data` volume (`/data/keel.sqlite`); it takes `KEEL_SECRET`, `KEEL_ORIGIN` and `KEEL_DATABASE_URL` from the environment.

## Splitting
Moving `digest` into its own deployable edits `topology.ts` alone:

```ts
api: { modules: ["api"], adapter: "node" },
digest: { modules: ["digest"], adapter: "node" },
```

`keel build` then writes `dist/digest/server.mjs` and `deploy/digest/Dockerfile`. Each server gets the other's URL as `KEEL_PEER_API` or `KEEL_PEER_DIGEST`; `digest`'s board read goes to its `api` peer, and `api` forwards `/digest` requests to `digest`.

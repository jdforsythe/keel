# k.deploy: Production entry and deploy files
status: conformance-covered

**Build.** `keel build` writes `dist/<name>/` per `client` and `static` deployable (k.hosting) and `node` one: the client build (k.server), `routes.json` (all modules), `std.json`, and `server.mjs`, the generated entry, bundled, with `server.mjs.map`: sources relative to the project (one outside it: `../`), no `sourcesContent`, never served. `keel build` runs Vite with `NODE_ENV=production`, whatever the shell or `.env` sets: the entries' `mode` is `'production'` and `import.meta.env.DEV` is `false`. A thrown error's `diag` `frames` (k.server Log) are its first 5 stack positions in app code (E1576's), as `<path>:<line>:<col>` relative to the folder holding `artifacts`, a `server.mjs` position read through its map; without `artifacts`, none. `KEEL_FORMAT=json` makes the server log in json (docs/OUTPUT.md). `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (optional; `createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees: whoever holds it, or runs code in one deployable, can sign a caller every deployable accepts), `KEEL_PEER_<NAME>` (`my-api`: `KEEL_PEER_MY_API`), an http(s) URL, required per other `node` deployable, and `KEEL_DATABASE_URL` (Storage). A failure or unbindable `PORT` prints one E1560 naming the key, no value, and exits 1. Then it opens storage, serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits. `keel build --target`: k.shell.

**Assets.** Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` but `*.map`, and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag).

**Storage.** A `node` deployable's `storage` in `topology.ts` decides its `ctx.storage`, the only state that survives a restart:
- `'file'` (default): the file `--localstorage-file` names; one process.
- `'sqlite'`: a SQLite file, `KEEL_DATABASE_URL` a `file:` URL (default `file:/data/keel.sqlite`); processes on one host may share it, and a live stream sees only its own process's saves.
- `'postgres'`: `KEEL_DATABASE_URL` a `postgres:` or `postgresql:` URL (required); replicas share it, and a live stream on one sees the saves of each (k.persist Watch, std.channels).
`'sqlite'` and `'postgres'` are drivers (k.persist) of `@keel/std-db` (std.db; E1572); the generated entry imports the one named and `start` opens it before listening (a failure: std.db's E2152 or E2153, exit 1). The URL is a secret: no log line, diagnostic or generated file holds it.

**Deploy files.** Derived from `topology.ts` by `@keel/scaffold`, written by `keel build` and scaffold operations that change them; read-only (E1005, fix: the regenerated file).
- `deploy/<name>/Dockerfile` per `node` deployable: `node:22-slim` by digest, `dist/<name>/` only, user `node`, port 8080; `'file'`: volume `/data` for storage, owned by `node`, `--localstorage-file=/data/storage`; `'sqlite'`: that volume, no storage flag; `'postgres'`: no volume.
- `deploy/compose.yaml`: a service per `node` deployable and a volume per one with a volume, `KEEL_PEER_<NAME>` set to peers' service URLs, other `DeployEnv` keys from the environment, and `KEEL_POSTGRES_URL` from the environment, required, for one serving a module whose `deps` list `@keel/std-postgres`.
- `.github/workflows/ci.yml`: a job per deployable, run when its modules or shared config change: install, `keel check --base` the base branch's surface (k.compat; none there: W1568), `keel test`, `keel build`, an unpushed image build per `node` deployable; one `review` job on a pull request (k.review CI); shell jobs: k.shell.
- Shell files: k.shell.
`DeployEnv` values are set where the image runs, in no generated file.

**Rules.** E1560 `DeployEnv` fails, a port will not bind, or `'sqlite'` runs on a Node older than 22.13, at startup · E1555 production `assets` missing or entry-less (k.server) · E1572 a deployable's `storage` or `shells` needs a package the app's `dependencies` lack (fix adds it).

**Conformance.**
- `node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.
- With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
- A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the folder holding `artifacts`; none without `artifacts`.
- A loader throwing in `modules/a/a.server.ts` of a `keel build` fixture logs, from `node dist/<name>/server.mjs` in json, `frames` starting `modules/a/a.server.ts:`; `server.mjs.map` has no `sourcesContent`, and no response to `GET /server.mjs.map` contains its `mappings`.
- With `storage: 'postgres'`, `server.mjs` with `KEEL_DATABASE_URL` unset, or set to a `file:` URL, exits 1 with one E1560 naming `KEEL_DATABASE_URL` and no value.
- The Dockerfile of a `'sqlite'` deployable declares `/data` and runs `server.mjs` without `--localstorage-file`; of a `'postgres'` one declares no volume; `compose.yaml` passes `KEEL_DATABASE_URL` from the environment and holds no URL.
- `storage: 'sqlite'` without `@keel/std-db` in `dependencies` is one E1572 whose fix adds it; with it, none.
- `keel build` under `NODE_ENV=staging`, or with `NODE_ENV=development` in `.env`, builds an entry with `mode` `'production'` and no inspect reporter.
- With module `a` listing `@keel/std-postgres` in `deps`, served by `node` deployable `x` beside `y`, `deploy/compose.yaml` passes `KEEL_POSTGRES_URL` to `x` as a required value from the environment and to `y` not at all, and holds no URL.

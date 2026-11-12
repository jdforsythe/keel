# k.deploy: Production entry and deploy files
status: conformance-covered

**Build.** `keel build` writes `dist/<name>/` per `client` deployable (k.hosting) and `node` one: the client build (k.server), `routes.json` (all modules), `std.json`, and `server.mjs`, the generated entry, bundled. `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (optional; `createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees: whoever holds it, or runs code in one deployable, can sign a caller every deployable accepts), and `KEEL_PEER_<NAME>` (`my-api`: `KEEL_PEER_MY_API`), an http(s) URL, required per other `node` deployable. A failure or unbindable `PORT` prints one E1560 naming the key, no value, and exits 1. Then it serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits. `ctx.storage` is the file `--localstorage-file` names, the only state that survives a restart.

**Assets.** Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag).

**Deploy files.** Derived from `topology.ts` by `@keel/scaffold`, written by `keel build` and scaffold operations that change them; read-only (E1005, fix: the regenerated file).
- `deploy/<name>/Dockerfile` per `node` deployable: `node:22-slim` by digest, `dist/<name>/` only, user `node`, volume `/data` for storage, owned by `node`, port 8080.
- `deploy/compose.yaml`: a service and volume per `node` deployable, `KEEL_PEER_<NAME>` set to peers' service URLs, other `DeployEnv` keys from the environment.
- `.github/workflows/ci.yml`: a job per deployable, run when its modules or shared config change: install, `keel check --base` the base branch's surface (k.compat; none there: W1568), `keel test`, `keel build`, an unpushed image build per `node` deployable.
`DeployEnv` values are set where the image runs, in no generated file.

**Rules.** E1560 `DeployEnv` fails, or a port will not bind, at startup · E1555 production `assets` missing or entry-less (k.server).

**Conformance.**
- `node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.
- With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.

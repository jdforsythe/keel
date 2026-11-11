# k.topology: Deployables
status: implemented

**Declaration.** `topology.ts` default-exports `topology({ <name>: { modules, adapter } })` (`@keel/server`), read statically. Adapters: `node` (Hono; serves the resume entry), `static` (prerendered HTML), `client` (loaders, actions in the browser; entry `mount(App, el)`, real `ctx`). Each module, app or stdlib, is in one deployable; its routes, actions, live loaders and runners run there and no other file names a deployable, so moving modules between deployables (split or merge) edits `topology.ts` alone.

**Route table.** A deployable serves its modules' routes: the generated entry merges each module's `routes` into `createApp({ routes })`.

**Runners.** A module's background work is the `runners` export of `modules/<id>/runners.server.ts`: `Runner`s `{ run(ctx, signal): Promise<void> }` that stdlib packages build (std.jobs, std.schedules). `createApp({ runners: { [moduleId]: Runner[] } })` calls each `run` of the served deployable's modules once, after startup, with the app's `ctx`. A `run` that rejects before `signal` aborts is a `diag` on the log and runs again 1,000 ms later on `ctx.clock`. `app.close()` aborts each runner's `signal` and open event stream and resolves when every `run` has settled.

**Calls and peers.** A module calls another's routes through `service({ module })` (k.services), encoded and decoded alike in every topology: a split adds latency and `api.network`/`api.timeout` outcomes, never another value. `createApp({ peers: { [deployable]: URL | ServerApp } })` names the other `node` deployables: URLs in production, apps in one process. A `service({ module })` request is answered in process when its module is here or in an in-process peer, else by the peer's URL. A request for a path a peer serves (by `routes.json` in `artifacts`) is forwarded to it: method, path, search, headers but `host`, body; its response is returned unchanged; one carrying `x-keel-forwarded` is not forwarded again.

**Build.** `keel build` writes per `node` deployable `dist/<name>/`: the client build (k.server), `routes.json` (all modules), `std.json`, and `server.mjs`, the generated entry with every dependency bundled. `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (`createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees), and `KEEL_PEER_<NAME>` for each other `node` deployable. A failure prints one E1560 naming the key, never a value, and exits 1. Then it serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits. `ctx.storage` is the file `--localstorage-file` names, the only state that survives a restart.

**Deploy files.** Derived from `topology.ts` by `@keel/scaffold`, written by `keel build` and by scaffold operations that change modules or deployables; read-only (E1005, fix: the regenerated file).
- `deploy/<name>/Dockerfile` per `node` deployable: `node:22-slim` by digest, `dist/<name>/` only, user `node`, volume `/data` for storage, owned by `node`, port 8080.
- `deploy/compose.yaml`: a service and volume per `node` deployable, `KEEL_PEER_<NAME>` (`<NAME>`: the deployable's name upper-cased; service names are lower-cased) set to peers' service URLs, other `DeployEnv` keys from the environment.
- `.github/workflows/ci.yml` (outside the Keel repo): a job per deployable, run when its modules or shared config change: install, `keel check --base` the base branch's surface (k.compat), `keel test`, `keel build`, an unpushed image build per `node` deployable.
`DeployEnv` values are set where the image runs, never in a generated file.

**Local topology.** `keel dev` serves every deployable in one process on one origin: Vite serves `client` and `static` entries with HMR; each `node` deployable runs its dev `createApp` (real `ctx`, storage in `.keel-dev/`) and runners, the others its in-process peers, and serves its paths.

**Rules.** E1552 a topology module unknown or in two deployables · E1553 `static` deployable route with params or actions · E1559 one path in two deployables (names both routes) · E1560 the production environment fails `DeployEnv` (at startup).

**Conformance.**
- Fixture modules `a` (its loader calls `service({ module: 'b' })`) and `b` (a runner), served in one process as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under sim ctxs of one seed: a generated request script through `one` and through `x` gets equal statuses, bodies and final store states.
- `x` answers a path of `b` with `y`'s status, headers and body; one carrying `x-keel-forwarded` is not forwarded.
- With `a` and `b` in one deployable a `service({ module: 'b' })` call makes no `ctx.net.fetch`; with `y` at `http://y.test` it makes one, to that URL.
- `createApp({ runners })` runs each runner of the served deployable once, none of another; `close()` aborts their signals and resolves once each `run` settles; a rejected `run` runs again 1,000 ms later on the sim clock.
- `node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.
- With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.
- Two routes with path `/p` in modules of different deployables are one E1559.
- With `origin` `https://a.example`, a POST with that `Origin` to another host passes the same-site check, and the caller cookie is `__Host-keel-caller`.
- `keel dev` answers a `client` page and a path of each `node` deployable from one process on one origin.

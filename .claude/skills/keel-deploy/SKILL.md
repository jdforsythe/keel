---
name: keel-deploy
description: "Build and deploy Keel deployables: keel build, server.mjs, PORT/KEEL_SECRET/KEEL_ORIGIN/KEEL_PEER_<NAME>/KEEL_ALLOW_ORIGINS, keel dev, host, static client hosting, keel codemod place; E1560, E1565, E1566, E1578"
---

# Build and deploy

Spec: `pnpm spec k.hosting`, `k.deploy`, `k.topology`. Guide: `docs/guide/deploy-client.md`.

**Serve:** `keel build` writes `dist/<name>/server.mjs` and `server.mjs.map` per `node` deployable (no `server.ts`); run it with `PORT`, `KEEL_SECRET` (32+), `KEEL_ORIGIN`, `KEEL_PEER_<NAME>` (a bad value: E1560), `KEEL_FORMAT=json`. An uncaught throw or rejection logs E1577, drains up to 10 s and exits 1: run it under a supervisor. `keel dev` serves every deployable on one origin. A split edits `topology.ts` only (or `keel codemod place`).

**Identity:** every `node` deployable shares one `KEEL_SECRET`: it signs the caller cookie and the `x-keel-user` header a `service({ module })` call with `user` carries (60 s; bound to the request's body and the receiving deployable; `user` at most 256 characters); keep `KEEL_PEER_<NAME>` on `https`, since a header captured on the path replays its one request until it expires; each `server.mjs` runs the project's `identity.server.ts`. `caller: { days: 30 }` on a `node` deployable (1 to 400, else E1578) makes its caller cookie outlive a browser quit; it is classed `network` personal data. An `identify` that reads a header a proxy injects is safe only when the deployable is reachable through that proxy alone.

**Serve the client:** `keel build` writes `dist/<name>/` per `client` deployable (`index.html`, hashed `assets/`, `keel-mark.svg`). `host: '<node deployable>'` on the client deployable (`web: { modules, adapter: 'client', host: 'api' }`) copies it into that server, whose `GET /` then returns the app (a bad `host`: E1566). `keel build` always writes the production client (`NODE_ENV=production`). Only `keel dev` serves a dev client.

**Static host:** build with `KEEL_PEER_API=<origin>` (a `keel-peer` tag, an http(s) origin else E1565; `service({ module })` in a browser calls it with credentials), set `KEEL_ALLOW_ORIGINS` on the server, and keep both on one registrable domain so the caller cookie works (else W1567).

**Boundary:** `keel build` runs `keel check` first and stops on an error; a browser build (each worker too) still holding server code fails with E1007. No environment value is built in but `KEEL_PEER_<NAME>` and a shell's `KEEL_ORIGIN`; `import.meta.env` holds Vite's five keys (no `VITE_*`): browser config comes through `clientStd`. A `vite.config` with `envPrefix` or `define` fails with E1007 `environment config`; a `KEEL_*` value of 8+ characters in an emitted file, E1007 `environment value`.

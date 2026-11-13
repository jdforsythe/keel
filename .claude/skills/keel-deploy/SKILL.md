---
name: keel-deploy
description: "Build and deploy Keel deployables: keel build, server.mjs, PORT/KEEL_SECRET/KEEL_ORIGIN/KEEL_PEER_<NAME>/KEEL_ALLOW_ORIGINS, keel dev, host, static client hosting, keel codemod place; E1560, E1565, E1566"
---

# Build and deploy

Spec: `pnpm spec k.hosting`, `k.deploy`, `k.topology`. Guide: `docs/guide/deploy-client.md`.

**Serve:** `keel build` writes `dist/<name>/server.mjs` and `server.mjs.map` (positions, no source text, never served) per `node` deployable (no `server.ts`); run it with `PORT`, `KEEL_SECRET` (32+), `KEEL_ORIGIN`, `KEEL_PEER_<NAME>` (a bad value: E1560), `KEEL_FORMAT=json` (json logs). `keel dev` serves every deployable on one origin. A split edits `topology.ts` only (or `keel codemod place <module> --to <deployable>`).

**Serve the client:** `keel build` writes `dist/<name>/` per `client` deployable (`index.html`, hashed `assets/`, `keel-mark.svg`). `host: '<node deployable>'` on the client deployable (`topology({ web: { modules, adapter: 'client', host: 'api' }, api: { modules, adapter: 'node' } })`) copies it into that server, whose `GET /` then returns the app (a bad `host`: E1566).

**Static host:** build with `KEEL_PEER_API=<origin>` (a `keel-peer` tag, an http(s) origin else E1565; `service({ module })` in a browser calls it with credentials), set `KEEL_ALLOW_ORIGINS` on the server, and keep both on one registrable domain so the caller cookie works (else W1567).

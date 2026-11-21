---
name: keel-deploy
description: "Build and deploy Keel deployables: keel build, server.mjs, PORT/KEEL_SECRET/KEEL_ORIGIN/KEEL_PEER_<NAME>/KEEL_ALLOW_ORIGINS, keel dev, host, static client hosting, keel codemod place, native shells and keel build --target; E1560, E1565, E1566, E1573, E1574, E1575, E1578, E1590, E1591"
---

# Build and deploy

Exact rules: `keel docs k.deploy`, `k.hosting`, `k.topology`, `k.shell`, `k.user`. A code's section: `keel docs --for <code>`.

**Topology.** `topology.ts` default-exports `topology({ <name>: { modules, adapter } })`. Adapters: `node`, `static`, `client`. A module lives in one deployable; moving it edits `topology.ts` alone, or run `keel codemod place <module> --to <deployable> [--adapter node]`, which also regenerates the deploy files.

```ts
import { topology } from '@keel/server';

export default topology({
  web: {
    modules: ['todos'],
    adapter: 'client',
    host: 'api',
    shells: { tauri: { id: 'dev.acme.todos', name: 'Todos' } },
  },
  api: {
    modules: ['api', 'sessions'],
    adapter: 'node',
    storage: 'sqlite',
    caller: { days: 30 },
  },
});
```

**Origins.** A deployable may set `origins: { img?, media?, font?, connect?, frame? }`, each an origin-to-reason map (exact https origin, at most 16 per directive; E1590, E1591). The declared origins reach the document policy, `csp.txt`, a hosted client's `index.html` and the shells' policies.

**Build.** `keel build` runs `keel check` first and stops on an error. It writes `dist/<name>/` per deployable: `server.mjs` and `server.mjs.map` for a `node` one, `index.html`, hashed `assets/` and `keel-mark.svg` for a `client` one. It always builds for production (`NODE_ENV=production`, whatever the shell or `.env` says). It also writes the read-only `deploy/<name>/Dockerfile`, `deploy/compose.yaml` and the CI workflow; edit `topology.ts` instead (E1005).

**Run `server.mjs`.** `node dist/<name>/server.mjs` reads these variables:
- `PORT` (default 8080).
- `KEEL_SECRET`, 32 bytes or more, the same in every `node` deployable of the app: it signs the caller cookie and the `x-keel-user` header of a `service({ module })` call. Whoever holds it can sign a caller every deployable accepts.
- `KEEL_ORIGIN`, the public origin (optional).
- `KEEL_PEER_<NAME>`, an http(s) URL per other `node` deployable (`my-api` is `KEEL_PEER_MY_API`). Use `https`: a captured `x-keel-user` header replays its one request until it expires (60 s).
- `KEEL_DATABASE_URL`, for `storage: 'sqlite'` or `'postgres'` (needs `@keel/std-db` in `dependencies`: E1572).
- `KEEL_FORMAT=json` logs json.
A bad value is one E1560 naming the key, never the value, and exit 1. An uncaught throw or rejection logs E1577, drains up to 10 s and exits 1: run it under a supervisor. `keel dev` serves every deployable on one origin.

**Caller lifetime.** `caller: { days }` on a `node` deployable (an integer 1 to 400, else E1578) makes its caller cookie outlive a browser quit. It is network personal data. An `identify` that trusts a header a proxy injects is safe only when the deployable is reachable through that proxy alone.

**Serve the client from a node deployable.** `host: '<node deployable>'` on the `client` deployable copies its build into `dist/<host>/`, and the host's `GET /` returns the app. `host` must be a string literal naming a `node` deployable, one client per host (else E1566).

**Host the client on a static host.** Build with `KEEL_PEER_API=<origin>`: `index.html` gets a `keel-peer` tag, and `service({ module })` in the browser calls that origin with credentials. A value that is not an http(s) origin fails the build (E1565). On the server set `KEEL_ALLOW_ORIGINS` to the client's origins, comma-separated (never `*`: E1560). Keep both on one registrable domain so the caller cookie works (else W1567). The static host returns `/index.html` with 200 for a path that is no file.

**Boundary.** A browser build that still holds server code (each worker too) fails with E1007. Browser config reaches the page through `clientStd`; `import.meta.env` has only BASE_URL, MODE, DEV, PROD and SSR, typed by `@keel/compiler/client` (in the scaffold's `tsconfig.json` `types`; no `vite/client` reference needed). A `vite.config` with `envPrefix` or `define` fails with E1007, and so does a `KEEL_*` value of 8 or more characters in an emitted file. Only `KEEL_PEER_<NAME>` and a shell's `KEEL_ORIGIN` are built in.

**Shells.** `shells: { tauri | capacitor: { id, name } }` on a `client` deployable; `id` is reverse-DNS (else E1573, as is `shells` on another adapter). The shell package (`@keel/std-tauri`, `@keel/std-capacitor`) goes in `dependencies` (E1572). Build with `KEEL_ORIGIN=https://app.acme.dev keel build --target tauri`, or `--target capacitor --platform android|ios`; add `--release` for an unsigned release. `KEEL_ORIGIN` must be `https:` outside `localhost` (E1574). A missing or old toolchain is E1575 (JDK 21 with the Android SDK, Xcode 26, Rust 1.95, WebKitGTK 4.1 on Linux). `--platform` without capacitor, or a target no client declares, is E1052. The shell files under `deploy/<name>/` are generated; the app's own `icons/icon.png` and `Cargo.lock` are not. Signing and store upload are not Keel's. With an `identity.ts`, a Capacitor app installs `@capacitor/app` and `@capacitor/browser` into its own `dependencies`, beside `@capacitor/core`, at the versions `@keel/std-capacitor` uses: `cap sync` adds a native plugin only from there.

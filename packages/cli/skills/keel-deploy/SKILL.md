---
name: keel-deploy
description: "Build and deploy Keel deployables: keel build, server.mjs, PORT/KEEL_SECRET/KEEL_ORIGIN/KEEL_PEER_<NAME>/KEEL_ALLOW_ORIGINS, keel dev, servedBy, static client hosting, keel codemod place, native shells and keel build --target; E1014, E1167, E1560, E1565, E1566, E1573, E1574, E1575, E1578, E1587, E1588, E1589, E1590, E1591, E1592, W1012"
---

# Build and deploy

Rules: `keel docs deploy` lists `k.deploy` `k.hosting` `k.topology` `k.shell` `k.user`; `keel docs --for <code>` finds one.

**Topology.** `topology.ts` default-exports `topology({ <name>: { modules, adapter } })`. Adapters: `node`, `static`, `client`. A module lives in one deployable; move it by editing `topology.ts` or with `keel codemod place <module> --to <deployable> [--adapter node]`, which regenerates the deploy files too.

```ts
import { topology } from '@keel/server';

export default topology({
  web: { modules: ['todos'], adapter: 'client', servedBy: 'api', styles: ['@keel/ui/fonts'],
    shells: { tauri: { id: 'dev.acme.todos', name: 'Todos' } } },
  api: { modules: ['api', 'sessions'], adapter: 'node', storage: 'sqlite', styles: ['@keel/ui/fonts'],
    caller: { days: 30 } },
});
```

**Styles.** `styles: ['<package specifier>']` on a deployable lists `.css` package exports; its entry imports each, so every document links them on every adapter, dev and build. App code imports no `.css` (E1825). A non-literal or relative entry, or an export that is not `.css`, is E1587. Keel writes every document: a project `index.html` is never read (W1012: move its markup to a layout component, its stylesheets to `styles`).

**Origins.** A deployable may set `origins: { img?, media?, font?, connect?, frame? }`, each an origin-to-reason map (exact https origins, 16 at most per directive; E1590, E1591). The declared origins reach the document policy, `csp.txt`, a hosted client's `index.html` and the shells' policies. A browser calls a `connect` origin with `service({ base })`; it sends `x-keel: 1`, so the API's CORS preflight must allow that header.

**Build.** `keel build` runs `keel check` first and stops on an error. It writes `dist/<name>/` per deployable: `server.mjs` and `server.mjs.map` for a `node` one, `index.html` (generated), hashed `assets/`, `keel-mark.svg` and `csp.txt` for a `client` one, and for a `static` one per route its document (`index.html` for `/`, `<path>/index.html` otherwise), `404.html`, `assets/`, `keel-mark.svg` and `csp.txt`. It always builds for production (`NODE_ENV=production`). E1006 fails it. `dist/<name>/` holds the served modules' `migrations/`. It writes the read-only `deploy/<name>/Dockerfile`, `deploy/compose.yaml` and the CI workflow; edit `topology.ts` instead (E1005).

**Run `server.mjs`.** `node dist/<name>/server.mjs` reads these variables. A deployable with `storage: 'file'` (the default) also needs `--experimental-webstorage --localstorage-file=<path>` (else a page naming `stores` is a 500; the generated Dockerfile passes them); `'sqlite'`, `'postgres'` need none.
- `PORT` (default 8080).
- `KEEL_SECRET`, 32 bytes or more, the same in each `node` deployable of the app: it signs the caller cookie and the `x-keel-user` header of a `service({ contract })` call. Whoever holds it can sign a caller every deployable accepts.
- `KEEL_ORIGIN`, the public origin, optional.
- `KEEL_PEER_<NAME>`, an http(s) URL per other `node` deployable (`my-api` is `KEEL_PEER_MY_API`). Use `https`: a captured `x-keel-user` header replays its request until it expires (60 s).
- `KEEL_DATABASE_URL`, for `storage: 'sqlite'` or `'postgres'` (needs `@keel/std-db` in `dependencies`: E1572).
- Each name in the `env` of a served module's manifest or of a library it lists (`KEEL_POSTGRES_URL` for `@keel/std-postgres`); compose requires it. A name outside `[A-Z][A-Z0-9_]*`, a key above or a `KEEL_PEER_` name is E1167.
- Files a bundled package reads through `new URL('<path>', import.meta.url)` are copied beside `server.mjs`; a missing one, one outside its package or a computed name is E1014.
- `KEEL_FORMAT=json` logs json.
A bad value is E1560 naming the key, never the value; exit 1. Write no start or not-found script: an unmatched path is a 404 document with the `keel.notFound` alert (a `servedBy` client's `index.html` for a document path), a loader's `err({ code: 'keel.notFound' })` a 404 with its `errorElement`. An uncaught throw or rejection logs E1577, drains up to 10 s and exits 1: run it under a supervisor. `keel dev` serves every deployable on one origin. `KEEL_DEV_POLL=1` makes `keel dev` poll for file changes (containers, network file systems, dropped events); unset, empty or `0` leaves the watcher to `vite.config.ts`; another value is E1560.

**Test the built app.** `serve()` (`@keel/testing/e2e`) starts each deployable as above (free ports, one secret, peers, fresh storage); `env` adds the rest (else E1737).

```ts
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("sends its policy", async () => {
  const res = await (await serve({ env: { PAYMENTS_URL: "http://127.0.0.1" } })).fetch("/");
  expect(res.headers.get("content-security-policy")).toContain("script-src");
});
```

**Caller lifetime.** `caller: { days }` on a `node` deployable (an integer 1 to 400, else E1578) makes its caller cookie outlive a browser quit. It is network personal data. An `identify` that trusts a header a proxy injects is safe only when that proxy is the deployable's one way in.

**Serve the client from a node deployable.** `servedBy: '<node deployable>'` on the `client` deployable copies its build into `dist/<servedBy>/`, whose `GET /` returns the app. It is a string literal naming a `node` deployable, one client each (else E1566). With `identity.ts` a `client` deployable needs it (E1589); `identity.server.ts` importing the `routes` of a `static` or unserved `client` deployable is E1592.

**Host the client on a static host.** The host sends `csp.txt` as the policy header; with no `node` deployable, that is all. To call one, build with `KEEL_PEER_API=<origin>`: `index.html` gets a `keel-peer` tag, and the browser's `service({ contract })` calls that origin with credentials. A value that is not an http(s) origin fails the build (E1565). On the server set `KEEL_ALLOW_ORIGINS` to the client's origins, comma-separated (never `*`: E1560). Keep both on one registrable domain for the caller cookie (else W1567). The static host returns `/index.html` with 200 for a path that is no file.

**Host a static deployable.** A `static` deployable prerenders each route (one path; a param or action route is E1553) from its own `createApp` at build, caller `''`, memory storage: loader data is fixed at build. A route whose build GET is not 200 (a denying guard, a loader `err`, a throw) is E1588. The host returns `<path>/index.html` for `<path>`, and `404.html` with 404 for a path that is no file (no `/index.html` fallback); `assets/*` is `immutable`, the rest `no-cache`; send `csp.txt` as the policy header. `keel scaffold project <name> --adapter static` makes one; `keel dev` serves it like a `node` one.

**Boundary.** A browser build that still holds server code (each worker too) is E1007. Browser config reaches the page through `clientStd`; `import.meta.env` has only BASE_URL, MODE, DEV, PROD and SSR, typed by `@keel/compiler/client` alone; a type reference or other `import.meta` declaration (`vite/client`) is E1016. A `vite.config` with `envPrefix` or `define` is E1007, as is a `KEEL_*` value of 8 or more characters in an emitted file. Only `KEEL_PEER_<NAME>` and a shell's `KEEL_ORIGIN` are built in.

**Shells.** `keel scaffold shell tauri|capacitor --id <reverse-dns> [--name] [--to <client>]` declares `shells: { <shell>: { id, name } }` on the `client` deployable and adds the std package, plugins, CLI and platform packages; then install (until then E1159) and `keel build` (until then E1005). A bad `id` is E1573, as is `shells` on another adapter; no one `client` deployable, E1359. Build with `keel build --target tauri`, or `--target capacitor --platform android|ios`; `--release` builds an unsigned release. Set `KEEL_ORIGIN` (`https:` outside `localhost`) only with a `node` deployable (E1574). `--platform` the shell's target does not take, or a target no client declares, is E1052. The std packages provide the targets (`@keel/std-<shell>/tools`; E1585 if none). A missing or old tool is E1575 (`<tool> missing or too old: needs <need>`: JDK 21 with the Android SDK, Xcode 26, Rust 1.95, WebKitGTK 4.1 on Linux). The shell files under `deploy/<name>/` are generated; the app's own `icons/icon.png` and `Cargo.lock` are not. A shell sends only to `KEEL_ORIGIN`, the build's peers and declared `connect` origins; any other is `api.network`.

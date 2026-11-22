# RFC 0179: k.hosting, k.topology: what `keel build` writes for a `static` deployable

Status: accepted (ADR-0201). For backlog 1024.

## Decisions
- D1: `keel build` writes `dist/<name>/` per `static` deployable. For each of its routes it writes the document that deployable's own `createApp` answers to a GET of the route's path at build time: `index.html` for `/`, `<path>/index.html` for any other path. The build also writes `404.html` (the not-found document), `assets/` (content-hashed, with the resume entry of the deployable's islands), `keel-mark.svg` and `csp.txt` (k.security). Nothing of a `static` deployable lands in `dist/` itself.
- D2: the build render is a node document render, the same code that answers a `node` page: production mode, a real `ctx` with memory storage, caller `''`. Loaders run at build, so what a page shows is fixed when it is built. The islands in it resume in the browser as a `node` page's do (k.resume), and each document carries the `keel-peer` tags as a client's `index.html` does.
- D3: routes that need a server. A route with params or an action is E1553 already, and a loader or action naming `stores`, or a live loader, is E1558 already, so every `static` route has one path and needs no request state. A route whose build GET answers other than 200 fails the build with E1588, naming the route id and the status. That covers a guard that denies or redirects caller `''`, a loader `err`, and a throw. The rejected alternative is writing that answer's document (a 404 or 403 page served with 200 by a file host).
- D4: hosting (k.hosting Static). A static host returns `<path>/index.html` for `<path>` and `404.html` with 404 for a path that is no file. There is no `/index.html` fallback, since a `static` deployable has no client router to resolve an unknown path. `assets/*` is cached as immutable and the rest `no-cache`, as for `client`.
- D5: `viteTargets` (`@keel/cli`) runs one build per `static` deployable by name, as for `client`. The project's own build (no `KEEL_DEPLOYABLE`) no longer serves a `static` deployable. A topology whose deployables are all `static` builds, as it does since a6bfbbd3.
- D6: `keel dev` renders a `static` deployable's paths through its dev `createApp` as it does a `node` one's (k.topology Local topology), so dev and build serve one document (RFC 0182).
- D7: `examples/static-client` stays a `client` deployable. That is a client app hosted as files, with loaders in the browser (k.router Execution), and it is a different shape from a `static` site. `keel scaffold project <name> --adapter static` writes the adapter it is given, and its build then yields the artifact of D1.
- D8: k.hosting and k.topology go from `conformance-covered` to `implemented` until their three new clauses, in the ledger at `none`, are covered. k.deploy gains one phrase and no clause, so its status stays. Nothing becomes `frozen`.

## Problem
k.topology declares the `static` adapter as "prerendered HTML", and k.scaffold writes it for `--adapter static`. k.security has `keel build` write `dist/<name>/csp.txt` for a `static` deployable. No section states the rest of the artifact: k.deploy Build lists `dist/<name>/` per `client` and `node` deployable only, and k.hosting covers `client` alone.

What the build does now:
- `viteTargets` (`packages/cli/src/internal/viteTargets.ts`) gives a `static` deployable no build of its own. The project's own build serves it (`deployable()` and `page()` in `packages/compiler/src/vite.ts`) and writes a default `index.html` when the project has none.
- `writeCspFiles` writes `dist/<name>/csp.txt`, while the page and its assets land in the own build's `dist/`, so the policy and the files it covers sit in different folders.
- Nothing prerenders. A non-`client` deployable gets the resume entry, and the shipped `index.html` holds an empty `#app` and a resume entry with no islands to resume, so the page is blank.

## Proposal
- k.hosting gains a **Static** paragraph (D1 to D4), the Purpose line names `static`, and Rules gain E1588.
- k.deploy Build: "per `client` deployable (k.hosting) and `node` one" becomes "per `client` and `static` deployable (k.hosting) and `node` one".
- k.topology Declaration: `static` (prerendered HTML per route, k.hosting Static). Local topology: Vite serves `client` entries with HMR; each `node` and `static` deployable runs its dev `createApp`.

For an app author: `keel build` of a `static` site gives `dist/<name>/`, a folder to upload, and each page shows its content before any script runs.

## Alternatives
- **`--adapter static` writes a `client` deployable** (the shape `examples/static-client` uses). Rejected: k.scaffold writes the adapter it is given, and the `static` adapter would stay undelivered.
- **Drop the `static` adapter until prerendering exists.** Rejected: a kernel feature cut.
- **A `client` build with an `index.html` fallback, prerendered only for `/`.** Rejected: every other path would be blank until scripts run, and a static page has no router to fill it.
- **Write the document of a non-200 answer.** Rejected (D3): a file host serves it with 200.
- **Render with the client router at build (string render of the router app).** Rejected: a second document renderer beside the server's, with its own head and `#k-state` rules.

## Spec diff
Applied in this commit:
- **k.hosting** (status `implemented`, D8): Purpose names `static`; new paragraph Static; Rules gain E1588. Conformance gains clauses 8 and 9.
- **k.topology** (status `implemented`): Declaration's `static` names k.hosting Static; Local topology renders `static` paths through the dev `createApp`. Conformance gains clause 11.
- **k.deploy**: Build names `static` (no clause; status unchanged).
- **Map**: the k.hosting and k.topology rows read `implemented`.
- **Ledger**: `k.hosting#8`, `k.hosting#9` and `k.topology#11` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0179`, from the spec text alone, where k.hosting's build cases live (`packages/cli/conformance/` or `packages/compiler/conformance/`):
- k.hosting 8: `keel build` of a fixture whose topology is one `static` deployable `site` over a module with routes `/` and `/about`, each loader returning a text, exits 0. It writes `dist/site/index.html` and `dist/site/about/index.html` holding those texts, `dist/site/404.html`, `dist/site/csp.txt` and the files under `dist/site/assets/` that those documents script, and no `dist/index.html`.
- k.hosting 9: the same fixture with a route whose loader returns `err` `keel.notFound` exits 1 with one E1588 naming that route id and 404.
- k.topology 11: `keel dev` answers a `static` deployable's route with the document its `createApp` renders, holding its loader's text.
The `--adapter static` scaffold build case is already being written under k.scaffold.
Spec topics: `pnpm spec k.hosting`, `pnpm spec k.topology`, `pnpm spec k.deploy`; for context `pnpm spec k.security`, `pnpm spec k.resume`, `pnpm spec k.head`.

## Build
- `@keel/cli`: `viteTargets` builds each `static` deployable by name; after the Vite builds, a prerender step imports the deployable's server build, makes its `createApp`, GETs each route path and the not-found path, and writes the files, or E1588.
- `@keel/compiler`: a `static` deployable gets a server bundle (as `node` does, not shipped) and the resume entry; the own build stops serving it; the dev middleware serves `static` deployables' paths.
- Docs: the keel-deploy skill (static hosting), the scaffold's `--adapter static` README text.

## Known limits
- A page's data is fixed at build; a change needs a rebuild.
- A route with params is E1553, so a static site has one page per declared path, with no generated paths from data.

## Migration
None: unreleased.

## Token impact
k.hosting 4,679 to 5,931 characters; k.topology 5,998 to 6,137; k.deploy +12. No budget moves.

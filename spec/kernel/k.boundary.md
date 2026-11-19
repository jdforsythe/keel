# k.boundary: The server boundary
status: conformance-covered

Which code reaches a browser, decided by the deployable that lists the code's module (k.topology); with no `topology.ts` (tests, `renderRoute`), as on `node`.

**Server-only.** A server-only file is a file named `*.server.*` or `*.guard.*`, in the app or a package, unless its module is one only `client` deployables list (a file under `modules/<id>/` is module `<id>`'s, a stdlib package's file its module's; a file outside every module is server-only). In a module a `node` or `static` deployable lists, loaders and actions (E1551) and guards (E1009) live in server-only files and run only on the server or at build; no byte of a server-only file, nor of what only server-only files import, is in an asset served to a browser. In a module only `client` deployables list nothing is server-only: its `*.server.*` and `*.guard.*` files hold the loaders, actions and guards the browser runs (k.router), are browser files (k.host) and ship like any other.

**Browser builds.** Every browser build the Vite plugin runs (a `node` deployable's client build, a `client` deployable's, a shell's, the project's own) resolves an import of a server-only file, without a query, to a stub: the file's export names (`export *` followed), each a function that throws an Error with code E1008 `<name> of <file> runs only on the server` when called, and no import but the router's. The file's code, imports and top-level statements are never evaluated in a browser. `manifest` and `routes.actions` accept a stub wherever a loader, action or guard goes and skip its checks, which ran when the build evaluated `routes.ts` in Node (k.compiler), so a page importing its module's `routes.ts` keeps `routes.href`, typed params and search, `Link`, `navigate`, `Form` and `matchHref`. `node:sqlite` is mapped in the server build only.

**Assertion.** After bundling, a browser build fails with E1007, writes nothing for its deployable and exits 1 when its graph from any entry, dynamic imports and emitted files included, holds a server-only file (any query), a Node built-in (`node:` or a name Node lists), or a file calling `loader`, `action` or `guard` from `@keel/router`, unless the build is a `client` deployable's and the file's module one it lists. Message: `server code in browser build: <reason>: <entry> -> <a> -> <file>`, each step a project-relative path or package specifier. It holds when an import gets around the stubs.

**Environment.** No environment value is in a file `keel build` writes, but the origins `KEEL_PEER_<NAME>` (k.hosting) and, in a shell build, `KEEL_ORIGIN` (k.shell). A browser build's `import.meta.env` holds only `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL`, exposing no variable by prefix (`VITE_*` too); `process.env.<x>` is never replaced by a value but `NODE_ENV` (k.deploy). Config a browser reads comes through `clientStd` (k.leave).

**Reach.** Client-reachable code (E1004, so E1107 and E1571), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); a file of a `client` module, for imports of another module's server-only files; and a project file outside `node_modules/` a client entry reaches by value imports, re-exports and literal `import()`, not through a server-only file. Client entries: each route `component` of a `node` or `static` module and every file of a `client` one. No `topology.ts`: every file but server-only ones. A `routes.ts` may import server-only files by value; a specifier with a query names its file; package imports are not followed (E1007 covers them). An E1004 found through a chain ends `(<entry> -> … -> <file>)`.

**Build gate.** `keel build` runs `keel check` first; an error ends it with exit 1 and nothing written, a warning does not. `vite build` alone runs no check; the stubs and E1007 still hold.

**Limits.** A value in a file that is not server-only ships when a browser file imports it: a secret hard-coded in a schema, a `routes.ts` or a shared helper is public. A `routes.ts` a page imports runs in the browser; only its server-only imports are stubbed. A `define` in the project's `vite.config` is the project's.

**Rules.** E1007 server code in a browser build (names the chain) · E1008 a stub of a server-only export called · E1009 `guard` from `@keel/router` called outside a `*.guard.*` or `*.server.*` file (fix: none).

**Conformance.**
- In a `node` fixture, canaries in a `*.server.ts` loader, an action, a `*.guard.ts` guard, a module two imports past the loader and a `*.server.ts` top-level statement are in no file under `dist/<name>/assets/`; the resumed page's `Link` and `Form` carry `routes.href` with typed params, and a post runs the action.
- A `client` deployable it hosts ships its own `*.server.ts` loader and none of those canaries; a `static` fixture's browser build ships none of its own.
- A page importing `./x.server.ts?raw` or `?url`, a plain file calling `loader`, or one importing `node:path` fails `vite build` with one E1007 naming the chain; `keel build` stops at `keel check`.
- Each export of a stubbed file is a function throwing E1008 that names it; `manifest` and `routes.actions` take stubs.
- No environment value set for a build (`KEEL_SECRET`, `VITE_*`, others but those origins) is in a file under `dist/`.
- A route component reaching `lib/keys.server.ts` through `lib/fmt.ts` is one E1004 at `lib/fmt.ts` naming the chain, and a literal-origin `ctx.net.fetch` in `lib/fmt.ts` is E1571; none for a type-only import, a schema both sides import, a `routes.ts` value import, or a file only server-only files import.
- In a `client` module `process.env.X` in `load.server.ts` is E1759; in a `node` module's `a.guard.ts` it is not; `guard(...)` in `modules/a/auth.ts` is E1009.
- For generated import graphs, E1004 is reported exactly when a route component reaches a server-only file by value imports through no server-only file or `routes.ts`.

---
"@keel/compiler": minor
"@keel/router": minor
"@keel/check": minor
"@keel/cli": minor
---

Server-only files (`*.server.*` and `*.guard.*` of a module a `node` or `static` deployable lists, or outside every module) never reach a browser. Every browser build resolves them to stubs that throw E1008 when called, and fails with E1007, naming the import chain, when its graph still holds a server-only file, a Node built-in or another module's handler. `manifest` and `routes.actions` accept stubs, so a page keeps `routes.href`, `Link` and `Form` with `routes.ts` unchanged. E1004 follows imports from each route component and names the chain; E1571 shares that reach; E1759 reads a `client` module's handler files as browser files; E1009 reports a `guard` outside a `*.guard.*` or `*.server.*` file. `keel build` runs `keel check` first and stops on an error. A browser build exposes no environment variable through `import.meta.env`, `VITE_*` included.

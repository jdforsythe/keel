# ADR-0162: the server boundary (RFC 0140)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** ADR-0006 put the `.server.ts` boundary at compile time, but nothing enforces it. A `node` deployable's client build bundles each page, a page imports its module's `routes.ts` for `routes.href`, and `routes.ts` names every loader, action and guard, so their files and imports ship to the browser. The Vite plugin has no stub and maps `node:sqlite` in the client build too; the build succeeds silently. E1004 checks direct imports only and exempts `routes.ts`; E1759 skips `*.server.*` files, which on a `client` deployable run in the browser; `keel build` never runs `@keel/check`'s rules. No environment value has shipped, by Vite's defaults rather than by rule.

**Decision.**
- C1: server-only is read from placement: a `*.server.*` or `*.guard.*` file of a module a `node` or `static` deployable lists, or outside every module. Nothing is server-only in a module only `client` deployables list; its handler files run in the browser and are browser files (E1759). No `topology.ts`: `node`'s rules.
- C2: every browser build resolves a server-only import to a stub: the file's export names, each a branded function that throws E1008 when called, importing nothing else; top-level code never runs in a browser. `manifest` and `routes.actions` accept stubs, so `routes.href`, typed params, `Link`, `Form` and `matchHref` keep working with `routes.ts` unchanged.
- C3: after bundling, a browser build holding a server-only file (any query), a Node built-in, or a handler call outside its own `client` modules fails with E1007 naming the import chain. The stubs are the means; E1007 is the guarantee.
- C4: E1004 follows the graph from route components and from `client` modules' cross-module imports, names the chain, and treats a query specifier as its file; `routes.ts` may import server-only files. E1009 puts guards in `*.guard.*` or `*.server.*` files.
- C5: `keel build` runs `keel check` first and stops on any error.
- C6: no environment value is in a built file except the public origins `KEEL_PEER_<NAME>` and a shell's `KEEL_ORIGIN`; `import.meta.env` holds Vite's five built-in keys only; browser config comes through `clientStd`.
- The contract lives in a new section, k.boundary; the k.compiler E1004 sentence, the k.host browser-file sentence and the threat model change with the build.

**Alternatives.** An error or a new suffix for `.server.ts` on `client` deployables (a module could not move between adapters with `topology.ts` alone). A compiler-emitted handler-free routes manifest (a second form of every `routes.ts`). Inert `undefined` exports (`routes.actions` throws at page load; a mistaken call has no code). Package export conditions (miss app files). Scanning emitted text (nothing to scan for). Check-only enforcement (`vite build` runs no check, the check skips packages). A separate code for transitive hits (E1107 and E1571 would not follow). Stopping the build on boundary codes only (two meanings of clean). A public environment prefix (a second config path; inlining by name ships secrets by mistake).

**Consequences.**
- A `node` deployable's browser assets hold no loader, action, guard or server-only import; golden-2 and the `sessions` app shrink with no app change.
- std-sessions and std-health rename their handler files to `*.server.ts`; any stdlib package that misnames one fails the build that reaches it.
- `keel build` is as strict as `keel check`, and a little slower.
- A secret hard-coded in a file that is not server-only still ships; the threat model says so.

# ADR-0196: k.bundle, k.hosting: the client's service map names the modules it imports (RFC 0174)

**Status:** accepted (the orchestrator under the RFC defaults, 1: the spec is the contract).

**Context.** The client entry embedded every `node` deployable's module names in the browser build. Trimming the map to what the client imports leaves a gap: a server module reached by a path the scan does not follow gets no target, and its calls go to `http://<module>.keel.invalid`.

**Decision.** The entry maps the app modules of `node` and `static` deployables that browser code imports by relative path, plus stdlib modules, and reads the `keel-peer` tags whenever the topology has a `node` deployable. E1011 fails the client build when a bundled file belongs to an app module of such a deployable that the map omits, naming the module and the importer. The scan reads relative specifiers only; an alias, a package name or a computed import ends in E1011.

**Alternatives.**
- Map every `node` module: ships names the client never uses.
- Map from the bundler's graph: the entry is generated first.
- Warn: the page is broken at run time.

**Consequences.** The browser build holds no other server module's name. A client that reaches a server module by a non-relative import fails the build until it uses a relative import.

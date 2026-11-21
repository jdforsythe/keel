# ADR-0201: k.hosting, k.topology: what `keel build` writes for a `static` deployable (RFC 0179)

**Status:** accepted (orchestrator, under the RFC defaults; for the operator to confirm).

**Context.** k.topology calls a `static` deployable "prerendered HTML", but no section states its artifact. `keel build` writes a blank page through the project's own build into `dist/`, while its `csp.txt` lands in `dist/<name>/`.

**Decision.** `keel build` writes `dist/<name>/` per `static` deployable: one document per route, rendered at build by the deployable's own `createApp` (production, real `ctx`, memory storage, caller `''`), at `index.html` or `<path>/index.html`, plus `404.html`, `assets/` with the islands' resume entry, `keel-mark.svg` and `csp.txt`. A route answering other than 200 at build is E1588. A host serves `404.html` with 404 for unknown paths, with no `index.html` fallback. `keel dev` renders `static` paths through the dev `createApp`.

**Alternatives.** Scaffolding `static` as `client` (the adapter stays undelivered); dropping `static` (a feature cut); a client build prerendering `/` only (other paths blank); writing a non-200 answer's document (served as 200); a second, router-based renderer.

**Consequences.** A static site is one folder of rendered pages that resume their islands. k.hosting and k.topology read `implemented` until three new clauses are covered. New code E1588.

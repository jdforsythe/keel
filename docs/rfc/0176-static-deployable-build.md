# RFC 0176: k.deploy: what `keel build` writes for a `static` deployable

Status: draft.

## Problem
k.topology declares the `static` adapter as "prerendered HTML", and k.scaffold writes it verbatim for `keel scaffold project <name> --adapter static`. k.security has `keel build` write `dist/<name>/csp.txt` for a `static` deployable, and k.boundary speaks of a `static` fixture's browser build. No section states the rest of the artifact: k.deploy Build lists `dist/<name>/` per `client` and `node` deployable only, and k.hosting covers `client` alone.

The build works as follows:
- `keel build` runs the project's own Vite build (no `KEEL_DEPLOYABLE`) when a deployable is `static`. It writes to `dist/`, while `csp.txt` goes to `dist/<name>/`, so the policy and the files it covers sit in different folders.
- The own build of a topology whose only deployables are `static` serves the first one's resume entry, and writes a default `index.html` when the project has none.
- Nothing prerenders. The shipped `index.html` holds an empty `#app` and a resume entry with no islands to resume, so the page is blank.

## Proposal
- k.deploy Build: `keel build` writes `dist/<name>/` per `static` deployable: one `index.html` per route path, rendered at build time with the route's loader (k.render), its islands' resume entry, `assets/` (content-hashed) and `keel-mark.svg`; `csp.txt` beside them. A static host serves it as k.hosting Artifact says, with no `/index.html` fallback for an unknown path (404).
- k.topology Declaration: a topology may hold only `static` deployables.
- The own build no longer serves a `static` deployable; `viteTargets` runs one build per `static` deployable by name, as it does for `client`.

## Alternatives
- `--adapter static` writes a `client` deployable (the shape `examples/static-client` uses): a client app hosted statically. Rejected: k.scaffold writes the adapter it is given, and the `static` adapter stays undelivered.
- Drop the `static` adapter until prerendering exists. Rejected without the operator: a kernel feature cut.

## Spec diff
- k.deploy Build: "per `client` deployable (k.hosting) and `node` one" becomes "per `client` deployable (k.hosting), `static` one (prerendered pages) and `node` one".
- k.topology Declaration: `static` (prerendered HTML, one page per route path at build time).

## Conformance diff
- k.deploy: `keel build` of a fixture whose topology is one `static` deployable over a module with a route `/` and a route `/about` exits 0 and writes `dist/<name>/index.html` and `dist/<name>/about/index.html`, each holding the route's rendered text, and `dist/<name>/csp.txt`.
- k.scaffold: `keel scaffold project <name> --adapter static`, then `keel build`, exits 0.

## Migration
None (pre-1.0).

## Token impact
k.deploy +40 tokens, k.topology +10.

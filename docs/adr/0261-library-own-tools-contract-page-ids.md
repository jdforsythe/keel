# ADR-0261: a library's own `./tools` in its own folder, its `./contract` file, its route components' ids, library capability names (RFC 0239)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** A library's files are read as the app's for every rule (RFC 0163). Moving std-temporal, std-health, std-tokens and std-geo onto the format met three readings no library could satisfy: the own folder never registered the library's own formats and rules, check placed a contract only at `modules/<id>/<id>.contract.ts`, and k.library Ids left a route component, which has no caller, no way to give its page an id. Two capabilities did not have E1607's `<id>.<name>` form.

**Decision.**
- In its own folder, `keel check` imports the library's own `./tools` and holds the library and the `@keel/*` packages its `package.json` names in scope, as an app listing it does; a `./tools` that does not import is E1159 at `package.json`.
- A library's contract is the one `contract()` in the file its `exports["./contract"]` names; any other file of the library is E1513 naming that file.
- In a route component file (bound by the library's own `manifest(`, not public, no `exports` target), an element may take a literal id `<manifest id>.<rest>`.
- `geo` is `geo.position`, `tokens` is `tokens.opaque`.

**Alternatives.**
- A synthetic manifest listing the library, or `UTC` moved under `unsafe/`.
- Contract files found by name, or E1513 skipped in libraries.
- A literal id under the manifest id in any library file; the router passing a page `props.id`.
- A naming exception for stdlib capabilities (refused by D178).

**Consequences.** k.library-pack, k.contract and k.library gain one Conformance clause each; k.contract, std.geo and std.tokens read `implemented` until covered. More rules run in an own folder, not fewer. std-geo and std-tokens stay unmarked until their conformance names the new capabilities.

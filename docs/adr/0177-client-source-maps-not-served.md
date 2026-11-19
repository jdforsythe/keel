# ADR-0177: k.deploy: a `*.map` file under `assets/` is not served (RFC 0155)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** A Vite config that sets `build.sourcemap` writes client maps, with `sourcesContent`, beside the chunks under `assets/`, and production `createApp({ assets })` served every regular file there. The server map is already never served.

**Decision.** `createApp({ assets })` neither reads nor serves a file under `assets/` whose name ends `.map`; a GET of one is 404, as for any path the build does not hold. The server enforces it, whatever built the folder; `keel build` is unchanged.

**Alternatives.**
- `keel build` refuses or strips client maps: leaves a folder built another way exposed, and strips maps an error tracker needs at build time.
- State it as a limit: the server already guards its own map; privacy by default asks the same of the client's.

**Consequences.** No map reaches a browser from a Keel server; debugging a production client with maps means serving them elsewhere. The conformance case lives in RFC 0155, since k.deploy has no room for another bullet.

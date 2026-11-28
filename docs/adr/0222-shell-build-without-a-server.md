# ADR-0222: k.shell: a shell build of an app with no server reads no `KEEL_ORIGIN` (RFC 0200)

**Status:** accepted (orchestrator, 2026-11-23; under D103).

**Context.** A shell build stops with E1574 unless `KEEL_ORIGIN` is a valid origin, whatever the topology. The origin receives the shell's page-origin requests, with Keel's headers and the caller cookie, and the native allow lists open it. In an app whose topology has no `node` deployable no deployable answers there, so `examples/native-tauri`, `examples/native-capacitor` and `examples/links-in` build only with an invented `http://localhost:4182`. A front end with no back end is a first-class app and carries no config for a server it does not have.

**Decision.**
- An app has a server when its topology has a `node` deployable. With one, a shell build needs a valid `KEEL_ORIGIN`, as now; unset or empty is E1574 `KEEL_ORIGIN must be an https: origin (http: on localhost only)`.
- With none, the build reads no `KEEL_ORIGIN` and has no `origin`. The entry passes none to the drivers or `shellMount`, the target's `build` gets none, and its tools' `env` holds none. `connect` is the declared `origins.connect` alone.
- With no `origin`, `net` refuses a request on the page's own origin as one to an unlisted origin. Tauri writes no `capabilities/http.json` when nothing is allowed; Capacitor's `KeelHttp.allow` is the `connect` list, `[]` when empty, with no Android cleartext config.
- `KEEL_ORIGIN` set and not empty in an app with no server is E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it`. An empty value is unset.
- The generated shell CI job sets `KEEL_ORIGIN` from `vars` only with a `node` deployable.

**Alternatives.**
- Ignore a set `KEEL_ORIGIN` with no server: a value read and dropped, and the person expects a server.
- Decide per shelled `client`: a `client` reaches a `node` deployable through peers and contract services, and a wrong guess drops an origin an app needs.
- A topology flag or a default origin: a second way to say what the topology says, or an origin nobody chose in a release build's allow list.
- Serve page-origin requests from `www/` through `net`: nothing in Keel asks for it, and it widens `net` past the declared list.

**Consequences.** The three examples build their shells with no environment, and their READMEs drop `KEEL_ORIGIN`. A shell of an app with no server sends no request to anything but its declared `connect` origins, and no request carries a Keel header. About a dozen conformance fixtures that set `KEEL_ORIGIN` on a client-only topology gain a `node` deployable. `ShellBuild.origin` and the drivers' `origin` become optional. k.shell is at 3,002 of its 3,100 tokens.

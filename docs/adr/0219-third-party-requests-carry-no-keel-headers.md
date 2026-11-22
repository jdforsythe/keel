# ADR-0219: a request to a third-party origin carries no Keel header (RFC 0197)

**Status:** accepted (orchestrator, D104; for the operator to confirm).

**Context.** A Keel front end with no back end that calls another organisation's API must be possible and easy. Every service request sent `x-keel: 1`, k.server's same-site proof, so each browser call to a third party was a preflighted CORS request, and an API whose preflight does not allow the header refused it. App code cannot call the API another way (E1651).

**Decision.** Keel's own headers go only to Keel origins: every `contract` service target, and for a `base` service the document's origin, each `keel-peer` origin and each `createApp` URL peer. A request to any other origin carries `accept`, the author's `bearer` as `authorization`, `content-type` with a body, and nothing else: no `x-keel`, no `x-keel-user` (a `user` on a `base` service is `api.input`), credentials the `fetch` default. A `base` GET with no `bearer` to a third party is a CORS-simple request. A third party's body is never read as a k.server `Result`.

**Alternatives.** No Keel header on any `base` service (loses the same-site proof to the app's own `node` deployable); a per-service opt-out (the default still breaks); declared `connect` origins only (a browser policy; a `node` caller declares nothing); dropping `accept` too (safelisted, costs nothing).

**Consequences.** What an author writes does not change; a client-only app needs only its `connect` declaration and the API's CORS policy. `@keel/services` decides per call whether a `base` target is a Keel origin. `contract` services, mount requests and `/__keel/user` keep `x-keel`.

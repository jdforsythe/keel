---
"@keel/services": minor
---

A `service({ base })` request to a third-party origin carries no Keel header: `accept`, `authorization` for a `bearer` and `content-type` with a body, never `x-keel` or `x-keel-user`, with the `fetch` default credentials, so a GET with no `bearer` is a CORS-simple request. `x-keel: 1` goes to Keel origins only: every `service({ contract })` target and, for a `base` service, the document's origin, each `keel-peer` origin and each URL peer of the `createApp` that bound `ctx`.

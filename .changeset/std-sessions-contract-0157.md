---
"@keel/std-sessions": minor
---

`@keel/std-sessions/contract` exports `sessions`, the contract of `sessions.ingest`, `sessions.list` and `sessions.tally`; `ListSearch` is the list entry's `query`, so a failing one answers 422 `keel.fields` at `query.<key>`. `routes` is its one binding, the tally behind the reader guard beside the list; `monitorRoutes` and `sessionsTally` are gone, and E2009 reads `runners.server.ts` only. `replay`, `minimize`, `redactSession` and `commandJob` take route tables and read pages through their public contracts; `to-test` writes `<contract>.href(...)` navigations and joins several serving modules with `routeTable`.

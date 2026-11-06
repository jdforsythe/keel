---
"@keel/services": minor
---

k.services: `endpoints` declarations and `service({ base, schema, timeout? })` typed client; each method `(input, ctx)` goes through `ctx.net.fetch`, never throws, and returns `Result<Out, ApiError>` with `api.timeout` (on `ctx.clock`, aborts the request), `api.network`, `api.status` (declared error bodies decoded), `api.decode`; path params URL-encoded, query by schema, JSON body.

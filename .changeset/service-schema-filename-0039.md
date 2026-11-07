---
"@keel/services": minor
"@keel/scaffold": minor
---

RFC 0039: the generated endpoint declaration is `modules/<m>/<M>Api.schema.ts` (filename equals its export `<M>Api`, E1752); `openapi()`'s `service` source imports `./<M>Api.schema.ts`, and `scaffold service` places the schema there. `api.ts` and the client import path are unchanged. Migration: rename `api.schema.ts` to `<M>Api.schema.ts` and update the import in `api.ts`.

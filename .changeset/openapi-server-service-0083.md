---
"@keel/scaffold": minor
"@keel/services": patch
---

`keel scaffold service --openapi` writes the generated service to `modules/<id>/api.server.ts`: a service with a literal `base` URL is server-only (E1571). `openapi()` documents `service` as that file's source.

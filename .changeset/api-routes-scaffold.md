---
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/testing": patch
---

`keel scaffold route <id> --path <p> --api` writes an API route: a manifest entry with `api: true`, its `*.server.ts` loader and a JSON request test that serves the module alone from a node deployable, and no page component (k.api). `renderRoute` takes page ids only; `surface.json` records API routes.

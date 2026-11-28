---
"@keel/std-sessions": minor
"@keel/std-health": minor
---

The route handlers live in `*.server.ts` files (`listSessions.server.ts`, `addSession.server.ts`, `ingestSession.server.ts`, `loadHealth.server.ts`), so a page that imports `./routes` for `routes.href` ships none of them: browser builds stub them.

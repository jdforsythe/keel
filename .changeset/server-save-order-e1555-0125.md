---
"@keel/server": patch
---

Server state saves and production startup (backlog 0125, 0127, 0147; RFC 0052). A save replaces a store's in-process copy only after its `ctx.storage.set` resolves. A rejected write is the action's 500, is not served, and is not carried by the next save. Saves of one storage key run in issue order, and a request that opens a key waits for the save in flight. A production `createApp` without `assets` now rejects with E1555 at startup unless `NODE_ENV` (trimmed, any case) is `development` or `test`; unset counts as production. Without a build, island documents would load the Vite-only `/@keel/entry.ts`. Dev mode and test runs still serve the dev entry. A json dev log `diag` record's `see` names the section owning its code (E1508 is `k.router`), not always `k.server`.

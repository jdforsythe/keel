---
"@keel/std-db": minor
---

`@keel/std-db` is a library on the format (`"keel": "library"`): it has a root `module.ts` (id `db`), a type-only `.` entry (`DbStorage`), `exports` with the `keel` condition, and its `@keel/*` packages as peers, `@keel/schema` among them. The drivers and the listener are server-only files (`sqlite.server.ts`, `postgres.server.ts`, `storageListener.server.ts`, `notifyPayloads.server.ts`, `verifiedSslmode.server.ts`); the `./sqlite` and `./postgres` entries stay `index.ts`. The rejections the spec names go through `unsafe/raise.ts`, a catch that reads the driver's error object through `unsafe/settle.ts` or `unsafe/settleNow.ts`, and every other catch is `attempt`. The package's tests share `test/support.ts` in place of the conformance fixtures.

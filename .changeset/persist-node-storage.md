---
"@keel/compiler": minor
"@keel/server": minor
"@keel/check": minor
---

A `node` deployable's `storage` (`'file'`, `'sqlite'`, `'postgres'`) and a `client` one's `shells` are read from `topology.ts`. The production entry of a `'sqlite'` or `'postgres'` deployable imports that `@keel/std-db` driver; `start` validates `KEEL_DATABASE_URL` (E1560, no value printed), opens the driver before listening (std.db's E2152 or E2153 print and exit 1) and closes it after `app.close()`. `keel check` reports E1572 when `storage` or `shells` needs a package `package.json` lacks (its fix adds it) and E1573 for `shells` off a `client` deployable or an id that is not reverse-DNS.

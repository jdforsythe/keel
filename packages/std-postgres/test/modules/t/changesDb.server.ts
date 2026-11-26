// A database of the `t` module of the app these tests stand for (std.postgres E2458: a literal `<moduleId>.<name>` of
// its module). Two ctxs open it on one `pglite:` folder in changes.server.test.ts.
import { database } from "@keel/std-postgres/server";

export const changesDb = database("t.changesDb", { migrations: { "./migrations/0001-init.sql": "select 1" } });

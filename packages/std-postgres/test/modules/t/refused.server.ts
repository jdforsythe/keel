// A database of the `t` module of the app these tests stand for (std.postgres E2458: a literal `<moduleId>.<name>` of
// its module). Opened against a refused connection in app-folder.server.test.ts.
import { database } from "@keel/std-postgres/server";

export const refused = database("t.refused", {
  migrations: { "./migrations/0001-a.sql": "create table refused_a (n int)" },
});

// Spec: std.postgres, Conformance "With `KEEL_POSTGRES_URL` a `postgres:` URL whose port refuses connections, the first `query` is `err` `keel.unreachable`, and an API loader returning it answers 502."
// Spec: std.postgres, Migrations "A refused or lost connection, opening the store or in the pass, is that call's `keel.unreachable`, as a statement's is."
// Seed: 1337 (the closed port is whatever the OS just freed; the user and database names are generated).
// Assumption: "refused" is a `127.0.0.1` port nothing listens on; the answer is the `Result`'s `err` with `code` "keel.unreachable", for `query`, `one`, `run` and `transaction` alike is not asserted (the spec names `query`).
// UNTESTABLE here: "an API loader returning it answers 502" is k.data's status table, asserted in packages/server/conformance/data-capability-err-status.test.ts.
// Pending: a refused connection is a thrown error today.
import net from "node:net";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { SEED, databaseFound, errOf, fresh, migrationsOf } from "./fixtures.ts";
import { createCtx } from "@keel/ctx";

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const a = srv.address();
      srv.close(() => (typeof a === "object" && a !== null ? resolve(a.port) : reject(new Error("no port"))));
    });
  });

const before = process.env.KEEL_POSTGRES_URL;
afterEach(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
});

test.skip("With `KEEL_POSTGRES_URL` a `postgres:` URL whose port refuses connections, the first `query` is `err` `keel.unreachable`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), fc.boolean(), async (user, withMigration) => {
      const { cap, table } = fresh();
      process.env.KEEL_POSTGRES_URL = `postgres://${user}:pw@127.0.0.1:${await freePort()}/db`;
      const db = withMigration
        ? database(cap, { migrations: migrationsOf(`create table ${table} (n int)`) })
        : databaseFound(cap);
      const ctx = createCtx({ mode: "real", seed: SEED });
      const r = await db(ctx).query(sql(s.object({ c: s.number() }))`select 1::int as c`);
      expect(errOf(r).code).toBe("keel.unreachable");
    }),
    { seed: SEED, numRuns: 4 },
  );
}, 60_000);

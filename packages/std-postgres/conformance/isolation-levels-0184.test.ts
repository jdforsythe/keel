// Spec: std.postgres, clause "Under sim, on PGlite and on Postgres 17, `` sql(S)`show transaction_isolation` `` answers `serializable` in a `transaction` and alone, `repeatable read` with `allow: 'write skew'`, `read committed` with `allow: 'lost updates'`."
// std.postgres, API "`transaction(fn, { allow?, reason? })`: ... in one `serializable` transaction"
// Seed: 1337 (reasons are generated; fc seed below).
// Pending (rfc:0184): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: Postgres 17 runs when `KEEL_TEST_POSTGRES_URL` is set (MODES).
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { MODES, SEED, fresh, migrationsOf, okOf } from "./fixtures.ts";

const Level = s.object({ transaction_isolation: s.string() });
const reasonArb = fc.stringMatching(/^[a-z]{3,20}$/);

for (const m of MODES) {
  describe(m.name, () => {
    test("`show transaction_isolation` answers `serializable` in a `transaction` and alone", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        const alone = okOf(await db(ctx).one(sql(Level)`show transaction_isolation`));
        expect(alone.transaction_isolation).toBe("serializable");
        const inTx = okOf(await db(ctx).transaction((tx) => tx.one(sql(Level)`show transaction_isolation`)));
        expect(inTx.transaction_isolation).toBe("serializable");
      } finally {
        mode.done();
      }
    });

    test("`allow: 'write skew'` runs at `repeatable read`", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        await fc.assert(
          fc.asyncProperty(reasonArb, async (reason) => {
            const r = okOf(
              await db(ctx).transaction((tx) => tx.one(sql(Level)`show transaction_isolation`), {
                allow: "write skew",
                reason,
              }),
            );
            expect(r.transaction_isolation).toBe("repeatable read");
          }),
          { seed: SEED, numRuns: 5 },
        );
      } finally {
        mode.done();
      }
    });

    test("`allow: 'lost updates'` runs at `read committed`", async () => {
      const { cap } = fresh();
      const mode = m.make();
      try {
        const db = database(cap, { migrations: migrationsOf("select 1") });
        const ctx = await mode.ctx(cap);
        await fc.assert(
          fc.asyncProperty(reasonArb, async (reason) => {
            const r = okOf(
              await db(ctx).transaction((tx) => tx.one(sql(Level)`show transaction_isolation`), {
                allow: "lost updates",
                reason,
              }),
            );
            expect(r.transaction_isolation).toBe("read committed");
          }),
          { seed: SEED, numRuns: 5 },
        );
      } finally {
        mode.done();
      }
    });
  });
}

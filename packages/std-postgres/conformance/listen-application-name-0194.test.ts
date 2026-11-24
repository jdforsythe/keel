// Spec: std.postgres, Modes "`pg` ... one listening connection per URL, its `application_name` `keel-listen-<pid>`, opened at the first `follow` outside the pool and closed when the last follow stops" (rfc:0194)
// Spec: std.postgres-changes, Conformance "With a `follow` open, a `pg_stat_activity` backend has `application_name` `keel-listen-<pid>`."
// Seed: 1337 (no generated inputs: one fixed case).
// Assumption: runs only with `KEEL_TEST_POSTGRES_URL` (PG17, `hasPg17`); `<pid>` is this test process's `process.pid`; the backend is looked up with a query through the pool, which is not the listening connection.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { describe, expect, test } from "vitest";
import { PG17, SEED, fresh, hasPg17, okOf } from "./fixtures.ts";
import { boardChannel, keyOf, watch } from "./follow-fixtures.ts";

const Named = s.object({ n: s.int() });

describe.skipIf(!hasPg17)("postgres 17", () => {
  test("with a `follow` open, a `pg_stat_activity` backend has `application_name` `keel-listen-<pid>`", async () => {
    const { cap } = fresh();
    const before = process.env.KEEL_POSTGRES_URL;
    process.env.KEEL_POSTGRES_URL = PG17;
    try {
      const d = database(cap, { migrations: { "./migrations/0001-init.sql": "select 1" } })(
        createCtx({ mode: "real", seed: SEED }),
      );
      const count = async (): Promise<number> =>
        okOf(
          await d.query(
            sql(
              Named,
            )`select count(*)::int as n from pg_stat_activity where application_name = ${`keel-listen-${process.pid}`}`,
          ),
        )[0]?.n ?? -1;
      const w = await watch(d, boardChannel, keyOf("x"));
      expect(await count()).toBeGreaterThanOrEqual(1);
      w.stop();
    } finally {
      if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
      else process.env.KEEL_POSTGRES_URL = before;
    }
  });
});

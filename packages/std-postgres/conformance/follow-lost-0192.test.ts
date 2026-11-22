// Spec: std.postgres, Conformance "On Postgres 17, terminating the listening connection's backend reports `lost` to each open follow; the next `follow` opens a new connection and gets the next change."
// Spec: std.postgres, Modes "a lost one is `lost` to every follow on it, and the next `follow` opens it again" and "`on({ kind: 'lost' })` once if delivery stops".
// Seed: 1337 (no generated inputs: one fixed case).
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing the `test.skip` to `test` in this file.
// Assumption: runs only with `KEEL_TEST_POSTGRES_URL`. The listening backend is this process's own, the one whose `application_name` is `keel-listen-<pid of this process>` (std.postgres Modes), so other processes' listeners on the same server are left alone.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { describe, expect, test } from "vitest";
import { PG17, SEED, fresh, hasPg17, okOf } from "./fixtures.ts";
import { boardChannel, changed, keyOf, until, watch } from "./follow-fixtures.ts";

const Killed = s.object({ pid: s.int(), t: s.boolean() });

describe.skipIf(!hasPg17)("postgres 17", () => {
  test("terminating the listening connection's backend reports `lost` once to each open follow; the next `follow` opens a new connection and gets the next change", async () => {
    const { cap } = fresh();
    const before = process.env.KEEL_POSTGRES_URL;
    process.env.KEEL_POSTGRES_URL = PG17;
    try {
      const d = database(cap, { migrations: { "./migrations/0001-init.sql": "select 1" } })(
        createCtx({ mode: "real", seed: SEED }),
      );
      const a = await watch(d, boardChannel, keyOf("x"));
      const b = await watch(d, boardChannel, keyOf("y"));
      okOf(
        await d.query(
          sql(
            Killed,
          )`select pid, pg_terminate_backend(pid) as t from pg_stat_activity where pid <> pg_backend_pid() and application_name = ${`keel-listen-${process.pid}`}`,
        ),
      );
      await until(() => a.events.length >= 1 && b.events.length >= 1);
      expect(a.events).toEqual([{ kind: "lost" }]);
      expect(b.events).toEqual([{ kind: "lost" }]);
      const c = await watch(d, boardChannel, keyOf("x"));
      okOf(await changed(d, boardChannel, { b: "x" }));
      await until(() => c.events.length >= 1);
      expect(c.events).toEqual([{ kind: "changed" }]);
      expect(a.events).toEqual([{ kind: "lost" }]);
      for (const w of [a, b, c]) w.stop();
    } finally {
      if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
      else process.env.KEEL_POSTGRES_URL = before;
    }
  });
});

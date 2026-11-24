// Spec: std.postgres-changes, Conformance "On Postgres 17, with two processes on one URL, a `follow` in process B and a committed `changed` in process A: B's `on` gets `changed`, and a read in B started after it sees A's rows."
// Spec: std.postgres-changes, API "`select pg_notify('keel_changes', $1)` ... Postgres delivers a notification only after its transaction commits."
// Seed: 1337 (no generated inputs: one fixed cross-process case).
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing the `test.skip` to `test` in this file.
// Assumption: runs only with `KEEL_TEST_POSTGRES_URL` (describe.skipIf). B is this test process, A is a child `node --experimental-strip-types follow-child.ts` that inserts row 1 and calls `tx.changed` in one transaction.
import { execFile } from "node:child_process";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { PG17, SEED, fresh, hasPg17, okOf, sqlName } from "./fixtures.ts";
import { boardChannel, keyOf, until, watch } from "./follow-fixtures.ts";

const Count = s.object({ c: s.int() });
const CHILD = join(import.meta.dirname, "follow-child.ts");
const processA = (cap: string, table: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", CHILD, cap, table],
      { env: { ...process.env, KEEL_POSTGRES_URL: PG17 }, timeout: 50_000 },
      (e, stdout) => (stdout.trim() === "" ? reject(e ?? new Error("no output")) : resolve(stdout.trim())),
    );
  });

describe.skipIf(!hasPg17)("postgres 17", () => {
  test("with two processes on one URL, a `follow` in process B and a committed `changed` in process A: B's `on` gets `changed`, and a read in B started after it sees A's rows", async () => {
    const { cap, table } = fresh();
    const before = process.env.KEEL_POSTGRES_URL;
    process.env.KEEL_POSTGRES_URL = PG17;
    try {
      const db = database(cap, {
        migrations: { "./migrations/0001-init.sql": `create table ${table} (id int primary key, name text)` },
      });
      const d = db(createCtx({ mode: "real", seed: SEED }));
      okOf(await d.query(sql(Count)`select count(*)::int as c from ${sqlName(table)}`));
      const reads: Promise<number>[] = [];
      const w = await watch(d, boardChannel, keyOf("x"), () => {
        reads.push(
          d.query(sql(Count)`select count(*)::int as c from ${sqlName(table)}`).then((r) => okOf(r)[0]?.c ?? -1),
        );
      });
      expect(JSON.parse(await processA(cap, table))).toEqual({ ok: true });
      await until(() => reads.length >= 1);
      expect(w.events).toEqual([{ kind: "changed" }]);
      expect(await Promise.all(reads)).toEqual([1]);
      w.stop();
    } finally {
      if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
      else process.env.KEEL_POSTGRES_URL = before;
    }
  });
});

// Seed 1337. On Postgres 17 (`KEEL_TEST_POSTGRES_URL`): the listening connection `follow` opens carries the
// `application_name` `keel-listen-<pid>`, so this process's listener is told apart from another's in `pg_stat_activity`.
import { pid } from "node:process";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { testTime } from "@keel/tooling/test-time";
import { expect, test, vi } from "vitest";

const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";
const board = { name: "t.listenName", params: s.object({ b: s.string() }) };
const Backend = s.object({ query: s.string() });

test.skipIf(PG17 === "")(
  "the listening connection is named keel-listen-<pid> and ends with the last follow",
  async () => {
    const before = process.env.KEEL_POSTGRES_URL;
    process.env.KEEL_POSTGRES_URL = PG17;
    try {
      const d = database(`t.listenName${pid}`, { migrations: { "./migrations/0001-init.sql": "select 1" } })(
        createCtx({ mode: "real", seed: 1337 }),
      );
      const named = async (): Promise<string[]> => {
        const r = await d.query(
          sql(Backend)`select query from pg_stat_activity where application_name = ${`keel-listen-${pid}`}`,
        );
        if (!r.ok) throw new Error(`pg_stat_activity: ${JSON.stringify(r.error)}`);
        return r.value.map((row) => row.query.toLowerCase());
      };
      const stop = await d.follow(board, '{"b":"x"}', () => undefined);
      expect(await named()).toEqual(["listen keel_changes"]);
      stop();
      await vi.waitFor(async () => expect(await named()).toEqual([]), { timeout: testTime(10_000), interval: 20 });
    } finally {
      if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
      else process.env.KEEL_POSTGRES_URL = before;
    }
  },
);

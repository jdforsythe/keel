// Spec: std.postgres, Conformance "Under sim, a plan `conflict`, `none` runs a lone `run` twice, changing its row once; `conflict` three times is `keel.conflict`, nothing changed."
// Spec: std.postgres, API "A lone `query`, `one` or `run` is its own `serializable` transaction, rerun as `fn` is"
// Spec: std.postgres, Modes "each run of a lone statement or of `fn` takes one step"
// Seed: 1337.
// Pending (rfc:0184): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: "runs twice" is observed as two plan steps consumed: a following lone `run` meets the third step; the row's change is observed by a read after the plan's end (`none`).
// Assumption: the row is made by a migration, so it needs no step.
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import { beforeAll, expect, test } from "vitest";
import { database } from "@keel/std-postgres/server";
import { errOf, fresh, migrationsOf, okOf, simCtx, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
});
const C = { delay: 0, fault: "conflict" as const };
const N = { delay: 0, fault: "none" as const };
const Counter = s.object({ n: s.int() });

function setup(plan: { delay: number; fault: "none" | "conflict" }[]) {
  const { cap, table } = fresh();
  const db = database(cap, {
    migrations: migrationsOf(
      `create table ${table} (id int primary key, n int not null)`,
      `insert into ${table} values (1, 0)`,
    ),
  });
  return { db, ctx: simCtx(cap, plan), T: sqlName(table) };
}

test("a plan `conflict`, `none` runs a lone `run` twice, changing its row once", async () => {
  const x = setup([C, N, C, C, C, ...Array.from({ length: 5 }, () => N)]);
  const r = await x.db(x.ctx).run(sql(NoRows)`update ${x.T} set n = n + 1 where id = 1`);
  expect(okOf(r)).toBe(1);
  // The next run starts at the third step: `conflict` three times is `keel.conflict`, proving the first took exactly two.
  const next = await x.db(x.ctx).run(sql(NoRows)`update ${x.T} set n = n + 100 where id = 1`);
  expect(errOf(next).code).toBe("keel.conflict");
  const row = okOf(await x.db(x.ctx).one(sql(Counter)`select n from ${x.T} where id = 1`));
  expect(row.n).toBe(1);
});

test("`conflict` three times is `keel.conflict`, nothing changed", async () => {
  const x = setup([C, C, C, N, N, N, N]);
  const r = await x.db(x.ctx).run(sql(NoRows)`update ${x.T} set n = n + 1 where id = 1`);
  expect(errOf(r).code).toBe("keel.conflict");
  const row = okOf(await x.db(x.ctx).one(sql(Counter)`select n from ${x.T} where id = 1`));
  expect(row.n).toBe(0);
});

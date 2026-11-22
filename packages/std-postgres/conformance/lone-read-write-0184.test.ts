// Spec: std.postgres, Conformance "Under sim, two callers started together on one ctx, each a lone `one` of a counter then a lone `run` of the value read + 1 held 10 sim ms by the plan, end it at 1; each in a `transaction`, at 2."
// Spec: std.postgres, API "a write using another call's read goes in one `transaction` with it."
// Seed: 1337.
// Pending (rfc:0184): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: "held 10 sim ms by the plan" is every plan step `{ delay: 10, fault: 'none' }`; callers are started with Promise.all; the final read also takes a plan step, so it is driven too.
import { s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";
import { beforeAll, expect, test } from "vitest";
import type { SimCtx } from "@keel/ctx";
import { fresh, migrationsOf, okOf, simCtx, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
});
/** Runs `calls` started together, advancing the sim clock to its next deadline whenever one is pending, until they settle. */
async function drive<T>(ctx: SimCtx, calls: Promise<T>[]): Promise<T[]> {
  let done = false;
  const all = Promise.all(calls).finally(() => {
    done = true;
  });
  for (let i = 0; i < 2000 && !done; i++) {
    await new Promise<void>((r) => setImmediate(r));
    const next = ctx.clock.next();
    if (next !== null) ctx.clock.advance(Math.max(0, next - ctx.clock.now()));
  }
  return all;
}
const Counter = s.object({ n: s.int() });

function setup() {
  const { cap, table } = fresh();
  const db = database(cap, {
    migrations: migrationsOf(
      `create table ${table} (id int primary key, n int not null)`,
      `insert into ${table} values (1, 0)`,
    ),
  });
  const plan = Array.from({ length: 8 }, () => ({ delay: 10, fault: "none" as const }));
  return { db, ctx: simCtx(cap, plan), T: sqlName(table) };
}

test("two callers each a lone `one` then a lone `run` of the value read + 1 end the counter at 1", async () => {
  const x = setup();
  const caller = async () => {
    const r = okOf(await x.db(x.ctx).one(sql(Counter)`select n from ${x.T} where id = 1`));
    return x.db(x.ctx).run(sql(NoRows)`update ${x.T} set n = ${r.n + 1} where id = 1`);
  };
  const out = await drive(x.ctx, [caller(), caller()]);
  for (const r of out) okOf(r);
  const [read] = await drive(x.ctx, [x.db(x.ctx).one(sql(Counter)`select n from ${x.T} where id = 1`)]);
  expect(read).toBeDefined();
  if (read === undefined) throw new Error("no read result");
  const final = okOf(read);
  expect(final.n).toBe(1);
});

test("two callers each in a `transaction` end the counter at 2", async () => {
  const x = setup();
  const caller = () =>
    x.db(x.ctx).transaction(async (tx) => {
      const r = await tx.one(sql(Counter)`select n from ${x.T} where id = 1`);
      if (!r.ok) return r;
      return tx.run(sql(NoRows)`update ${x.T} set n = ${r.value.n + 1} where id = 1`);
    });
  const out = await drive(x.ctx, [caller(), caller()]);
  for (const r of out) okOf(r);
  const [read] = await drive(x.ctx, [x.db(x.ctx).one(sql(Counter)`select n from ${x.T} where id = 1`)]);
  expect(read).toBeDefined();
  if (read === undefined) throw new Error("no read result");
  const final = okOf(read);
  expect(final.n).toBe(2);
});

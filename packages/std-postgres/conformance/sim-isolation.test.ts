import { s } from "@keel/schema";
// Spec: std.postgres, Conformance "Under sim, two ctxs of one seed give equal answers to the same calls; one ctx sees none of another's rows; a plan step `unavailable` is `keel.unreachable` and writes nothing."
// Spec: std.postgres, Modes "Under sim each database is PGlite in memory, migrated, one per sim ctx and capability, `setseed` from the capability seed; ... `fault` `none`, `unavailable` (`keel.unreachable`, runs nothing) or `conflict`"
// Seed: 1337.
// Assumption: "equal answers" is `toEqual` on the whole `Result` of each call, including a `select random()` (the capability seed sets Postgres's `setseed`; W2456 is a lint, not a runtime error).
// Assumption: a plan consumed past its end gives `none`; tests pad with explicit `none` steps.
// Skipped until `@keel/std-postgres` exists.
import { NoRows, sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";
import { Row, SEED, errOf, fresh, none, notesDb, okOf, simCtx, sqlName } from "./fixtures.ts";

beforeAll(async () => {
  await ready();
});

test("two ctxs of one seed give equal answers to the same calls", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.uniqueArray(fc.stringMatching(/^[a-z]{3,8}$/), { maxLength: 5 }),
      async (seed, names) => {
        const { cap, table } = fresh();
        const db = notesDb(cap, table);
        const T = sqlName(table);
        const calls = async (ctx: ReturnType<typeof simCtx>) => {
          const out: unknown[] = [];
          for (const [i, n] of names.entries())
            out.push(await db(ctx).run(sql(NoRows)`insert into ${T} values (${i}, ${n})`));
          out.push(await db(ctx).query(sql(Row)`select id, name from ${T} order by id`));
          out.push(await db(ctx).query(sql(s.object({ r: s.number() }))`select random() as r`));
          out.push(await db(ctx).run(sql(NoRows)`insert into ${T} values (0, 'dup')`));
          return out;
        };
        const a = await calls(simCtx(cap, none(40), seed));
        const b = await calls(simCtx(cap, none(40), seed));
        expect(a).toEqual(b);
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});

test("one ctx sees none of another's rows", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), async (name) => {
      const { cap, table } = fresh();
      const db = notesDb(cap, table);
      const T = sqlName(table);
      const one = simCtx(cap, none(10));
      const two = simCtx(cap, none(10));
      okOf(await db(one).run(sql(NoRows)`insert into ${T} values (1, ${name})`));
      expect(okOf(await db(one).query(sql(Row)`select id, name from ${T}`))).toEqual([{ id: 1, name: name }]);
      expect(okOf(await db(two).query(sql(Row)`select id, name from ${T}`))).toEqual([]);
      okOf(await db(two).run(sql(NoRows)`insert into ${T} values (1, ${name})`));
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("a plan step `unavailable` is `keel.unreachable` and writes nothing", async () => {
  const U = { delay: 0, fault: "unavailable" as const };
  const { cap, table } = fresh();
  const db = notesDb(cap, table);
  const T = sqlName(table);
  const ctx = simCtx(cap, [U, U, U, ...none(5)]);
  expect(errOf(await db(ctx).run(sql(NoRows)`insert into ${T} values (1, 'a')`)).code).toBe("keel.unreachable");
  expect(errOf(await db(ctx).query(sql(Row)`select id, name from ${T}`)).code).toBe("keel.unreachable");
  expect(errOf(await db(ctx).one(sql(Row)`select id, name from ${T}`)).code).toBe("keel.unreachable");
  expect(okOf(await db(ctx).query(sql(Row)`select id, name from ${T}`))).toEqual([]);
});

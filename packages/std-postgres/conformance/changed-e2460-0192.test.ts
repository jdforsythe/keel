// Spec: std.postgres-changes, clause "`params` failing the channel's schema and a payload over 7,900 bytes each throw E2460 and run no statement."
// std.postgres-changes, Rules "E2460 a `changed` whose `params` fail the channel's schema or whose payload exceeds 7,900 bytes (throws)."
// std.postgres-changes, API "No error, log line or diagnostic holds `params` or a key."
// Seed: 1337.
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: "run no statement" is shown under sim by the plan: step 0 is `unavailable`, so the throwing call must leave it unconsumed and the next valid call is the one that sees `keel.unreachable`.
// Assumption: the throw is an error whose `code` is "E2460" or whose text holds it, as for E2453 to E2455.
import { ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";
import { ENGINE_BOUND, Row, SEED, errOf, fresh, notesDb, okOf, simCtx, sqlName } from "./fixtures.ts";
import { boardChannel, changed } from "./follow-fixtures.ts";

beforeAll(async () => {
  await ready();
}, ENGINE_BOUND);

const unavailable = [{ delay: 0, fault: "unavailable" as const }];
const marker = (n: number) => `SECRET-${n}-MARK`;

test("`params` failing the channel's schema throw E2460 and run no statement, naming no param", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(fc.integer(), fc.constant(null), fc.array(fc.integer(), { maxLength: 3 })),
      fc.integer({ min: 0, max: 999 }),
      async (bad, n) => {
        const { cap, table } = fresh();
        const d = notesDb(cap, table)(simCtx(cap, unavailable));
        const e = await changed(d, boardChannel, { b: bad, note: marker(n) }).then(
          () => undefined,
          (x: unknown) => x,
        );
        expect(`${Reflect.get(Object(e), "code")} ${String(e)}`).toContain("E2460");
        expect(`${String(e)} ${JSON.stringify(Reflect.get(Object(e), "data") ?? null)}`).not.toContain(marker(n));
        // step 0 is still unconsumed: the next valid call is the first statement
        expect(errOf(await changed(d, boardChannel, { b: "x" }))).toMatchObject({ code: "keel.unreachable" });
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("a payload over 7,900 bytes throws E2460 and runs no statement, naming no key", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 8_000, max: 9_500 }), async (len) => {
      const { cap, table } = fresh();
      const d = notesDb(cap, table)(simCtx(cap, unavailable));
      const big = "a".repeat(len);
      const e = await changed(d, boardChannel, { b: big }).then(
        () => undefined,
        (x: unknown) => x,
      );
      expect(`${Reflect.get(Object(e), "code")} ${String(e)}`).toContain("E2460");
      expect(String(e)).not.toContain(big);
      expect(errOf(await changed(d, boardChannel, { b: "x" }))).toMatchObject({ code: "keel.unreachable" });
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("on `tx`, a payload over 7,900 bytes throws E2460 and the transaction commits nothing", async () => {
  const { cap, table } = fresh();
  const d = notesDb(cap, table)(simCtx(cap));
  await expect(
    d.transaction(async (tx) => {
      okOf(await tx.run(sql(NoRows)`insert into ${sqlName(table)} (id, name) values (1, 'a')`));
      await changed(tx, boardChannel, { b: "a".repeat(9_000) });
      return ok(null);
    }),
  ).rejects.toThrow(/E2460/);
  expect(okOf(await d.query(sql(Row)`select id, name from ${sqlName(table)}`))).toEqual([]);
});

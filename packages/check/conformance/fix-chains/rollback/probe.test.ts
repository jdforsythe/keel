// Spec: k.fixes, clause "The chain `rollback` takes one step, and its probe holds: with `work` rejecting with `w`, an object whose `code` is `40P01`, the function rejects with `w` itself after the statements `begin` and `rollback`; with `work` resolving, the statements are `begin` and `commit`."
// Seed 1337. The `postgres.database` / `keel.conflict` reading of `w` (X.in) belongs to std.postgres and is asserted in packages/std-postgres/conformance.
import fc from "fast-check";
import { expect, test } from "vitest";
import { save } from "./end/save.ts";

type Db = Parameters<typeof save>[0];

const fake = () => {
  const statements: string[] = [];
  const db: Db = { query: async (q) => void statements.push(q) };
  return { db, statements };
};

test("with work rejecting with w (code 40P01) the function rejects with w itself after begin and rollback", async () => {
  const w = { code: "40P01" };
  const { db, statements } = fake();
  const got: unknown = await save(db, async () => {
    throw w;
  }).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(got).toBe(w);
  expect(statements).toEqual(["begin", "rollback"]);
});

test("with work resolving the statements are begin and commit", async () => {
  const { db, statements } = fake();
  await save(db, async () => {});
  expect(statements).toEqual(["begin", "commit"]);
});

test("property: whatever work rejects with is what the function rejects with, after begin and rollback", async () => {
  await fc.assert(
    fc.asyncProperty(fc.anything(), async (w) => {
      const { db, statements } = fake();
      const got: unknown = await save(db, async () => {
        throw w;
      }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(Object.is(got, w)).toBe(true);
      expect(statements).toEqual(["begin", "rollback"]);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

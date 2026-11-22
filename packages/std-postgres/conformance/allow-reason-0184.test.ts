// Spec: std.postgres, Conformance "`allow: 'phantoms'`, or no `reason`, throws; E2459 fires on `{ allow: 'write skew' }` and on a variable `reason`, not on `reason: 'audit rows only'`."
// Spec: std.postgres, Rules "E2459 `allow` in a `.transaction(` options object without a `reason` that is a non-empty string literal."
// Spec: std.postgres, API "Another value, or no `reason`, throws."
// Seed: 1337.
// Pending (rfc:0184): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the throw is a rejection of the `transaction` call (or a synchronous throw); both are caught by awaiting inside an async wrapper. An empty-string `reason` also throws (API: "refused at run time when missing or empty", RFC D4).
// Not testable here: R2451 (`keel review` lists each `allow`), the k.escapes clause RFC 0184 adds; k.escapes is not a spec section on this branch ("no spec section k.escapes") and no `keel review` conformance exists to follow. Add it at the merge with k.escapes.
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";
import { SEED, fresh, migrationsOf, simCtx } from "./fixtures.ts";
import { s } from "@keel/schema";
import { dbFile, found, project } from "./rules-fixtures.ts";

beforeAll(async () => {
  await ready();
});
const Any = s.object({ v: s.json() });

function setup() {
  const { cap } = fresh();
  const db = database(cap, { migrations: migrationsOf("select 1") });
  const ctx = simCtx(
    cap,
    Array.from({ length: 50 }, () => ({ delay: 0, fault: "none" as const })),
  );
  return { db, ctx };
}
const callWith = (x: ReturnType<typeof setup>, opts: unknown) => async () =>
  Reflect.apply(x.db(x.ctx).transaction, x.db(x.ctx), [(tx: { one: (q: unknown) => unknown }) => tx.one(sql(Any)`select 1 as v`), opts]);

test.skip("`allow: 'phantoms'` throws", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,12}$/), async (reason) => {
      const x = setup();
      await expect(callWith(x, { allow: "phantoms", reason })()).rejects.toThrow();
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test.skip("`allow` with no `reason` throws", async () => {
  for (const allow of ["write skew", "lost updates"]) {
    const x = setup();
    await expect(callWith(x, { allow })()).rejects.toThrow();
    await expect(callWith(x, { allow, reason: "" })()).rejects.toThrow();
  }
});

const P = "modules/kitchen/kitchenDb.server.ts";
const call = (opts: string, pre = "") =>
  dbFile(
    '"kitchen.db"',
    `${pre}export const run = (ctx: never) => kitchenDb(ctx).transaction(async (tx) => tx.run(q), ${opts})\n`,
  );

test.skip("E2459 fires on `{ allow: 'write skew' }`", () => {
  expect(found(project(P, call("{ allow: 'write skew' }")), "E2459").length).toBe(1);
  expect(found(project(P, call("{ allow: 'lost updates' }")), "E2459").length).toBe(1);
});

test.skip("E2459 fires on a variable `reason`", () => {
  const f = found(project(P, call("{ allow: 'write skew', reason: why }", "const why = 'audit rows only'\n")), "E2459");
  expect(f.length).toBe(1);
});

test.skip("E2459 does not fire on `reason: 'audit rows only'`", () => {
  expect(found(project(P, call("{ allow: 'write skew', reason: 'audit rows only' }")), "E2459").length).toBe(0);
  expect(found(project(P, call("{ allow: 'lost updates', reason: 'audit rows only' }")), "E2459").length).toBe(0);
});

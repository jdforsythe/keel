// Spec: std.postgres, Conformance "... a missing `KEEL_POSTGRES_URL` is E2455."
// Spec: std.postgres, Modes "`KEEL_POSTGRES_URL` picks the store, read at the first query ... Missing or another scheme is E2455, naming no part of the value."; Rules "E2453 to E2455 and E2457 throw"
// Seed: 1337.
// Assumption: on a real ctx the first query rejects (or throws) with an error whose `code` is "E2455" or whose text holds it; the value is read at the first query, not when `database` runs.
// Skipped until `@keel/std-postgres` exists.
import { createCtx } from "@keel/ctx";
import { NoRows, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, fresh, migrationsOf } from "./fixtures.ts";

async function firstQuery(url: string | undefined): Promise<unknown> {
  const before = process.env.KEEL_POSTGRES_URL;
  if (url === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = url;
  try {
    const { cap } = fresh();
    const db = database(cap, { migrations: migrationsOf("select 1") });
    const ctx = createCtx({ mode: "real", seed: SEED });
    await db(ctx).run(sql(NoRows)`select 1 where false`);
    return undefined;
  } catch (e) {
    return e;
  } finally {
    if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
    else process.env.KEEL_POSTGRES_URL = before;
  }
}

test.skip("a missing `KEEL_POSTGRES_URL` is E2455", async () => {
  const e = await firstQuery(undefined);
  expect(String(Reflect.get(Object(e), "code")) === "E2455" || String(e).includes("E2455")).toBe(true);
});

test.skip("another scheme is E2455 naming no part of the value", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("mysql", "sqlite", "http", "file"),
      fc.stringMatching(/^[a-z]{10,16}$/),
      fc.stringMatching(/^[a-z]{10,16}$/),
      async (scheme, user, host) => {
        const value = `${scheme}://${user}:${host}@${host}.example/${user}`;
        const e = await firstQuery(value);
        const text = `${String(Reflect.get(Object(e), "code"))} ${String(e)} ${JSON.stringify(e)}`;
        expect(text).toContain("E2455");
        expect(text).not.toContain(user);
        expect(text).not.toContain(host);
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});

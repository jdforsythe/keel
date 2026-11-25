// Spec: std.postgres, clause "With `KEEL_POSTGRES_URL` unset and `KEEL_DEV_DIR` a folder `d`, a `query` answers from PGlite in `d/postgres`, which exists after it."
// std.postgres, Modes "Missing, it is `pglite:<KEEL_DEV_DIR>/postgres` when `KEEL_DEV_DIR` is set (`keel dev`, k.data Files); else E2455 as now."
// Seed: 1337 (the table value is generated).
// Assumption: `d/postgres` is the PGlite data folder, so it exists as a directory after the first answered query; `d` itself exists beforehand.
// Pending: a missing URL is E2455 everywhere today.
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { SEED, fresh, migrationsOf, okOf, sqlName } from "./fixtures.ts";

const saved = { url: process.env.KEEL_POSTGRES_URL, dev: process.env.KEEL_DEV_DIR };
afterEach(() => {
  for (const [k, v] of [
    ["KEEL_POSTGRES_URL", saved.url],
    ["KEEL_DEV_DIR", saved.dev],
  ] as const) {
    if (v === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = v;
  }
});

test("With `KEEL_POSTGRES_URL` unset and `KEEL_DEV_DIR` a folder `d`, a `query` answers from PGlite in `d/postgres`, which exists after it", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (v) => {
      const d = mkdtempSync(join(tmpdir(), "keel-dev-"));
      try {
        const { cap, table } = fresh();
        Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
        process.env.KEEL_DEV_DIR = d;
        const db = database(cap, {
          migrations: migrationsOf(`create table ${table} (n int); insert into ${table} values (${v})`),
        });
        const ctx = createCtx({ mode: "real", seed: SEED });
        const r = await db(ctx).query(sql(s.object({ n: s.number() }))`select n::int as n from ${sqlName(table)}`);
        expect(okOf(r)).toEqual([{ n: v }]);
        expect(existsSync(join(d, "postgres")) && statSync(join(d, "postgres")).isDirectory()).toBe(true);
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    }),
    { seed: SEED, numRuns: 3 },
  );
}, 60_000);

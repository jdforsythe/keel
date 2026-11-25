// Spec: std.postgres, clause "Two processes on one `postgres:` URL apply each pending migration once; a changed applied file is E2454; `0001`, `0003` is E2453."
// std.postgres, Migrations "`migrations` maps `./migrations/NNNN-<kebab>.sql` to its text, numbered from 0001 without a gap; another key or a gap throws E2453 when `database` runs. ... A `keel_migrations` row of the capability whose file is gone or whose SHA-256 differs from its `digest` is E2454. After a failed pass every query of that database on the ctx rejects with its error."
// Seed: 1337.
// Assumption: the two-process test needs a Postgres 17 (`KEEL_TEST_POSTGRES_URL`) and is skipped without one; children are `node --experimental-strip-types` on `migrate-child.ts`, which resolves `@keel/*` through the package's node_modules.
// Assumption: E2454 is shown on a PGlite folder by two child runs in sequence (one process at a time on PGlite); E2453 and E2454 are thrown errors whose `code` is that string or whose text holds it.
// Assumption: a file gone is shown by a run with 0001 and 0002 (variant `c`), then a run with 0001 only: the row of 0002 has no file.
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { PG17, SEED, fresh, hasPg17, migrationsOf } from "./fixtures.ts";

const CHILD = join(import.meta.dirname, "migrate-child.ts");
type Out = { ok: boolean; rows?: number; error?: string };
const run = (url: string, cap: string, table: string, variant: string): Promise<Out> =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", CHILD, cap, table, variant],
      { env: { ...process.env, KEEL_POSTGRES_URL: url }, timeout: 50_000 },
      (e, stdout) => {
        const line = stdout.trim().split("\n").at(-1) ?? "";
        try {
          resolve(JSON.parse(line));
        } catch {
          reject(e ?? new Error(`no output: ${stdout}`));
        }
      },
    );
  });

test.skipIf(!hasPg17)("Two processes on one `postgres:` URL apply each pending migration once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 2, max: 4 }), async (n) => {
      const { cap, table } = fresh();
      const outs = await Promise.all(Array.from({ length: n }, () => run(PG17, cap, table, "a")));
      for (const o of outs) expect(o).toEqual({ ok: true, rows: 1 });
    }),
    { seed: SEED, numRuns: 3 },
  );
});

test("a changed applied file is E2454", async () => {
  const dir = mkdtempSync(join(tmpdir(), "keel-pg-"));
  try {
    const { cap, table } = fresh();
    const url = `pglite:${dir}`;
    expect(await run(url, cap, table, "a")).toEqual({ ok: true, rows: 1 });
    expect(await run(url, cap, table, "a")).toEqual({ ok: true, rows: 1 });
    const changed = await run(url, cap, table, "b");
    expect(changed.ok).toBe(false);
    expect(changed.error).toContain("E2454");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a `keel_migrations` row whose file is gone is E2454", async () => {
  const dir = mkdtempSync(join(tmpdir(), "keel-pg-"));
  try {
    const { cap, table } = fresh();
    const url = `pglite:${dir}`;
    expect(await run(url, cap, table, "c")).toEqual({ ok: true, rows: 1 });
    const gone = await run(url, cap, table, "a");
    expect(gone.ok).toBe(false);
    expect(gone.error).toContain("E2454");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`0001`, `0003` is E2453 when `database` runs", () => {
  const { cap } = fresh();
  expect(() =>
    database(cap, { migrations: { "./migrations/0001-a.sql": "select 1", "./migrations/0003-c.sql": "select 1" } }),
  ).toThrow(/E2453/);
});

test("migrations numbered from 0001 without a gap are accepted; a gap, a start past 0001 or another key is E2453", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 5 }), (n, skip) => {
      const ok = migrationsOf(...Array.from({ length: n }, () => "select 1"));
      expect(() => database(fresh().cap, { migrations: ok })).not.toThrow();
      const keys = Object.keys(ok);
      const gapped = Object.fromEntries(keys.filter((_, i) => i !== skip % n).map((k) => [k, "select 1"]));
      if (skip % n !== n - 1) expect(() => database(fresh().cap, { migrations: gapped })).toThrow(/E2453/);
      expect(() => database(fresh().cap, { migrations: { ...ok, "./migrations/init.sql": "select 1" } })).toThrow(
        /E2453/,
      );
    }),
    { seed: SEED, numRuns: 30 },
  );
  expect(() => database(fresh().cap, { migrations: { "./migrations/0002-b.sql": "select 1" } })).toThrow(/E2453/);
});

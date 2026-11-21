// Spec: std.postgres, Conformance "With no `migrations`, in a working directory holding `modules/notes/migrations/0001-notes.sql`, `database('notes.db')`'s first sim `query` reads the table it makes; with `KEEL_APP_DIR` naming another folder, that folder's file is read; a lone `0002-x.sql` rejects the first call with E2453; no folder makes no table and no error."
// Spec: std.postgres, Migrations "`database(name, { migrations? })`. A database's migrations are the files `modules/<moduleId>/migrations/*.sql` of the app folder (k.data Files), read synchronously at its first call; no folder is none. `migrations`, given, ... is read instead."
// Seed: 1337.
// Assumption: the working-directory half runs in a child process whose cwd is a temp app folder (a vitest worker cannot chdir); `app-dir-child.ts` prints one JSON line. The `KEEL_APP_DIR` halves run in-process, the variable set after `database(...)` ran and before its first call (files are read at the first call).
// Assumption: `<moduleId>` is the part of the name before the dot, so `fresh().cap` (`t.db<N>`) reads `modules/t/migrations`; tables are per-process-tagged by `fresh()`; E2453 is a rejection whose `code` is "E2453" or whose text holds it.
// Assumption: a query on a missing table is undefined_table (SQLSTATE 42P01), an unexpected database error (std.postgres Errors), so it rejects with the SQLSTATE in its code or text.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";
import { SEED, databaseFound, fresh, none, okOf, simCtx, sqlName } from "./fixtures.ts";
import { ready } from "@keel/std-postgres/testing";

const Count = s.object({ c: s.number() });
let app = "";
let before: string | undefined;
beforeEach(async () => {
  await ready();
  app = mkdtempSync(join(tmpdir(), "keel-app-"));
  before = process.env.KEEL_APP_DIR;
});
afterEach(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_APP_DIR");
  else process.env.KEEL_APP_DIR = before;
  rmSync(app, { recursive: true, force: true });
});

const put = (root: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const moduleOf = (cap: string): string => cap.slice(0, cap.indexOf("."));
const failure = async (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => "",
    (e: unknown) => `${String(Reflect.get(Object(e), "code"))} ${String(e)}`,
  );

test("`database(name)` with no `migrations`, its app folder named by `KEEL_APP_DIR`, reads `modules/<id>/migrations/*.sql` at the first sim `query` and the query reads the table it makes", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 50 }), async (rows) => {
      const { cap, table } = fresh();
      put(
        app,
        `modules/${moduleOf(cap)}/migrations/0001-notes.sql`,
        `create table ${table} (n int); ${Array.from({ length: rows }, () => `insert into ${table} values (1);`).join(" ")}`,
      );
      const db = databaseFound(cap);
      process.env.KEEL_APP_DIR = app;
      const r = await db(simCtx(cap, none(20))).query(sql(Count)`select count(*)::int as c from ${sqlName(table)}`);
      expect(okOf(r)[0]?.c).toBe(rows);
    }),
    { seed: SEED, numRuns: 5 },
  );
});

test("with `KEEL_APP_DIR` naming another folder, that folder's file is read", async () => {
  const other = mkdtempSync(join(tmpdir(), "keel-app-other-"));
  try {
    const { cap, table } = fresh();
    put(app, `modules/${moduleOf(cap)}/migrations/0001-a.sql`, `create table ${table}_wrong (n int)`);
    put(
      other,
      `modules/${moduleOf(cap)}/migrations/0001-a.sql`,
      `create table ${table} (n int); insert into ${table} values (7)`,
    );
    process.env.KEEL_APP_DIR = other;
    const r = await databaseFound(cap)(simCtx(cap, none(20))).query(
      sql(Count)`select sum(n)::int as c from ${sqlName(table)}`,
    );
    expect(okOf(r)[0]?.c).toBe(7);
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
});

test("a lone `0002-x.sql` rejects the first call with E2453", async () => {
  const { cap } = fresh();
  put(app, `modules/${moduleOf(cap)}/migrations/0002-x.sql`, "select 1");
  const db = databaseFound(cap);
  process.env.KEEL_APP_DIR = app;
  expect(await failure(db(simCtx(cap, none(20))).query(sql(Count)`select 1::int as c`))).toContain("E2453");
});

test("no folder makes no table and no error: the first call succeeds; a query on the missing table is an unexpected database error and throws its SQLSTATE", async () => {
  const { cap, table } = fresh();
  process.env.KEEL_APP_DIR = app;
  const ctx = simCtx(cap, none(20));
  const db = databaseFound(cap);
  expect(okOf(await db(ctx).query(sql(Count)`select 1::int as c`))[0]?.c).toBe(1);
  expect(await failure(db(ctx).query(sql(Count)`select count(*)::int as c from ${sqlName(table)}`))).toContain("42P01");
});

const CHILD = join(import.meta.dirname, "app-dir-child.ts");
test("with `KEEL_APP_DIR` unset, in a working directory holding `modules/<id>/migrations/0001-notes.sql`, the first sim `query` reads the table it makes", async () => {
  const { cap, table } = fresh();
  put(
    app,
    `modules/${moduleOf(cap)}/migrations/0001-notes.sql`,
    `create table ${table} (n int); insert into ${table} values (3)`,
  );
  const env = { ...process.env };
  Reflect.deleteProperty(env, "KEEL_APP_DIR");
  const line = await new Promise<string>((resolve, reject) =>
    execFile(
      process.execPath,
      ["--experimental-strip-types", CHILD, cap, table],
      { cwd: app, env, timeout: 50_000 },
      (e, out) =>
        out.trim() === "" ? reject(e ?? new Error("no output")) : resolve(out.trim().split("\n").at(-1) ?? ""),
    ),
  );
  expect(JSON.parse(line)).toEqual({ ok: true, sum: 3 });
});

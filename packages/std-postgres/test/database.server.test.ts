// Seed 1337. The database capability beyond its conformance: settling without a timer, plan delays and the end of a
// plan, savepoints inside a transaction, isolation, errors that throw, and E2454 for a migration file that is gone.
import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { NoRows, fragment, sql } from "@keel/std-postgres";
import type { Tx } from "@keel/std-postgres/server";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const SEED = 1337;
const Row = s.object({ id: s.int(), name: s.string() });
let made = 0;
const fresh = () => {
  made += 1;
  const name = `u_${made}`;
  return { cap: `t.unit${made}`, name, table: fragment(Object.assign([name], { raw: [name] })) };
};
const notesOf = (cap: string, name: string) =>
  database(cap, {
    migrations: { "./migrations/0001-notes.sql": `create table ${name} (id int primary key, name text unique)` },
  });
const sim = (cap: string, plan: { delay: number; fault: string }[] = []): SimCtx =>
  createCtx({ mode: "sim", seed: SEED, schedule: { net: [], storage: [], offline: [], plans: { [cap]: plan } } });

// `ready()` loads the PGlite engine (its WebAssembly and initdb): about 1.5 s here, over 10 s on a slow runner, so the
// hook states 60 s, the bound the apps give a PGlite folder's first open.
beforeAll(async () => {
  await ready();
}, fixedTime(60_000));
afterEach(() => {
  vi.restoreAllMocks();
});

test("after ready(), a sim query and a transaction settle in microtask rounds with no timer", async () => {
  const { cap, name, table } = fresh();
  const db = notesOf(cap, name);
  const ctx = sim(cap);
  const timers = vi.spyOn(globalThis, "setTimeout");
  const immediates = vi.spyOn(globalThis, "setImmediate");
  let done = false;
  const work = (async () => {
    void (await db(ctx).run(sql(NoRows)`insert into ${table} values (${1}, ${"a"})`));
    void (await db(ctx).transaction(async (tx) => tx.run(sql(NoRows)`insert into ${table} values (${2}, ${"b"})`)));
    return db(ctx).query(sql(Row)`select id, name from ${table} order by id`);
  })().then((r) => {
    done = true;
    return r;
  });
  for (let i = 0; i < 100_000 && !done; i++) await Promise.resolve();
  expect(done).toBe(true);
  expect(timers).not.toHaveBeenCalled();
  expect(immediates).not.toHaveBeenCalled();
  expect(await work).toEqual(
    ok([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]),
  );
});

test("the accessor gives one object per ctx", () => {
  const { cap, name, table } = fresh();
  const db = notesOf(cap, name);
  const ctx = sim(cap);
  expect(db(ctx)).toBe(db(ctx));
  expect(db(ctx)).not.toBe(db(sim(cap)));
});

test("a plan step's delay waits on the sim clock; past the plan's end a call takes no delay and no fault", async () => {
  const { cap, name, table } = fresh();
  const db = notesOf(cap, name);
  const ctx = sim(cap, [{ delay: 50, fault: "none" }]);
  let first = false;
  const p = db(ctx)
    .run(sql(NoRows)`insert into ${table} values (1, 'a')`)
    .then((r) => {
      first = true;
      return r;
    });
  for (let i = 0; i < 1000; i++) await Promise.resolve();
  expect(first).toBe(false);
  ctx.clock.advance(50);
  expect(await p).toEqual(ok(1));
  for (let n = 0; n < 5; n++) expect((await db(ctx).query(sql(Row)`select id, name from ${table}`)).ok).toBe(true);
});

test("an expected error inside a transaction leaves it usable: the other statements commit", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (n) => {
      const { cap, name, table } = fresh();
      const db = notesOf(cap, name);
      const ctx = sim(cap);
      const r = await db(ctx).transaction(async (tx) => {
        for (let i = 0; i < n; i++) void (await tx.run(sql(NoRows)`insert into ${table} values (${i}, ${`n${i}`})`));
        const dup = await tx.run(sql(NoRows)`insert into ${table} values (${n}, ${"n0"})`);
        expect(dup.ok ? null : dup.error.code).toBe("postgres.constraint");
        return ok(null);
      });
      expect(r.ok).toBe(true);
      const rows = await db(ctx).query(sql(Row)`select id, name from ${table}`);
      expect(rows.ok ? rows.value.length : -1).toBe(n);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("each allow runs at its level; a blank or non-string reason, or a level name as allow, throws", async () => {
  const { cap, name } = fresh();
  const db = notesOf(cap, name);
  const ctx = sim(cap);
  const Level = s.object({ transaction_isolation: s.string() });
  const at = (opts: unknown) =>
    Reflect.apply(db(ctx).transaction, db(ctx), [
      async (tx: Tx) => tx.one(sql(Level)`show transaction_isolation`),
      opts,
    ]);
  expect(await at(undefined)).toEqual(ok({ transaction_isolation: "serializable" }));
  expect(await at({})).toEqual(ok({ transaction_isolation: "serializable" }));
  expect(await at({ allow: "write skew", reason: "r" })).toEqual(ok({ transaction_isolation: "repeatable read" }));
  expect(await at({ allow: "lost updates", reason: "r" })).toEqual(ok({ transaction_isolation: "read committed" }));
  await expect(at({ allow: "write skew", reason: "  " })).rejects.toThrow(/reason/);
  await expect(at({ allow: "write skew", reason: 3 })).rejects.toThrow(/reason/);
  await expect(at({ allow: "serializable", reason: "r" })).rejects.toThrow(/allow/);
});

test("a database error that is not expected throws its SQLSTATE and no value", async () => {
  const { cap, name, table } = fresh();
  const db = notesOf(cap, name);
  const ctx = sim(cap);
  const err = await db(ctx)
    .query(sql(Row)`select id, name from ${table} where id = ${"not-a-number-zzq"}::int`)
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(Reflect.get(Object(err), "code")).toBe("22P02");
  expect(String(err)).not.toContain("zzq");
});

const CHILD = join(import.meta.dirname, "migrate-files-child.server.ts");
const child = (url: string, cap: string, files: Record<string, string>): Promise<string> =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", CHILD, cap, JSON.stringify(files)],
      { env: { ...process.env, KEEL_POSTGRES_URL: url }, timeout: testTime(50_000) },
      (_e, stdout) => resolve(stdout.trim()),
    );
  });

test("an applied migration whose file is gone is E2454; a new file after the applied ones runs", async () => {
  const dir = tempDir("keel-pg-");
  try {
    const url = `pglite:${dir}`;
    const cap = `t.gone${process.pid}`;
    const one = { "./migrations/0001-a.sql": "create table ga (n int)" };
    const two = { ...one, "./migrations/0002-b.sql": "insert into ga values (1)" };
    expect(await child(url, cap, two)).toBe("ok 1");
    expect(await child(url, cap, one)).toMatch(/^E2454 .*0002-b.* is gone/);
    expect(await child(url, cap, { ...two, "./migrations/0003-c.sql": "insert into ga values (2)" })).toBe("ok 2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

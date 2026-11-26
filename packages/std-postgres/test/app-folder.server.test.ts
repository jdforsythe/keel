// Seed 1337. The app folder's migrations, the dev default URL and a refused connection in a transaction, beyond
// their conformance.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { foundMigrations } from "../src/server/internal/foundMigrations.server.ts";
import { postgresUrl } from "../src/server/internal/postgresUrl.server.ts";
import { refused } from "./modules/t/refused.server.ts";

const SEED = 1337;
const saved = {
  KEEL_APP_DIR: process.env.KEEL_APP_DIR,
  KEEL_DEV_DIR: process.env.KEEL_DEV_DIR,
  KEEL_POSTGRES_URL: process.env.KEEL_POSTGRES_URL,
};
const put = (k: keyof typeof saved, v: string | undefined): void => {
  if (v === undefined) Reflect.deleteProperty(process.env, k);
  else process.env[k] = v;
};
afterEach(() => {
  for (const k of ["KEEL_APP_DIR", "KEEL_DEV_DIR", "KEEL_POSTGRES_URL"] as const) put(k, saved[k]);
});

test("postgresUrl: a set URL wins; missing, KEEL_DEV_DIR gives pglite:<dir>/postgres; neither is undefined", () => {
  fc.assert(
    fc.property(
      fc.option(fc.stringMatching(/^postgres:\/\/[a-z]{1,6}@h\/[a-z]{1,6}$/), { nil: undefined }),
      fc.option(fc.stringMatching(/^\/[a-z]{1,8}(\/[a-z]{1,8})?\/?$/), { nil: undefined }),
      (url, dev) => {
        put("KEEL_POSTGRES_URL", url);
        put("KEEL_DEV_DIR", dev);
        const got = postgresUrl();
        if (url !== undefined) expect(got).toBe(url);
        else if (dev !== undefined) expect(got).toBe(`pglite:${dev.replace(/\/+$/, "")}/postgres`);
        else expect(got).toBeUndefined();
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});

test("foundMigrations reads the module's *.sql files only, keyed ./migrations/<file>; no folder is none", () => {
  const app = mkdtempSync(join(tmpdir(), "keel-found-"));
  try {
    put("KEEL_APP_DIR", app);
    expect(foundMigrations("notes.db")).toEqual({});
    const dir = join(app, "modules", "notes", "migrations");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "0001-a.sql"), "create table a (n int)");
    writeFileSync(join(dir, "README.md"), "not read");
    writeFileSync(join(dir, "0002-b.sql.bak"), "not read");
    expect(foundMigrations("notes.db")).toEqual({ "./migrations/0001-a.sql": "create table a (n int)" });
    expect(foundMigrations("other.db")).toEqual({});
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

const closedPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const a = srv.address();
      srv.close(() => (typeof a === "object" && a !== null ? resolve(a.port) : reject(new Error("no port"))));
    });
  });

test("a refused connection is keel.unreachable for run, one and transaction too, and a later call tries again", async () => {
  put("KEEL_POSTGRES_URL", `postgres://u:pw@127.0.0.1:${await closedPort()}/db`);
  const db = refused;
  const ctx = createCtx({ mode: "real", seed: SEED });
  const One = s.object({ c: s.number() });
  for (const r of [
    await db(ctx).one(sql(One)`select 1::int as c`),
    await db(ctx).transaction(async () => ok(1)),
    await db(ctx).query(sql(One)`select 1::int as c`),
  ])
    expect(r.ok ? null : r.error.code).toBe("keel.unreachable");
}, 60_000);

// The Postgres driver against a real server (std.db: "a pool of at most 10 connections, TLS as the URL's `sslmode`
// says; `commit` and `set` are one read committed transaction that takes `pg_advisory_xact_lock` for each key in sorted
// key order"). Every case but the connect timeout needs the server `KEEL_TEST_POSTGRES_URL` names and is skipped
// without it; the TLS cases also need that server to have `ssl` on.
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { isDefect } from "@keel/schema";
import type { PgPool } from "@keel/std-db/postgres";
import { postgres } from "@keel/std-db/postgres";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { DbStorage } from "../src/DbStorage.ts";
import { SEED } from "./support.server.ts";

const SERVER = process.env.KEEL_TEST_POSTGRES_URL ?? "";
const LOCK = "select pg_advisory_xact_lock(hashtextextended($1, 0))";

type Write = { readonly key: string; readonly expect: string | null; readonly value?: string };
type Settled<T> = { done: boolean; readonly result: Promise<{ ok: true; value: T } | { ok: false; error: unknown }> };

/** `p` with a flag that turns true once it settles; its rejection is held as a value, never unhandled. */
function settle<T>(p: Promise<T>): Settled<T> {
  const s: Settled<T> = {
    done: false,
    result: p.then(
      (value) => {
        s.done = true;
        return { ok: true as const, value };
      },
      (error: unknown) => {
        s.done = true;
        return { ok: false as const, error };
      },
    ),
  };
  return s;
}

/** The server URL with `params` set on its query. */
function serverUrl(params: Record<string, string> = {}): URL {
  const u = new URL(SERVER);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}

const opened: DbStorage[] = [];
const clients: pg.Client[] = [];
async function open(params: Record<string, string> = {}): Promise<DbStorage> {
  const s = await postgres(serverUrl(params));
  opened.push(s);
  return s;
}
async function admin(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: SERVER });
  await c.connect();
  clients.push(c);
  return c;
}

/** The backend pids of connections named `app` that wait on a lock. */
async function waiting(c: pg.Client, app: string): Promise<number[]> {
  const r = await c.query(
    "select pid from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock' order by pid",
    [app],
  );
  return r.rows.map((row: unknown) => Number(typeof row === "object" && row !== null ? Reflect.get(row, "pid") : 0));
}

/** Polls `probe` every 25 ms until it returns true, for at most `ms`. */
async function until(probe: () => Promise<boolean>, ms = testTime(5_000)): Promise<boolean> {
  for (let waited = 0; waited < ms; waited += 25) {
    if (await probe()) return true;
    await sleep(25);
  }
  return false;
}

afterEach(async () => {
  for (const s of opened.splice(0)) await s.close().catch(() => undefined);
  for (const c of clients.splice(0)) await c.end().catch(() => undefined);
});

describe.skipIf(SERVER === "")("postgres driver on a real server", () => {
  beforeEach(async () => {
    const c = await admin();
    await c.query("drop table if exists keel_kv, keel_meta");
  });

  test("a commit waits on another connection's advisory lock on its key, then compares against what that holder committed", async () => {
    const s = await open({ application_name: "keel-lock" });
    const holder = await admin();
    const watch = await admin();
    await holder.query("begin");
    await holder.query(LOCK, ["k"]);
    await holder.query("insert into keel_kv (key, value) values ('k', 'held')");
    const c = settle(s.commit([{ key: "k", expect: null, value: "mine" }]));
    expect(await until(async () => (await waiting(watch, "keel-lock")).length === 1)).toBe(true);
    await sleep(100);
    expect(c.done).toBe(false);
    await holder.query("commit");
    expect(await c.result).toEqual({ ok: true, value: false });
    expect(await s.get("k")).toBe("held");
  });

  test("a commit that waited on a lock whose holder rolled back compares against the value before, and writes", async () => {
    const s = await open({ application_name: "keel-lock" });
    await s.set("k", "before");
    const holder = await admin();
    const watch = await admin();
    await holder.query("begin");
    await holder.query(LOCK, ["k"]);
    await holder.query("update keel_kv set value = 'dropped' where key = 'k'");
    const c = settle(s.commit([{ key: "k", expect: "before", value: "after" }]));
    expect(await until(async () => (await waiting(watch, "keel-lock")).length === 1)).toBe(true);
    await holder.query("rollback");
    expect(await c.result).toEqual({ ok: true, value: true });
    expect(await s.get("k")).toBe("after");
  });

  test("a value one pool commits is read at once by another pool on the same database", async () => {
    const a = await open();
    const b = await open();
    for (let i = 0; i < 20; i++) {
      expect(await a.commit([{ key: "seen", expect: i === 0 ? null : String(i - 1), value: String(i) }])).toBe(true);
      expect(await b.get("seen")).toBe(String(i));
    }
  });

  test("of concurrent commits from two pools that expect the same value on one key, exactly one resolves true", async () => {
    const a = await open();
    const b = await open();
    for (let round = 0; round < 10; round++) {
      const key = `race${round}`;
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? a : b).commit([{ key, expect: null, value: `v${i}` }])),
      );
      const won = results.flatMap((r, i) => (r ? [i] : []));
      expect(won.length).toBe(1);
      expect(await a.get(key)).toBe(`v${won[0] ?? -1}`);
    }
  });

  test("two pools committing the same keys named in opposite orders never deadlock", async () => {
    const a = await open();
    const b = await open();
    for (let round = 0; round < 25; round++) {
      const one: Write[] = [
        { key: "x", expect: null, value: "a" },
        { key: "y", expect: null, value: "a" },
        { key: "z", expect: null, value: "a" },
      ];
      const two: Write[] = [
        { key: "z", expect: null, value: "b" },
        { key: "y", expect: null, value: "b" },
        { key: "x", expect: null, value: "b" },
      ];
      const r = await Promise.allSettled([a.set("x", "0"), b.set("z", "0")]);
      expect(r.every((x) => x.status === "fulfilled")).toBe(true);
      const both = await Promise.allSettled([
        a.commit(one.map((w) => ({ ...w, expect: w.key === "y" ? null : "0" }))),
        b.commit(two.map((w) => ({ ...w, expect: w.key === "y" ? null : "0" }))),
      ]);
      expect(both.map((x) => x.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(both.filter((x) => x.status === "fulfilled" && x.value).length).toBe(1);
      const c = await admin();
      await c.query("delete from keel_kv");
    }
  });

  test("generated concurrent commits from two pools leave values equal to a serial order of the ones that resolved true", async () => {
    const a = await open();
    const b = await open();
    const KEYS = ["p", "q", "r"];
    const VALUES = ["1", "2", "3"];
    const write = (key: string): fc.Arbitrary<Write> =>
      fc.record({
        key: fc.constant(key),
        expect: fc.option(fc.constantFrom(...VALUES), { nil: null }),
        value: fc.constantFrom(...VALUES),
      });
    const commit = fc.shuffledSubarray(KEYS, { minLength: 1 }).chain((ks) => fc.tuple(...ks.map(write)));
    let run = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(commit, { minLength: 2, maxLength: 5 }), async (commits) => {
        const p = `g${run++}.`;
        const results = await Promise.all(
          commits.map((c, i) => (i % 2 === 0 ? a : b).commit(c.map((w) => ({ ...w, key: p + w.key })))),
        );
        const stored = await a.read(KEYS.map((k) => p + k));
        const won = commits.filter((_, i) => results[i] === true);
        const serial = (order: readonly (readonly Write[])[]): boolean => {
          const model = new Map<string, string>();
          for (const c of order) {
            for (const w of c) if ((model.get(w.key) ?? null) !== w.expect) return false;
            for (const w of c) if (w.value !== undefined) model.set(w.key, w.value);
          }
          return KEYS.every((k, i) => (model.get(k) ?? null) === stored[i]);
        };
        expect(permutations(won).some(serial)).toBe(true);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("a pool holds at most 10 connections; commits past 10 wait for one and then finish", async () => {
    const s = await open({ application_name: "keel-cap" });
    const holder = await admin();
    const watch = await admin();
    await holder.query("begin");
    await holder.query(LOCK, ["cap"]);
    const commits = Array.from({ length: 15 }, (_, i) =>
      settle(s.commit([{ key: "cap", expect: null, value: `v${i}` }])),
    );
    expect(await until(async () => (await waiting(watch, "keel-cap")).length === 10)).toBe(true);
    await sleep(300);
    const r = await watch.query("select count(*)::int as n from pg_stat_activity where application_name = 'keel-cap'");
    expect(r.rows[0]?.n).toBe(10);
    expect(commits.some((c) => c.done)).toBe(false);
    await holder.query("rollback");
    const done = await Promise.all(commits.map((c) => c.result));
    expect(done.every((d) => d.ok)).toBe(true);
    expect(done.filter((d) => d.ok && d.value).length).toBe(1);
  });

  test("a connection terminated while a commit waits on a lock rejects that commit, and the pool goes on", async () => {
    const s = await open({ application_name: "keel-lost" });
    const holder = await admin();
    const watch = await admin();
    await holder.query("begin");
    await holder.query(LOCK, ["lost"]);
    const c = settle(s.commit([{ key: "lost", expect: null, value: "never" }]));
    expect(await until(async () => (await waiting(watch, "keel-lost")).length === 1)).toBe(true);
    const [pid] = await waiting(watch, "keel-lost");
    await watch.query("select pg_terminate_backend($1)", [pid]);
    const r = await c.result;
    expect(r.ok).toBe(false);
    const failure: unknown = r.ok ? undefined : r.error;
    expect(isDefect(failure)).toBe(true);
    expect(failure instanceof Error ? failure.message : "").toMatch(/^std\.db postgres: commit failed \(57P01\)$/);
    await holder.query("rollback");
    expect(await s.get("lost")).toBeNull();
    expect(await s.commit([{ key: "lost", expect: null, value: "next" }])).toBe(true);
    expect(await s.get("lost")).toBe("next");
  });

  test("a connection terminated after the upsert and before COMMIT rejects the commit and stores nothing", async () => {
    const real = new pg.Pool({ connectionString: serverUrl({ application_name: "keel-cut" }).href, max: 10 });
    real.on("error", () => undefined);
    real.on("connect", (client) => {
      client.on("error", () => undefined);
    });
    const watch = await admin();
    let armed = false;
    let cut = false;
    const pool: PgPool = {
      query: (text, values) => real.query(text, values === undefined ? undefined : [...values]),
      end: () => real.end(),
      connect: async () => {
        const c = await real.connect();
        return {
          release: (destroy) => c.release(destroy),
          query: async (text, values) => {
            if (text === "commit" && armed && !cut) {
              cut = true;
              await watch.query(
                "select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'keel-cut' and state = 'idle in transaction'",
              );
            }
            return c.query(text, values === undefined ? undefined : [...values]);
          },
        };
      },
    };
    const s = await postgres(serverUrl(), { clientFactory: () => pool });
    opened.push(s);
    armed = true;
    await expect(s.commit([{ key: "cut", expect: null, value: "lost" }])).rejects.toThrow(
      /^std\.db postgres: commit failed \(/,
    );
    const r = await watch.query("select count(*)::int as n from keel_kv where key = 'cut'");
    expect(r.rows[0]?.n).toBe(0);
    expect(await s.commit([{ key: "cut", expect: null, value: "kept" }])).toBe(true);
    expect(await s.get("cut")).toBe("kept");
  });

  test("a wrong password rejects E2153 naming KEEL_DATABASE_URL and no part of the URL", async () => {
    const u = serverUrl();
    u.password = "wrongsecretword";
    const e = await postgres(u).then(
      () => null,
      (x: unknown) => x,
    );
    const text = String(e);
    expect(isDefect(e, "E2153")).toBe(true);
    expect(text).toMatch(/E2153 KEEL_DATABASE_URL/);
    for (const part of ["wrongsecretword", u.username, u.port, u.pathname.slice(1)]) expect(text).not.toContain(part);
  });
});

describe.skipIf(SERVER === "")("postgres driver over TLS", () => {
  const sslOn = async (): Promise<boolean> => {
    const c = await admin();
    const r = await c.query("show ssl");
    return r.rows[0]?.ssl === "on";
  };
  const sslOf = async (app: string): Promise<boolean | null> => {
    const c = await admin();
    const r = await c.query(
      "select s.ssl from pg_stat_ssl s join pg_stat_activity a using (pid) where a.application_name = $1 limit 1",
      [app],
    );
    const v: unknown = r.rows[0]?.ssl;
    return typeof v === "boolean" ? v : null;
  };

  test("sslmode=no-verify connects encrypted and sslmode=disable connects in the clear", async (ctx) => {
    if (!(await sslOn())) ctx.skip();
    const enc = await open({ sslmode: "no-verify", application_name: "keel-tls" });
    await enc.set("tls", "1");
    expect(await sslOf("keel-tls")).toBe(true);
    const plain = await open({ sslmode: "disable", application_name: "keel-plain" });
    await plain.get("tls");
    expect(await sslOf("keel-plain")).toBe(false);
  });

  test("sslmode=verify-full refuses a server whose certificate it cannot verify, as E2153", async (ctx) => {
    if (!(await sslOn())) ctx.skip();
    await expect(postgres(serverUrl({ sslmode: "verify-full" }))).rejects.toThrow(/^E2153 KEEL_DATABASE_URL/);
  });

  // libpq's sslmode=require encrypts without verifying the certificate; `pg` 8 verifies it as verify-full does.
  test.fails("sslmode=require connects encrypted to a server with a self-signed certificate", async (ctx) => {
    if (!(await sslOn())) ctx.skip();
    const s = await open({ sslmode: "require" });
    expect(await s.get("tls")).toBeNull();
  });
});

// The driver's own 10 s connect timeout is waited out in full, then 20 s bounds the server and the work around it.
test(
  "a server that accepts and never answers rejects E2153 after the 10 s connect timeout",
  async () => {
    const sockets: { destroy(): void }[] = [];
    const silent = createServer((socket) => {
      sockets.push(socket);
    });
    await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
    const a = silent.address();
    const port = typeof a === "object" && a !== null ? a.port : 0;
    try {
      const e = await postgres(new URL(`postgres://u:p@127.0.0.1:${port}/d?sslmode=disable`)).then(
        () => null,
        (x: unknown) => x,
      );
      expect(isDefect(e, "E2153")).toBe(true);
      expect(String(e)).toMatch(/E2153 KEEL_DATABASE_URL/);
    } finally {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  },
  fixedTime(10_000) + testTime(20_000),
);

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

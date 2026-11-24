// Spec: std.db, Conformance "On Postgres 17, with drivers A and B open on one database and a `watch` on B resolved, a `commit` through A storing `keel.store.s` gives B's `on` `{ kind: 'committed', keys: ['keel.store.s'] }`; a `commit` through B storing `keel.store.s` gives it nothing."
// Spec: std.db, Conformance "On Postgres 17, a `commit` through A storing 400 keys `keel.store.<id>`, each `<id>` 40 characters, gives B's `on` reports whose `keys` together are those 400 keys, each once, in sorted order, and each `keel_storage` notification payload is at most 7,900 bytes."
// Spec: std.db, Conformance "On Postgres 17, terminating the backend whose `application_name` is `keel-storage-<pid>` reports `lost` once to each of B's open watches; B's next `watch` opens a new connection and gets the next commit's report."
// Spec: std.db, Conformance "On Postgres 17, no `keel_storage` notification payload holds a stored value, and before any `watch` a driver holds no connection outside its pool."
// Spec: std.db, Conformance "`sqlite(url)`'s storage has no `watch`."
// Seed: 1337.
// Assumption: Postgres 17 runs only when `KEEL_TEST_POSTGRES_URL` is set (the std-postgres and std-db precedent; CI's postgres job sets it), through `makeRig("postgres")`, which opens drivers on that server and drops the keel tables first. PGlite has one connection and no `LISTEN` across drivers, so these cases skip without the variable; the sqlite case always runs.
// Assumption: `<pid>` is this test process's `process.pid`; backends are looked up and terminated by an admin `pg` client outside the drivers. Notification payloads are read by a second admin client that runs `LISTEN keel_storage`.
// Assumption: a "report" is one call of `on`; "nothing" is shown by a later sentinel commit through A whose report is the first and only one that arrives (reports follow commits in order).
// Assumption: A and B are two drivers opened in this one process, so "the process's own commits dropped" is a per-driver token here: A's commit is reported to B, B's own is not reported to B.
// Wait loops count event-loop turns (no clock, no timer).
import { createCtx } from "@keel/ctx";
import type { KeyValueStorage } from "@keel/ctx";
import fc from "fast-check";
import pg from "pg";
import { afterEach, describe, expect, test } from "vitest";
import { type Rig, SEED, makeRig } from "./fixtures.ts";

const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";
const hasPg17 = PG17 !== "";

const turn = (): Promise<void> => new Promise<void>((r) => setImmediate(r));
async function until(pred: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 200_000; i++) {
    if (pred()) return;
    await turn();
  }
  throw new Error(`waited for ${what}`);
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 300; i++) await turn();
};

type Report = unknown;
async function watching(storage: unknown): Promise<{ reports: Report[]; stop: () => void }> {
  const f: unknown = Reflect.get(Object(storage), "watch");
  if (typeof f !== "function") throw new Error("the storage has no watch");
  const reports: Report[] = [];
  const stop: unknown = await Reflect.apply(f, storage, [(e: Report) => reports.push(e)]);
  if (typeof stop !== "function") throw new Error("watch did not resolve a stop function");
  return { reports, stop: () => void Reflect.apply(stop, undefined, []) };
}
const committed = (reports: readonly Report[]): string[][] =>
  reports.flatMap((r) => {
    const keys: unknown = typeof r === "object" && r !== null ? Reflect.get(r, "keys") : undefined;
    return Array.isArray(keys) ? [keys.map(String)] : [];
  });
const kindOf = (r: Report): unknown => (typeof r === "object" && r !== null ? Reflect.get(r, "kind") : undefined);

const rigs: Rig[] = [];
const clients: pg.Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.end();
  for (const r of rigs.splice(0)) await r.stop();
});

async function pair(): Promise<{ A: KeyValueStorage; B: KeyValueStorage }> {
  const r = await makeRig("postgres");
  rigs.push(r);
  return { A: await r.open(), B: await r.open() };
}
async function admin(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: PG17 });
  await c.connect();
  clients.push(c);
  return c;
}
/** An admin client listening on `keel_storage`; `payloads` are the notification texts in arrival order. */
async function sniff(): Promise<{ payloads: string[] }> {
  const c = await admin();
  const payloads: string[] = [];
  c.on("notification", (m) => {
    if (m.channel === "keel_storage" && m.payload !== undefined) payloads.push(m.payload);
  });
  await c.query("LISTEN keel_storage");
  return { payloads };
}
const listenerCount = async (c: pg.Client): Promise<number> => {
  const r = await c.query("select count(*)::int as n from pg_stat_activity where application_name = $1", [
    `keel-storage-${process.pid}`,
  ]);
  const n: unknown = r.rows[0]?.n;
  return typeof n === "number" ? n : -1;
};

describe.skipIf(!hasPg17)("postgres 17", () => {
  test("with drivers A and B open on one database and a `watch` on B resolved, a `commit` through A storing `keel.store.s` gives B's `on` `{ kind: 'committed', keys: ['keel.store.s'] }`", async () => {
    const { A, B } = await pair();
    const w = await watching(B);
    expect(await A.commit([{ key: "keel.store.s", expect: null, value: "v" }])).toBe(true);
    await until(() => w.reports.length >= 1, "B's report");
    await settle();
    expect(w.reports).toEqual([{ kind: "committed", keys: ["keel.store.s"] }]);
    w.stop();
  });

  test("a `commit` through B storing `keel.store.s` gives B's `on` nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<"A" | "B">("A", "B"), { minLength: 1, maxLength: 6 }),
        fc.hexaString({ minLength: 6, maxLength: 12 }),
        async (sides, tag) => {
          const { A, B } = await pair();
          const w = await watching(B);
          const expected: string[][] = [];
          for (const [i, side] of sides.entries()) {
            const key = `keel.store.s${i}${tag}`;
            expect(await (side === "A" ? A : B).commit([{ key, expect: null, value: "v" }])).toBe(true);
            if (side === "A") expected.push([key]);
          }
          // Sentinel: a later commit through A; its report is the last one to arrive.
          expect(await A.commit([{ key: "keel.store.sentinel", expect: null, value: "v" }])).toBe(true);
          expected.push(["keel.store.sentinel"]);
          await until(() => w.reports.length >= expected.length, "B's reports");
          await settle();
          expect(committed(w.reports)).toEqual(expected);
          expect(w.reports.filter((r) => kindOf(r) !== "committed")).toEqual([]);
          w.stop();
        },
      ),
      { seed: SEED, numRuns: 3 },
    );
  });

  test("a `commit` through A storing 400 keys `keel.store.<id>`, each `<id>` 40 characters, gives B's `on` reports whose `keys` together are those 400 keys, each once, in sorted order, and each `keel_storage` notification payload is at most 7,900 bytes", async () => {
    const idArb = fc.stringMatching(/^[a-z0-9]{40}$/);
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(idArb, { minLength: 400, maxLength: 400 }), async (ids) => {
        const { A, B } = await pair();
        const sniffed = await sniff();
        const w = await watching(B);
        const keys = ids.map((id) => `keel.store.${id}`);
        expect(await A.commit(keys.map((key) => ({ key, expect: null, value: "v" })))).toBe(true);
        const sorted = [...keys].sort();
        await until(() => committed(w.reports).flat().length >= sorted.length, "B's reports");
        await settle();
        expect(committed(w.reports).flat()).toEqual(sorted);
        expect(sniffed.payloads.length).toBeGreaterThanOrEqual(2);
        for (const p of sniffed.payloads) expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(7900);
        w.stop();
      }),
      { seed: SEED, numRuns: 2 },
    );
  });

  test("terminating the backend whose `application_name` is `keel-storage-<pid>` reports `lost` once to each of B's open watches", async () => {
    const { A, B } = await pair();
    const killer = await admin();
    const w1 = await watching(B);
    const w2 = await watching(B);
    expect(await listenerCount(killer)).toBeGreaterThanOrEqual(1);
    await killer.query("select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1", [
      `keel-storage-${process.pid}`,
    ]);
    await until(() => w1.reports.length >= 1 && w2.reports.length >= 1, "lost on both watches");
    await settle();
    expect(w1.reports).toEqual([{ kind: "lost" }]);
    expect(w2.reports).toEqual([{ kind: "lost" }]);
    // Nothing is reported to a lost watch after it.
    expect(await A.commit([{ key: "keel.store.after-lost", expect: null, value: "v" }])).toBe(true);
    await settle();
    expect(w1.reports).toEqual([{ kind: "lost" }]);
  });

  test("B's next `watch` after a loss opens a new connection and gets the next commit's report", async () => {
    const { A, B } = await pair();
    const killer = await admin();
    const w1 = await watching(B);
    await killer.query("select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1", [
      `keel-storage-${process.pid}`,
    ]);
    await until(() => w1.reports.length >= 1, "lost");
    const w2 = await watching(B);
    expect(await listenerCount(killer)).toBeGreaterThanOrEqual(1);
    expect(await A.commit([{ key: "keel.store.next", expect: null, value: "v" }])).toBe(true);
    await until(() => w2.reports.length >= 1, "the next commit's report");
    await settle();
    expect(w2.reports).toEqual([{ kind: "committed", keys: ["keel.store.next"] }]);
    w2.stop();
  });

  test("no `keel_storage` notification payload holds a stored value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.hexaString({ minLength: 10, maxLength: 24 }).map((h) => `sk_live_${h}`),
          { minLength: 1, maxLength: 5 },
        ),
        async (secrets) => {
          const { A, B } = await pair();
          const sniffed = await sniff();
          const w = await watching(B);
          for (const [i, v] of secrets.entries()) {
            expect(await A.commit([{ key: `keel.store.p${i}`, expect: null, value: v }])).toBe(true);
          }
          await until(() => w.reports.length >= secrets.length, "B's reports");
          await settle();
          expect(sniffed.payloads.length).toBeGreaterThanOrEqual(secrets.length);
          for (const p of sniffed.payloads) {
            const parsed: unknown = JSON.parse(p);
            expect(Object.keys(Object(parsed)).sort()).toEqual(["k", "o"]);
            for (const v of secrets) expect(p.includes(v)).toBe(false);
          }
          for (const r of w.reports) for (const v of secrets) expect(JSON.stringify(r).includes(v)).toBe(false);
          w.stop();
        },
      ),
      { seed: SEED, numRuns: 4 },
    );
  });

  test("before any `watch` a driver holds no connection outside its pool", async () => {
    const r = await makeRig("postgres");
    rigs.push(r);
    const c = await admin();
    const A = await r.open();
    const B = await r.open();
    expect(await A.commit([{ key: "keel.store.q", expect: null, value: "v" }])).toBe(true);
    expect(await B.get("keel.store.q")).toBe("v");
    expect(await listenerCount(c)).toBe(0);
    const w = await watching(B);
    expect(await listenerCount(c)).toBeGreaterThanOrEqual(1);
    w.stop();
  });
});

describe("sqlite", () => {
  test("`sqlite(url)`'s storage has no `watch`", async () => {
    const r = await makeRig("sqlite");
    rigs.push(r);
    const storage = await r.open();
    expect(Reflect.get(Object(storage), "watch")).toBeUndefined();
    // The ctx that carries it says the same.
    const ctx = createCtx({ mode: "real", drivers: { storage } });
    expect(Reflect.get(Object(ctx.storage), "watch")).toBeUndefined();
  });
});

// Spec: std.postgres, API "`transaction(fn, { allow?, reason? })`: ... in one `serializable` transaction: committed ones have the effect of some serial order: no lost update, no write skew. ... A serialization failure or deadlock runs `fn` again, at most 3 runs, then is `keel.conflict`, nothing committed"
// Spec: std.postgres, API "`'write skew'` runs at `repeatable read` ..., `'lost updates'` at `read committed` (a value read, then written back, can overwrite another's write). ... A lone `query`, `one` or `run` is its own `serializable` transaction, rerun as `fn` is"
// Spec: std.postgres, Modes "each run of a lone statement or of `fn` takes one step".
// Racing writes on one row, three ways: sim with planned conflicts, PGlite with concurrent callers, and Postgres 17 where
// `KEEL_TEST_POSTGRES_URL` is set. On Postgres 17 the callers interleave for real: each run of `fn` waits after its read
// until every caller has read (a barrier released by the callers, no timer). PGlite has one session, so its
// transactions run one after another and the race reduces to serial order; the documented outcome is the same.
// Seed: 1337.
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import type { Result } from "@keel/schema";
import { NoRows, fragment, sql } from "@keel/std-postgres";
import type { TransactionOptions } from "@keel/std-postgres/server";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SEED = 1337;
const PG17 = process.env.KEEL_TEST_POSTGRES_URL ?? "";
const RUN = randomBytes(4).toString("hex");
let counter = 0;

// `ready()` loads the PGlite engine (its WebAssembly and initdb): about 1.5 s here, over 10 s on a slow runner, so the
// hook states 60 s, the bound the apps give a PGlite folder's first open.
beforeAll(async () => {
  await ready();
}, 60_000);

const tpl = (parts: string[]): TemplateStringsArray => Object.assign([...parts], { raw: [...parts] });
const name = (text: string) => fragment(tpl([text]));

type Step = { delay: number; fault: "none" | "unavailable" | "conflict" };
const N: Step = { delay: 0, fault: "none" };
const C: Step = { delay: 0, fault: "conflict" };
const HELD: Step = { delay: 10, fault: "none" };
const none = (n: number): Step[] => Array.from({ length: n }, () => N);

/** One race's tables: a counter row, two doctors on call, and recipes with a unique title. */
function fresh() {
  counter += 1;
  const t = `r_${RUN}_${counter}_${process.pid}`;
  const cap = `t.race${RUN}n${counter}`;
  const db = database(cap, {
    migrations: {
      "./migrations/0001-race.sql": [
        `create table ${t}_counter (id int primary key, n int not null)`,
        `insert into ${t}_counter values (1, 0)`,
        `create table ${t}_doctor (id int primary key, on_call boolean not null)`,
        `insert into ${t}_doctor values (1, true), (2, true)`,
        `create table ${t}_recipe (id int primary key, title text not null constraint ${t}_title_key unique)`,
      ].join(";\n"),
    },
  });
  return {
    cap,
    db,
    counter: name(`${t}_counter`),
    doctor: name(`${t}_doctor`),
    recipe: name(`${t}_recipe`),
    titleKey: `${t}_title_key`,
  };
}
type Tables = ReturnType<typeof fresh>;

/** Where the callers run: each caller gets its own ctx in real modes; under sim they share one (one schema per sim ctx). */
type Mode = {
  readonly name: string;
  readonly interleaves: boolean;
  ctxs(cap: string, callers: number, plan?: Step[]): Ctx[];
};

function realMode(label: string, url: () => string, interleaves: boolean): Mode & { done(): void } {
  const dir = mkdtempSync(join(tmpdir(), "keel-race-"));
  const before = process.env.KEEL_POSTGRES_URL;
  return {
    name: label,
    interleaves,
    ctxs(_cap, callers) {
      process.env.KEEL_POSTGRES_URL = url().replace("<dir>", dir);
      return Array.from({ length: callers }, () => createCtx({ mode: "real", seed: SEED }));
    },
    done() {
      if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
      else process.env.KEEL_POSTGRES_URL = before;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const simMode: Mode = {
  name: "sim",
  interleaves: false,
  ctxs(cap, callers, plan = none(200)) {
    const ctx = createCtx({
      mode: "sim",
      seed: SEED,
      schedule: { net: [], storage: [], offline: [], plans: { [cap]: plan } },
    });
    return Array.from({ length: callers }, () => ctx);
  },
};

/**
 * A barrier for `count` callers' first runs: `arrive()` resolves once all have arrived. Later runs (reruns) pass at
 * once, so a rerun never waits for a caller that already finished.
 */
function barrier(count: number, on: boolean) {
  let arrived = 0;
  let open: () => void = () => undefined;
  const all = new Promise<void>((r) => {
    open = r;
  });
  return async (first: boolean): Promise<void> => {
    if (!on || !first) return;
    arrived += 1;
    if (arrived >= count) open();
    await all;
  };
}

const Counter = s.object({ n: s.int() });
const Count = s.object({ c: s.int() });
const Title = s.object({ id: s.int(), title: s.string() });

function okOf<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw new Error(`expected ok, got err ${JSON.stringify(r.error)}`);
  return r.value;
}

/** Read the counter, then write read + 1: the lost-update shape. */
async function increment(
  x: Tables,
  ctx: Ctx,
  opts: TransactionOptions | undefined,
  wait: (first: boolean) => Promise<void>,
) {
  let runs = 0;
  const r = await x.db(ctx).transaction(async (tx) => {
    runs += 1;
    const read = await tx.one(sql(Counter)`select n from ${x.counter} where id = 1`);
    if (!read.ok) return read;
    await wait(runs === 1);
    const w = await tx.run(sql(NoRows)`update ${x.counter} set n = ${read.value.n + 1} where id = 1`);
    return w.ok ? ok(read.value.n + 1) : w;
  }, opts);
  return { r, runs };
}

/** A doctor goes off call when another is on call: the write-skew shape (the invariant is one on call at least). */
async function goOffCall(
  x: Tables,
  ctx: Ctx,
  id: number,
  opts: TransactionOptions | undefined,
  wait: (first: boolean) => Promise<void>,
) {
  let runs = 0;
  const r = await x.db(ctx).transaction(async (tx) => {
    runs += 1;
    const on = await tx.one(sql(Count)`select count(*)::int as c from ${x.doctor} where on_call`);
    if (!on.ok) return on;
    await wait(runs === 1);
    if (on.value.c < 2) return ok(false);
    const w = await tx.run(sql(NoRows)`update ${x.doctor} set on_call = false where id = ${id}`);
    return w.ok ? ok(true) : w;
  }, opts);
  return { r, runs };
}

/** Insert a recipe after checking its title is free: the unique-violation race. */
async function addRecipe(x: Tables, ctx: Ctx, id: number, title: string, wait: (first: boolean) => Promise<void>) {
  let runs = 0;
  const r = await x.db(ctx).transaction(async (tx) => {
    runs += 1;
    const taken = await tx.query(sql(Title)`select id, title from ${x.recipe} where title = ${title}`);
    if (!taken.ok) return taken;
    await wait(runs === 1);
    return tx.run(sql(NoRows)`insert into ${x.recipe} (id, title) values (${id}, ${title})`);
  });
  return { r, runs };
}

const SKEW: TransactionOptions = { allow: "write skew", reason: "the race under test" };
const LOST: TransactionOptions = { allow: "lost updates", reason: "the race under test" };

const codeOf = <T, E extends { code: string }>(r: Result<T, E>): string => (r.ok ? "ok" : r.error.code);

const pglite = realMode("pglite", () => "pglite:<dir>", false);
const pg17 = PG17 === "" ? null : realMode("postgres 17", () => PG17, true);
const MODES: Mode[] = [simMode, pglite, ...(pg17 === null ? [] : [pg17])];

afterAll(() => {
  pglite.done();
  pg17?.done();
});

for (const m of MODES) {
  describe(`racing writes on ${m.name}`, () => {
    for (const [label, opts] of [
      ["the default serializable", undefined],
      ["allow 'write skew' (repeatable read)", SKEW],
    ] as const) {
      test(`lost update at ${label}: every increment that answers ok is counted, a loser reruns or is keel.conflict`, async () => {
        const x = fresh();
        const callers = 2;
        const ctxs = m.ctxs(x.cap, callers);
        const wait = barrier(callers, m.interleaves);
        const out = await Promise.all(ctxs.map((ctx) => increment(x, ctx, opts, wait)));
        const oks = out.filter((o) => o.r.ok).length;
        for (const o of out) {
          expect(["ok", "keel.conflict"]).toContain(codeOf(o.r));
          expect(o.runs).toBeLessThanOrEqual(3);
        }
        const [first] = ctxs;
        if (first === undefined) throw new Error("no caller");
        expect(okOf(await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`)).n).toBe(oks);
        expect(oks).toBe(callers);
        // On a server the two first runs read the same row: one of them is rerun.
        if (m.interleaves) expect(out.reduce((a, o) => a + o.runs, 0)).toBeGreaterThan(callers);
      });
    }

    // `allow: 'lost updates'` runs at read committed, where Postgres raises no serialization failure: a read then a
    // write of read + 1 from two interleaved callers both answer ok and one increment is lost. Only a server
    // interleaves them.
    test.runIf(m.interleaves)(
      "lost update with allow 'lost updates' (read committed): both answer ok and the counter is 1",
      async () => {
        const x = fresh();
        const ctxs = m.ctxs(x.cap, 2);
        const wait = barrier(2, true);
        const out = await Promise.all(ctxs.map((ctx) => increment(x, ctx, LOST, wait)));
        expect(out.map((o) => codeOf(o.r))).toEqual(["ok", "ok"]);
        const [first] = ctxs;
        if (first === undefined) throw new Error("no caller");
        expect(okOf(await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`)).n).toBe(1);
      },
    );

    test("allow 'lost updates' with `set n = n + 1` in one statement: no increment is lost", async () => {
      const x = fresh();
      const callers = 4;
      const ctxs = m.ctxs(x.cap, callers);
      const out = await Promise.all(
        ctxs.map((ctx) =>
          x
            .db(ctx)
            .transaction(async (tx) => tx.run(sql(NoRows)`update ${x.counter} set n = n + 1 where id = 1`), LOST),
        ),
      );
      for (const r of out) expect(codeOf(r)).toBe("ok");
      const [first] = ctxs;
      if (first === undefined) throw new Error("no caller");
      expect(okOf(await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`)).n).toBe(callers);
    });

    test.runIf(m.interleaves)(
      "write skew with allow 'write skew' (repeatable read): both go off call and none is left",
      async () => {
        const x = fresh();
        const ctxs = m.ctxs(x.cap, 2);
        const wait = barrier(2, true);
        const out = await Promise.all(ctxs.map((ctx, i) => goOffCall(x, ctx, i + 1, SKEW, wait)));
        expect(out.map((o) => codeOf(o.r))).toEqual(["ok", "ok"]);
        const [first] = ctxs;
        if (first === undefined) throw new Error("no caller");
        const on = okOf(await x.db(first).one(sql(Count)`select count(*)::int as c from ${x.doctor} where on_call`));
        expect(on.c).toBe(0);
      },
    );

    test("write skew at the default serializable: one doctor stays on call", async () => {
      const x = fresh();
      const ctxs = m.ctxs(x.cap, 2);
      const wait = barrier(2, m.interleaves);
      const out = await Promise.all(ctxs.map((ctx, i) => goOffCall(x, ctx, i + 1, undefined, wait)));
      for (const o of out) expect(["ok", "keel.conflict"]).toContain(codeOf(o.r));
      const [first] = ctxs;
      if (first === undefined) throw new Error("no caller");
      const on = okOf(await x.db(first).one(sql(Count)`select count(*)::int as c from ${x.doctor} where on_call`));
      expect(on.c).toBe(1);
      expect(out.filter((o) => o.r.ok && o.r.value).length).toBe(1);
    });

    test("unique violation: two callers add the same title; one commits, the other is postgres.constraint naming the key", async () => {
      const x = fresh();
      const ctxs = m.ctxs(x.cap, 2);
      const wait = barrier(2, m.interleaves);
      const out = await Promise.all(ctxs.map((ctx, i) => addRecipe(x, ctx, i + 1, "Lentil soup", wait)));
      const codes = out.map((o) => codeOf(o.r)).sort();
      expect(codes).toEqual(["ok", "postgres.constraint"]);
      // At serializable Postgres answers a check-then-insert that a concurrent insert breaks with 40001, so the loser
      // runs once more and its insert is then the unique violation.
      for (const o of out) {
        expect(o.runs).toBeLessThanOrEqual(2);
        if (!o.r.ok) expect(o.r.error.data).toEqual({ constraint: x.titleKey, kind: "unique" });
      }
      const [first] = ctxs;
      if (first === undefined) throw new Error("no caller");
      const rows = okOf(await x.db(first).query(sql(Title)`select id, title from ${x.recipe}`));
      expect(rows.map((r) => r.title)).toEqual(["Lentil soup"]);
    });

    test("unique violation outside a transaction: one insert counts 1, the other is postgres.constraint", async () => {
      const x = fresh();
      const ctxs = m.ctxs(x.cap, 2);
      const out = await Promise.all(
        ctxs.map((ctx, i) =>
          x.db(ctx).run(sql(NoRows)`insert into ${x.recipe} (id, title) values (${i + 1}, ${"Dal"})`),
        ),
      );
      expect(out.map((r) => codeOf(r)).sort()).toEqual(["ok", "postgres.constraint"]);
    });
  });
}

describe("racing writes on sim with planned conflicts", () => {
  test("two increments, the first run of one planned to conflict: it reruns and both are counted", async () => {
    const x = fresh();
    const ctxs = simMode.ctxs(x.cap, 2, [C, N, N, ...none(10)]);
    const out = await Promise.all(ctxs.map((ctx) => increment(x, ctx, undefined, async () => undefined)));
    expect(out.map((o) => codeOf(o.r))).toEqual(["ok", "ok"]);
    expect(out.reduce((a, o) => a + o.runs, 0)).toBe(3);
    const [first] = ctxs;
    if (first === undefined) throw new Error("no caller");
    expect(okOf(await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`)).n).toBe(2);
  });

  test("two callers each a lone read then a lone write of read + 1, held by plan delays, lose one; in transactions, none", async () => {
    const run = async (inTx: boolean): Promise<number> => {
      const x = fresh();
      const ctx = createCtx({
        mode: "sim",
        seed: SEED,
        schedule: { net: [], storage: [], offline: [], plans: { [x.cap]: Array.from({ length: 8 }, () => HELD) } },
      });
      const lone = async () => {
        const r = okOf(await x.db(ctx).one(sql(Counter)`select n from ${x.counter} where id = 1`));
        return x.db(ctx).run(sql(NoRows)`update ${x.counter} set n = ${r.n + 1} where id = 1`);
      };
      const inOne = () => increment(x, ctx, undefined, async () => undefined).then((o) => o.r);
      /** Advances the sim clock to each pending plan delay until `p` settles. */
      const drive = async <T>(p: Promise<T>): Promise<T> => {
        let settled = false;
        const done = p.finally(() => {
          settled = true;
        });
        for (let i = 0; i < 1000 && !settled; i++) {
          await new Promise((r) => setImmediate(r));
          const next = ctx.clock.next();
          if (next !== null) ctx.clock.advance(next - ctx.clock.now());
        }
        return done;
      };
      for (const r of await drive(Promise.all([inTx ? inOne() : lone(), inTx ? inOne() : lone()]))) okOf(r);
      return okOf(await drive(x.db(ctx).one(sql(Counter)`select n from ${x.counter} where id = 1`))).n;
    };
    expect(await run(false)).toBe(1);
    expect(await run(true)).toBe(2);
  });

  test("a lone write planned to conflict once reruns and lands; three times is keel.conflict and changes nothing", async () => {
    const x = fresh();
    const [ctx] = simMode.ctxs(x.cap, 1, [C, N, C, C, C, ...none(5)]);
    if (ctx === undefined) throw new Error("no caller");
    expect(codeOf(await x.db(ctx).run(sql(NoRows)`update ${x.counter} set n = n + 5 where id = 1`))).toBe("ok");
    expect(codeOf(await x.db(ctx).run(sql(NoRows)`update ${x.counter} set n = n + 5 where id = 1`))).toBe(
      "keel.conflict",
    );
    expect(okOf(await x.db(ctx).one(sql(Counter)`select n from ${x.counter} where id = 1`)).n).toBe(5);
  });

  test("for generated plans over three racing increments, the counter equals the increments that answered ok", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(C, N), { minLength: 0, maxLength: 9 }), async (plan) => {
        const x = fresh();
        const ctxs = simMode.ctxs(x.cap, 3, [...plan, ...none(20)]);
        const out = await Promise.all(ctxs.map((ctx) => increment(x, ctx, SKEW, async () => undefined)));
        for (const o of out) {
          expect(["ok", "keel.conflict"]).toContain(codeOf(o.r));
          expect(o.runs).toBeLessThanOrEqual(3);
          // A caller that answered keel.conflict ran `fn` three times.
          if (!o.r.ok) expect(o.runs).toBe(3);
        }
        const [first] = ctxs;
        if (first === undefined) throw new Error("no caller");
        // The check's own read takes a plan step per run; three planned conflicts there are keel.conflict, so it reads again.
        let read = await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`);
        for (let i = 0; i < 10 && !read.ok && read.error.code === "keel.conflict"; i++)
          read = await x.db(first).one(sql(Counter)`select n from ${x.counter} where id = 1`);
        const n = okOf(read).n;
        expect(n).toBe(out.filter((o) => o.r.ok).length);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

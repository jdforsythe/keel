// Seed 1337. The database object over a scripted engine: which engine call a statement takes, savepoints, reruns,
// the errors a driver throws as answers, type reloads, the plan's steps, and the changes a committed run delivers.
import { createCtx } from "@keel/ctx";
import { err, isDefect, ok, s } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import fc from "fast-check";
import { expect, test, vi } from "vitest";
import type { Backend } from "../src/server/internal/Backend.ts";
import type { Conn } from "../src/server/internal/Conn.ts";
import type { Engine } from "../src/server/internal/Engine.ts";
import type { Raw } from "../src/server/internal/Raw.ts";
import { TypeCache } from "../src/server/internal/TypeCache.server.ts";
import { makeDatabase } from "../src/server/internal/makeDatabase.server.ts";

const SEED = 1337;
const TEXT = 25;
const INT4 = 23;
const LOAD = "select oid::int8::text, typelem::int8::text, typdelim::text, typcategory::text from pg_type";
const NEW_OID = 90_001;

const Row = s.object({ id: s.int(), name: s.string() });
const rows = (...rs: [number, string][]): Raw => ({
  fields: [
    { name: "id", oid: INT4 },
    { name: "name", oid: TEXT },
  ],
  rows: rs.map(([id, name]) => [String(id), name]),
  count: rs.length,
});
const none: Raw = { fields: [], rows: [], count: 0 };
const pgError = (code: string, extra: Record<string, string> = {}) =>
  Object.assign(new Error(`driver ${code}`), { code, severity: "ERROR", ...extra });

/** What the scripted engine answers to a statement's text: a value, or a throw. */
type Answer = (text: string, attempt: number) => Raw;

/** A scripted engine and backend that log every call: `s` a pooled statement, `q` a query, `x` an exec. */
function scripted(answer: Answer, opts: { pooled?: boolean; txThrows?: (attempt: number) => unknown } = {}) {
  const log: string[] = [];
  const committed: string[][] = [];
  const types = new TypeCache();
  types.known.add(TEXT);
  types.known.add(INT4);
  let attempts = 0;
  let txs = 0;
  const reply = (text: string): Raw => {
    if (text === LOAD)
      return {
        fields: [],
        rows: [
          [String(TEXT), "0", ",", "S"],
          [String(NEW_OID), "0", ",", "U"],
        ],
        count: 2,
      };
    attempts += 1;
    return answer(text, attempts);
  };
  const conn: Conn = {
    async query(text) {
      log.push(`q ${text}`);
      return reply(text);
    },
    async exec(text) {
      log.push(`x ${text}`);
    },
  };
  const engine: Engine = {
    types,
    async statement(text) {
      log.push(`s ${text}`);
      return reply(text);
    },
    async tx(level, fn) {
      txs += 1;
      log.push(`tx ${level}`);
      const thrown = opts.txThrows?.(txs);
      if (thrown !== undefined) throw thrown;
      const out = await fn(conn);
      log.push(out.commit ? "commit" : "rollback");
      return out.value;
    },
  };
  const backend: Backend = {
    pooled: opts.pooled ?? true,
    async ensure() {
      return engine;
    },
    async prelude() {
      log.push("prelude");
    },
    changes: () => ({
      follow: async () => () => undefined,
      committed: (texts) => {
        committed.push([...texts]);
      },
    }),
  };
  return { log, committed, types, backend };
}

const NO = { code: "t.no", message: "no", data: null };
const MINE = { code: "t.mine", message: "mine", data: null };

const channel = {
  name: "list",
  params: {
    parse: (input: unknown) => (typeof input === "object" && input !== null ? ok({}) : err(NO)),
    encode: (value: unknown) => value,
  },
};

test("allow picks the level; another allow or a missing, blank or non-string reason throws its own message", async () => {
  const x = scripted(() => none);
  const db = makeDatabase("t.db", x.backend);
  const fn = async () => ok(null);
  expect((await db.transaction(fn)).ok).toBe(true);
  expect((await db.transaction(fn, { allow: "write skew", reason: "one row" })).ok).toBe(true);
  expect((await db.transaction(fn, { allow: "lost updates", reason: "a counter" })).ok).toBe(true);
  expect(x.log.filter((l) => l.startsWith("tx "))).toEqual([
    "tx serializable",
    "tx repeatable read",
    "tx read committed",
  ]);
  const call = (opts: unknown) => Reflect.apply(db.transaction, db, [fn, opts]);
  await expect(call({ allow: "phantoms", reason: "r" })).rejects.toThrow(
    "std.postgres: transaction allow is not one it takes",
  );
  for (const reason of [undefined, "", "   ", 5])
    await expect(call({ allow: "write skew", reason })).rejects.toThrow(
      "std.postgres: transaction allow needs a reason",
    );
});

test("a row that does not fit is postgres.result naming its index, each path and rule", async () => {
  const bad: Raw = {
    ...rows([1, "a"]),
    rows: [
      ["1", "a"],
      ["x", "b"],
    ],
    count: 2,
  };
  const x = scripted(() => bad);
  const r = await makeDatabase("t.db", x.backend).query(sql(Row)`select id, name from t`);
  const issues = [{ path: ["id"], rule: "int" }];
  expect(r).toEqual(
    err({ code: "postgres.result", message: "A row does not fit its schema", data: { row: 1, issues } }),
  );
});

test("run's statement that returns rows is postgres.result naming each column, or the row when it has none", async () => {
  const named = scripted(() => rows([1, "a"]));
  const want = (paths: string[][]) =>
    err({
      code: "postgres.result",
      message: "run's statement returned a row",
      data: { row: 0, issues: paths.map((path) => ({ path, rule: "unknown-key" })) },
    });
  const q = sql(NoRows)`delete from t returning *`;
  expect(await makeDatabase("t.db", named.backend).run(q)).toEqual(want([["id"], ["name"]]));
  expect(await makeDatabase("t.db", named.backend).transaction((tx) => tx.run(q))).toEqual(want([["id"], ["name"]]));
  const bare = scripted(() => ({ fields: [], rows: [[]], count: 1 }));
  expect(await makeDatabase("t.db", bare.backend).run(q)).toEqual(want([[]]));
  expect(await makeDatabase("t.db", bare.backend).transaction((tx) => tx.run(q))).toEqual(want([[]]));
  const counted = scripted(() => ({ fields: [], rows: [], count: 3 }));
  expect(await makeDatabase("t.db", counted.backend).run(q)).toEqual(ok(3));
  expect(await makeDatabase("t.db", counted.backend).transaction((tx) => tx.run(q))).toEqual(ok(3));
});

test("one() of more rows than one throws, its data the count; none is keel.notFound", async () => {
  const two = scripted(() => rows([1, "a"], [2, "b"]));
  const thrown = await makeDatabase("t.db", two.backend)
    .one(sql(Row)`select 1`)
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(isDefect(thrown)).toBe(true);
  expect(thrown instanceof Error && thrown.message).toBe("std.postgres: one() got more than one row");
  expect(Reflect.get(Object(thrown), "data")).toEqual({ rows: 2 });
  const zero = scripted(() => rows());
  expect(await makeDatabase("t.db", zero.backend).one(sql(Row)`select 1`)).toEqual(
    err({ code: "keel.notFound", message: "No row matched", data: null }),
  );
});

test("a pooled lone statement runs on the pool; unpooled, in a serializable transaction after the prelude", async () => {
  const pooled = scripted(() => rows([1, "a"]));
  expect(await makeDatabase("t.db", pooled.backend).query(sql(Row)`select a`)).toEqual(ok([{ id: 1, name: "a" }]));
  expect(pooled.log).toEqual(["s select a"]);
  const unpooled = scripted(() => rows([1, "a"]), { pooled: false });
  expect(await makeDatabase("t.db", unpooled.backend).query(sql(Row)`select a`)).toEqual(ok([{ id: 1, name: "a" }]));
  expect(unpooled.log).toEqual(["tx serializable", "prelude", "q select a", "commit"]);
});

test("a type the cache has not seen is read again: in a read committed transaction it rolls back, or on the run's connection", async () => {
  const fresh: Raw = { fields: [{ name: "v", oid: NEW_OID }], rows: [["x"]], count: 1 };
  const V = s.object({ v: s.string() });
  const lone = scripted(() => fresh);
  expect(await makeDatabase("t.db", lone.backend).query(sql(V)`select v`)).toEqual(ok([{ v: "x" }]));
  expect(lone.log).toEqual(["s select v", "tx read committed", `q ${LOAD}`, "rollback"]);
  expect(lone.types.known.has(NEW_OID)).toBe(true);
  const inTx = scripted(() => fresh);
  expect((await makeDatabase("t.db", inTx.backend).transaction((tx) => tx.query(sql(V)`select v`))).ok).toBe(true);
  expect(inTx.log).toEqual([
    "tx serializable",
    "prelude",
    "x savepoint keel_statement",
    "q select v",
    "x release savepoint keel_statement",
    `q ${LOAD}`,
    "commit",
  ]);
  const unpooled = scripted(() => fresh, { pooled: false });
  expect((await makeDatabase("t.db", unpooled.backend).query(sql(V)`select v`)).ok).toBe(true);
  expect(unpooled.log).toEqual(["tx serializable", "prelude", "q select v", `q ${LOAD}`, "commit"]);
  const known = scripted(() => rows([1, "a"]));
  expect((await makeDatabase("t.db", known.backend).query(sql(Row)`select a`)).ok).toBe(true);
  expect(known.log).toEqual(["s select a"]);
});

test("a lone statement reruns on a serialization failure or deadlock, at most 3 runs; another driver error answers at once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom("40001", "40P01"), fc.integer({ min: 0, max: 4 }), async (code, fails) => {
      const x = scripted((_, n) => {
        if (n <= fails) throw pgError(code);
        return rows([1, "a"]);
      });
      const r = await makeDatabase("t.db", x.backend).query(sql(Row)`select a`);
      expect(r).toEqual(
        fails < 3
          ? ok([{ id: 1, name: "a" }])
          : {
              ok: false,
              error: {
                code: "keel.conflict",
                message: "A concurrent write got there first",
                data: null,
                cause: { code: "postgres.database", message: expect.any(String), data: { sqlstate: code } },
              },
            },
      );
      expect(x.log.length).toBe(Math.min(fails + 1, 3));
    }),
    { seed: SEED, numRuns: 20 },
  );
  const unique = scripted(() => {
    throw pgError("23505", { constraint: "t_name_key" });
  });
  expect(await makeDatabase("t.db", unique.backend).run(sql(NoRows)`insert`)).toEqual(
    err({
      code: "postgres.constraint",
      message: "A row breaks a constraint",
      data: { constraint: "t_name_key", kind: "unique" },
    }),
  );
  expect(unique.log).toEqual(["s insert"]);
});

test("a plan step waits its delay only when it has one; conflict runs the statement uncommitted and runs it again", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED, schedule: { net: [], storage: [], offline: [], plans: {} } });
  const after = vi.spyOn(ctx.clock, "after");
  const x = scripted(() => rows([1, "a"]));
  const db = makeDatabase("t.db", x.backend, {
    clock: ctx.clock,
    steps: [
      { delay: 0, fault: "conflict" },
      { delay: 0, fault: "none" },
    ],
  });
  expect(await db.query(sql(Row)`select a`)).toEqual(ok([{ id: 1, name: "a" }]));
  expect(after).not.toHaveBeenCalled();
  expect(x.log).toEqual(["tx serializable", "prelude", "q select a", "rollback", "s select a"]);
  const delayed = makeDatabase("t.db", x.backend, { clock: ctx.clock, steps: [{ delay: 7, fault: "none" }] });
  const p = delayed.query(sql(Row)`select a`);
  for (let i = 0; i < 50; i++) await Promise.resolve();
  expect(after).toHaveBeenCalledWith(7);
  ctx.clock.advance(7);
  expect(await p).toEqual(ok([{ id: 1, name: "a" }]));
  const down = makeDatabase("t.db", x.backend, { clock: ctx.clock, steps: [{ delay: 0, fault: "unavailable" }] });
  expect(await down.transaction(async () => ok(1))).toEqual(
    err({ code: "keel.unreachable", message: "The database did not answer", data: null }),
  );
});

test("a planned conflict on a run whose fn fails returns that failure; one whose commit fails runs again", async () => {
  const x = scripted(() => none);
  const plan = (n: number) => ({
    clock: createCtx({ mode: "sim", seed: SEED, schedule: { net: [], storage: [], offline: [], plans: {} } }).clock,
    steps: Array.from({ length: n }, () => ({ delay: 0, fault: "conflict" as const })),
  });
  let runs = 0;
  const failing = await makeDatabase("t.db", x.backend, plan(1)).transaction(async () => {
    runs += 1;
    return err(MINE);
  });
  expect(failing).toEqual(err(MINE));
  expect(runs).toBe(1);
  const serial = scripted(() => none, { txThrows: (n) => (n === 1 ? pgError("40001") : undefined) });
  expect(await makeDatabase("t.db", serial.backend, plan(1)).transaction(async () => ok(2))).toEqual(ok(2));
});

test("engine.tx throwing: a serialization failure reruns, a lost connection is unreachable, a constraint answers, another throws", async () => {
  const once = scripted(() => none, { txThrows: (n) => (n === 1 ? pgError("40P01") : undefined) });
  expect(await makeDatabase("t.db", once.backend).transaction(async () => ok("done"))).toEqual(ok("done"));
  const always = scripted(() => none, { txThrows: () => pgError("40001") });
  expect(await makeDatabase("t.db", always.backend).transaction(async () => ok("done"))).toEqual(
    err({
      code: "keel.conflict",
      message: "A concurrent write got there first",
      data: null,
      cause: {
        code: "postgres.database",
        message: "The database ran the statement into a conflict",
        data: { sqlstate: "40001" },
      },
    }),
  );
  expect(always.log).toEqual(["tx serializable", "tx serializable", "tx serializable"]);
  const lost = scripted(() => none, { txThrows: () => pgError("57P01") });
  expect(await makeDatabase("t.db", lost.backend).transaction(async () => ok("done"))).toEqual(
    err({ code: "keel.unreachable", message: "The database did not answer", data: null }),
  );
  expect(lost.log).toEqual(["tx serializable"]);
  const deferred = scripted(() => none, { txThrows: () => pgError("23503", { constraint: "t_fk" }) });
  expect(await makeDatabase("t.db", deferred.backend).transaction(async () => ok("done"))).toEqual(
    err({
      code: "postgres.constraint",
      message: "A row breaks a constraint",
      data: { constraint: "t_fk", kind: "foreign" },
    }),
  );
  const actionable = scripted(() => none, { txThrows: () => pgError("22012") });
  expect(await makeDatabase("t.db", actionable.backend).transaction(async () => ok("done"))).toEqual(
    err({ code: "postgres.database", message: "The database refused the statement", data: { sqlstate: "22012" } }),
  );
  const other = scripted(() => none, { txThrows: () => pgError("42P01") });
  const thrown = await makeDatabase("t.db", other.backend)
    .transaction(async () => ok("done"))
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(isDefect(thrown, "E2461")).toBe(true);
  expect(thrown instanceof Error && thrown.message).toBe(
    "E2461 std.postgres: the database answered an SQLSTATE no error takes",
  );
  expect(Reflect.get(Object(thrown), "data")).toEqual({ sqlstate: "42P01" });
  expect(String(thrown)).not.toContain("driver");
});

test("inside a transaction each statement has a savepoint; a conflict rolls back to it and the run reruns, a lost connection ends the run", async () => {
  let n = 0;
  const conflict = scripted(() => {
    n += 1;
    if (n === 1) throw pgError("40001");
    return none;
  });
  let tries = 0;
  const after: unknown[] = [];
  const r = await makeDatabase("t.db", conflict.backend).transaction(async (tx) => {
    tries += 1;
    const a = await tx.run(sql(NoRows)`update a`);
    const b = await tx.run(sql(NoRows)`update b`);
    after.push(a.ok ? "ok" : a.error.code, b.ok ? "ok" : b.error.code);
    return ok(tries);
  });
  expect(r).toEqual(ok(2));
  expect(after).toEqual(["keel.conflict", "keel.conflict", "ok", "ok"]);
  expect(conflict.log.slice(0, 6)).toEqual([
    "tx serializable",
    "prelude",
    "x savepoint keel_statement",
    "q update a",
    "x rollback to savepoint keel_statement",
    "rollback",
  ]);
  const lost = scripted(() => {
    throw pgError("08006");
  });
  const seen: unknown[] = [];
  const l = await makeDatabase("t.db", lost.backend).transaction(async (tx) => {
    const a = await tx.run(sql(NoRows)`update a`);
    const b = await tx.query(sql(Row)`select b`);
    seen.push(a.ok ? "ok" : a.error.code, b.ok ? "ok" : b.error.code);
    return ok(null);
  });
  expect(l).toEqual(err({ code: "keel.unreachable", message: "The database did not answer", data: null }));
  expect(seen).toEqual(["keel.unreachable", "keel.unreachable"]);
  expect(lost.log).toEqual(["tx serializable", "prelude", "x savepoint keel_statement", "q update a", "rollback"]);
  const unique = scripted(() => {
    throw pgError("23505", { constraint: "k" });
  });
  expect(
    (
      await makeDatabase("t.db", unique.backend).transaction(async (tx) => {
        expect((await tx.run(sql(NoRows)`insert a`)).ok).toBe(false);
        return ok(null);
      })
    ).ok,
  ).toBe(true);
  expect(unique.log).toEqual([
    "tx serializable",
    "prelude",
    "x savepoint keel_statement",
    "q insert a",
    "x rollback to savepoint keel_statement",
    "commit",
  ]);
});

test("changed notifies inside the run and is delivered once it commits; a run without a change delivers nothing", async () => {
  const x = scripted(() => none);
  const db = makeDatabase("t.db", x.backend);
  expect(await db.transaction(async () => ok(1))).toEqual(ok(1));
  expect(x.committed).toEqual([]);
  expect(await db.changed(channel, {})).toEqual(ok(null));
  const text = JSON.stringify({ d: "t.db", c: "list", k: "{}" });
  expect(x.committed).toEqual([[text]]);
  expect(x.log).toContain("q select pg_notify('keel_changes', $1)");
  const inside = scripted(() => none);
  expect(
    (
      await makeDatabase("t.db", inside.backend).transaction(async (tx) => {
        expect((await tx.changed(channel, {})).ok).toBe(true);
        return ok(null);
      })
    ).ok,
  ).toBe(true);
  expect(inside.committed).toEqual([[text]]);
  const failed = scripted(() => none);
  expect(
    (
      await makeDatabase("t.db", failed.backend).transaction(async (tx) => {
        expect((await tx.changed(channel, {})).ok).toBe(true);
        return err(NO);
      })
    ).ok,
  ).toBe(false);
  expect(failed.committed).toEqual([]);
  const lost = scripted(() => {
    throw pgError("08006");
  });
  expect(await makeDatabase("t.db", lost.backend).changed(channel, {})).toEqual(
    err({ code: "keel.unreachable", message: "The database did not answer", data: null }),
  );
  expect(lost.committed).toEqual([]);
});

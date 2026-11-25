// Seed 1337. The `pg` side of std.postgres over a stand-in driver: the pool's settings, each statement's config and
// answer, a transaction's begin, commit, rollback and release, and the listening connection of `follow` (open, deliver,
// stop, lose, open again). The same paths run on Postgres 17 in the files that take KEEL_TEST_POSTGRES_URL.
import { pid } from "node:process";
import fc from "fast-check";
import { beforeEach, expect, test, vi } from "vitest";
import type { FollowEvent } from "../src/server/FollowEvent.ts";
import { listenChanges } from "../src/server/internal/listenChanges.server.ts";
import { pgEngine } from "../src/server/internal/pgEngine.server.ts";

const SEED = 1337;

const hoisted = vi.hoisted(async () => {
  const { EventEmitter } = await import("node:events");
  type Answer = { fields: { name: string; dataTypeID: number }[]; rows: unknown[][]; rowCount: number | null };
  const clients: FakeClient[] = [];
  const pools: FakePool[] = [];
  const state = {
    clients,
    pools,
    /** What the next `connect` of a listening client does. */
    connect: (): Promise<void> => Promise.resolve(),
    /** What a pool or pool client answers to a query config or text. */
    answer: (_q: unknown): Answer => ({ fields: [], rows: [], rowCount: 0 }),
  };
  class FakeClient extends EventEmitter {
    readonly queries: string[] = [];
    ends = 0;
    constructor(readonly config: unknown) {
      super();
      state.clients.push(this);
    }
    connect(): Promise<void> {
      return state.connect();
    }
    async query(text: string): Promise<void> {
      this.queries.push(text);
    }
    end(): Promise<void> {
      this.ends += 1;
      return this.ends > 1 ? Promise.reject(new Error("ended twice")) : Promise.resolve();
    }
  }
  class FakePoolClient extends EventEmitter {
    readonly queries: unknown[] = [];
    released: unknown[] = [];
    fail: (q: unknown) => boolean = () => false;
    async query(q: unknown): Promise<Answer> {
      this.queries.push(q);
      if (this.fail(q)) throw Object.assign(new Error("refused"), { code: "08006" });
      return state.answer(q);
    }
    release(broken?: unknown): void {
      this.released.push(broken);
    }
  }
  class FakePool extends EventEmitter {
    readonly queries: unknown[] = [];
    readonly handed: FakePoolClient[] = [];
    next = (): FakePoolClient => new FakePoolClient();
    constructor(readonly config: unknown) {
      super();
      state.pools.push(this);
    }
    async query(q: unknown): Promise<Answer> {
      this.queries.push(q);
      return state.answer(q);
    }
    async connect(): Promise<FakePoolClient> {
      const c = this.next();
      this.handed.push(c);
      this.emit("connect", c);
      return c;
    }
  }
  return { state, FakeClient, FakePool, FakePoolClient };
});

vi.mock("pg", async () => {
  const f = await hoisted;
  return { default: { Client: f.FakeClient, Pool: f.FakePool } };
});
const fakes = await hoisted;

let urls = 0;
const url = () => {
  urls += 1;
  return `postgres://u:p@db.invalid:5432/fake${urls}?sslmode=require`;
};

beforeEach(() => {
  fakes.state.clients.length = 0;
  fakes.state.pools.length = 0;
  fakes.state.connect = () => Promise.resolve();
  fakes.state.answer = () => ({ fields: [], rows: [], rowCount: 0 });
});

test("the pool: at most 10 connections, verified TLS, exits when idle, serializable by default; errors are dropped", () => {
  const u = url();
  pgEngine(u);
  const pool = fakes.state.pools[0];
  expect(pool?.config).toEqual({
    connectionString: u.replace("sslmode=require", "sslmode=verify-full"),
    max: 10,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
    options: "-c default_transaction_isolation=serializable",
  });
  expect(() => pool?.emit("error", new Error("idle client lost"))).not.toThrow();
  const client = new fakes.FakePoolClient();
  pool?.emit("connect", client);
  expect(() => client.emit("error", new Error("socket closed"))).not.toThrow();
});

test("a statement sends its text and params as an array-mode config that keeps every value as text, and maps the answer", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.option(fc.string(), { nil: null }), { maxLength: 4 }),
      fc.option(fc.nat({ max: 50 }), { nil: null }),
      async (params, rowCount) => {
        fakes.state.answer = () => ({
          fields: [
            { name: "a", dataTypeID: 23 },
            { name: "b", dataTypeID: 1700 },
          ],
          rows: [["1", "2.50"]],
          rowCount,
        });
        const e = pgEngine(url());
        const raw = await e.statement("select $1", params);
        expect(raw).toEqual({
          fields: [
            { name: "a", oid: 23 },
            { name: "b", oid: 1700 },
          ],
          rows: [["1", "2.50"]],
          count: rowCount ?? 0,
        });
        const sent: unknown = fakes.state.pools.at(-1)?.queries[0];
        expect(sent).toMatchObject({ text: "select $1", values: params, rowMode: "array" });
        const types: unknown = Reflect.get(Object(sent), "types");
        const parserOf: unknown = Reflect.get(Object(types), "getTypeParser");
        const parse: unknown = typeof parserOf === "function" ? parserOf(1700, "text") : undefined;
        expect(typeof parse === "function" ? parse("2.50") : "no parser").toBe("2.50");
      },
    ),
    { seed: SEED, numRuns: 20 },
  );
});

test("a transaction begins at its level, commits or rolls back as fn says, and releases its client unbroken", async () => {
  for (const [level, commit] of [
    ["serializable", true],
    ["repeatable read", false],
    ["read committed", true],
  ] as const) {
    const e = pgEngine(url());
    const value = await e.tx(level, async (c) => {
      await c.exec("savepoint s");
      await c.query("select $1", ["x"]);
      return { value: `v ${level}`, commit };
    });
    expect(value).toBe(`v ${level}`);
    const client = fakes.state.pools.at(-1)?.handed[0];
    const texts = client?.queries.map((q) => (typeof q === "string" ? q : Reflect.get(Object(q), "text")));
    expect(texts).toEqual([
      `begin isolation level ${level}`,
      "savepoint s",
      "select $1",
      commit ? "commit" : "rollback",
    ]);
    expect(client?.released).toEqual([false]);
  }
});

test("fn throwing rolls back and throws; a rollback that fails releases the client as broken", async () => {
  const e = pgEngine(url());
  const boom = new Error("boom");
  await expect(
    e.tx("serializable", async () => {
      throw boom;
    }),
  ).rejects.toBe(boom);
  const client = fakes.state.pools.at(-1)?.handed[0];
  expect(client?.queries.at(-1)).toBe("rollback");
  expect(client?.released).toEqual([false]);
  const lost = pgEngine(url());
  const pool = fakes.state.pools.at(-1);
  if (pool !== undefined)
    pool.next = () => {
      const c = new fakes.FakePoolClient();
      c.fail = (q) => q === "rollback" || q === "commit";
      return c;
    };
  await expect(lost.tx("serializable", async () => ({ value: 1, commit: true }))).rejects.toThrow("refused");
  expect(pool?.handed[0]?.released).toEqual([true]);
});

/** A follow's events, and its stop once `follow` resolved. */
const follower = () => {
  const events: FollowEvent["kind"][] = [];
  return { events, on: (e: FollowEvent) => events.push(e.kind) };
};
const notify = (channel: string, payload: string | undefined) => {
  for (const c of fakes.state.clients) c.emit("notification", { channel, payload });
};

test("follow opens one named listening connection per URL and hands each notification to the follows of its payload", async () => {
  const u = url();
  const changes = listenChanges(u);
  const a = follower();
  const a2 = follower();
  const b = follower();
  const stopA = await changes.follow("A", a.on);
  await changes.follow("A", a2.on);
  await changes.follow("B", b.on);
  expect(fakes.state.clients.length).toBe(1);
  const client = fakes.state.clients[0];
  expect(client?.config).toEqual({
    connectionString: u.replace("sslmode=require", "sslmode=verify-full"),
    connectionTimeoutMillis: 10_000,
    application_name: `keel-listen-${pid}`,
  });
  expect(client?.queries).toEqual(["listen keel_changes"]);
  notify("keel_changes", "A");
  notify("other", "A");
  notify("keel_changes", undefined);
  notify("keel_changes", "C");
  expect([a.events, a2.events, b.events]).toEqual([["changed"], ["changed"], []]);
  stopA();
  notify("keel_changes", "A");
  notify("keel_changes", "B");
  expect([a.events, a2.events, b.events]).toEqual([["changed"], ["changed", "changed"], ["changed"]]);
  expect(client?.ends).toBe(0);
  changes.committed(["A"]);
  expect(a2.events.length).toBe(2);
});

test("the last stop ends the connection, a stop again changes nothing, and the next follow opens a new one", async () => {
  const u = url();
  const changes = listenChanges(u);
  const a = follower();
  const stop = await changes.follow("A", a.on);
  const other = await changes.follow("B", () => undefined);
  stop();
  expect(fakes.state.clients[0]?.ends).toBe(0);
  other();
  expect(fakes.state.clients[0]?.ends).toBe(1);
  stop();
  fakes.state.clients[0]?.emit("end");
  expect(a.events).toEqual([]);
  const again = follower();
  await changes.follow("A", again.on);
  expect(fakes.state.clients.length).toBe(2);
  notify("keel_changes", "A");
  expect([a.events, again.events]).toEqual([[], ["changed"]]);
});

test("an error or end is lost once to each listening follow, the connection ends, and the next follow opens a new one", async () => {
  for (const event of ["error", "end"]) {
    fakes.state.clients.length = 0;
    const changes = listenChanges(url());
    const a = follower();
    const b = follower();
    await changes.follow("A", a.on);
    await changes.follow("B", b.on);
    const first = fakes.state.clients[0];
    first?.emit(event, new Error("gone"));
    first?.emit("end");
    first?.emit("error", new Error("again"));
    expect([a.events, b.events]).toEqual([["lost"], ["lost"]]);
    expect(first?.ends).toBe(1);
    notify("keel_changes", "A");
    expect(a.events).toEqual(["lost"]);
    const c = follower();
    await changes.follow("A", c.on);
    expect(fakes.state.clients.length).toBe(2);
    notify("keel_changes", "A");
    expect([a.events, c.events]).toEqual([["lost"], ["changed"]]);
  }
});

test("a follow waiting for the connection gets no event, and fails once the connection closes or does not open", async () => {
  let open: () => void = () => undefined;
  fakes.state.connect = () =>
    new Promise<void>((resolve) => {
      open = resolve;
    });
  const changes = listenChanges(url());
  const waiting = follower();
  const p = changes.follow("A", waiting.on);
  notify("keel_changes", "A");
  fakes.state.clients[0]?.emit("error", new Error("gone"));
  open();
  await expect(p).rejects.toThrow(new Error("std.postgres: the listening connection closed"));
  expect(waiting.events).toEqual([]);
  fakes.state.connect = () => Promise.reject(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }));
  const refused = listenChanges(url());
  for (let n = 1; n <= 2; n++) {
    await expect(refused.follow("A", () => undefined)).rejects.toThrow(
      new Error("std.postgres: the listening connection did not open"),
    );
    expect(fakes.state.clients.length).toBe(1 + n);
  }
});

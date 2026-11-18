// Spec: std.outbox Conformance, bullet 1: "With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`."
// Spec: std.outbox Conformance, bullet 2: "With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key."
// Spec: std.outbox Conformance, bullet 3: "Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted."
// Spec: std.outbox Conformance, bullet 4: "With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts."
// Spec: std.outbox Conformance, bullet 6: "Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key."
// Spec: std.outbox Conformance, bullet 7: "With `storage: ['ok', 'ok', 'ok', 'fail']` online and a route answering 2xx, `send` resolves `sent` with the endpoint's output and the route is posted once; with `['ok', 'ok', 'ok', 'fail', 'fail']`, `drain` on a new ctx over that storage posts the entry again with its key and the server store holds one entry for that write; under the first schedule a 409 with `data.transaction` resolves `conflict` with its `head`."
// Spec: std.outbox Conformance, bullet 8: "Online, with `send`'s storage `set` settling 11 s after it began, the entry is still `failed` with `offline.storage` in memory after that write settles."
// Spec: std.outbox Conformance, bullet 9: "Online, with the flush's `sending` `set` never settling, `send` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted."
// Spec: std.outbox Conformance, bullet 10: "Online, with a `conflict` entry and the `set` of `resolve(ctx, o, key, 'mine')` never settling, `resolve` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted."
// Spec: std.outbox Conformance, bullet 11: "Offline, with `storage: ['ok', 'fail', 'ok', 'fail']`, `resolve(ctx, o, key, 'theirs')` on the entry `send` left `failed` resolves `true`, and `keel.outbox.<id>` then holds no entry with that key."
// Spec: std.outbox Conformance, bullet 12: "Online, with a ctx whose `storage.set` throws synchronously on its second call (the flush's `sending` write), `send` resolves `failed` with `offline.storage`."
// Spec: std.outbox Conformance, bullet 13: "Offline, with `send`'s storage `set` held past 10 s and then released, `keel.outbox.<id>` holds the entry `failed` once that write settles, and `drain` on a new ctx over that storage, online, posts nothing."
// Seed 1337
import { resolve, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  OWNER,
  SEED,
  type SimSchedule,
  copyStorage,
  createServer,
  edit,
  entriesOf,
  makeClient,
  settle,
  simCtx,
  startDrain,
  stored,
  tick,
} from "./fixtures.ts";

const schedule = (storage: ("ok" | "fail")[]): SimSchedule => ({ net: [], storage, offline: [], plans: {} });
const macrotask = (): Promise<void> => new Promise<void>((done) => setImmediate(done));
const codeOf = (r: { state: string }): unknown => {
  const err: unknown = Reflect.get(r, "error");
  return typeof err === "object" && err !== null ? Reflect.get(err, "code") : undefined;
};

test("With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`.", async () => {
  const ctx = simCtx(SEED, schedule(["ok", "ok", "fail"]));
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  expect(r.state).toBe("failed");
  expect(codeOf(r)).toBe("offline.storage");
  expect((await stored(ctx, c.storageKey)).map((e) => e.state)).toEqual(["failed"]);
  expect(server.posts).toHaveLength(0);
  c.dispose();
});

test("With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key.", async () => {
  const ctx = simCtx(SEED, schedule(["ok", "ok", "fail", "fail"]));
  const first = createServer();
  first.attach(ctx);
  const c = makeClient();
  const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  expect(r.state).toBe("failed");
  expect(codeOf(r)).toBe("offline.storage");
  const held = await stored(ctx, c.storageKey);
  expect(held.map((e) => e.state)).toEqual(["queued"]);
  expect(first.posts).toHaveLength(0);
  c.dispose();

  const next = simCtx();
  const server = createServer();
  server.attach(next);
  await copyStorage(ctx, next, c.storageKey);
  const again = makeClient({ id: c.id });
  const stop = startDrain(next, again.o);
  await settle();
  expect(server.posts).toHaveLength(1);
  expect(server.posts.map((p) => p.key)).toEqual(held.map((e) => e.key));
  stop();
  again.dispose();
});

test("Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), async (extra) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      const real = ctx.storage.set.bind(ctx.storage);
      let calls = 0;
      const set = (key: string, value: string): Promise<void> => {
        calls += 1;
        return calls === 1 ? new Promise<void>(() => {}) : real(key, value);
      };
      Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
      const a = send(ctx, c.o, "editTodo", edit("t1", "A"), { base: 0, owner: OWNER });
      await settle();
      const done: string[] = [];
      const b = send(ctx, c.o, "editTodo", edit("t2", "B"), { base: 0, owner: OWNER });
      void a.then(() => done.push("A"));
      void b.then(() => done.push("B"));
      await settle();
      expect(done).toEqual([]);
      await tick(ctx, 9000);
      expect(done).toEqual([]);
      await tick(ctx, 1000 + extra);
      const [ra, rb] = await Promise.all([a, b]);
      await settle();
      expect(rb.state).toBe("sent");
      expect(ra.state).toBe("failed");
      expect(codeOf(ra)).toBe("offline.storage");
      expect(server.posts.map((p) => p.title)).toEqual(["B"]);
      c.dispose();
    }),
    { seed: SEED, numRuns: 6 },
  );
});

test("With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.next({ kind: "reject" });
  const c = makeClient();
  const realAfter = ctx.clock.after.bind(ctx.clock);
  const thrown = new RangeError("clock");
  Object.defineProperty(ctx.clock, "after", {
    value: (...args: Parameters<typeof realAfter>) => {
      if (server.posts.length === 0) return realAfter(...args);
      throw thrown;
    },
    configurable: true,
    writable: true,
  });
  const reasons: unknown[] = [];
  const saved = process.listeners("unhandledRejection");
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", (reason) => {
    reasons.push(reason);
  });
  try {
    const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
    await settle();
    await macrotask();
    await macrotask();
    expect(r).toEqual({ state: "queued" });
    expect(entriesOf(c.o).map((e) => e.state)).not.toContain("failed");
    expect(entriesOf(c.o)).toHaveLength(1);
    expect(reasons).toEqual([thrown]);
    expect((await stored(ctx, c.storageKey)).map((e) => e.state)).not.toContain("failed");
  } finally {
    process.removeAllListeners("unhandledRejection");
    for (const listener of saved) process.on("unhandledRejection", listener);
  }
  Object.defineProperty(ctx.clock, "after", { value: realAfter, configurable: true, writable: true });
  const posts = server.posts.length;
  await send(ctx, c.o, "editTodo", edit("t2", "y"), { base: 0, owner: OWNER });
  await settle();
  expect(server.posts.length).toBeGreaterThan(posts);
  expect(server.posts.map((p) => p.title)).toContain("y");
  c.dispose();
});

test("Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (title) => {
      const ctx = simCtx(SEED, schedule(["ok", ...Array.from({ length: 30 }, (): "fail" => "fail")]));
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      ctx.net.setOnline(false);
      const r = await send(ctx, c.o, "editTodo", edit("t1", title), { base: 0, owner: OWNER });
      await settle();
      expect(r.state).toBe("failed");
      const entry = entriesOf(c.o)[0];
      if (entry === undefined || entry.state !== "failed") throw new Error("no failed entry");
      await expect(resolve(ctx, c.o, entry.key, "theirs")).resolves.toBe(true);
      expect(entriesOf(c.o).some((e) => e.key === entry.key)).toBe(false);
      expect(server.posts).toHaveLength(0);
      c.dispose();
    }),
    { seed: SEED, numRuns: 6 },
  );
});

type Sim = ReturnType<typeof simCtx>;

/** Holds the `nth` `ctx.storage.set` call. `release` lets it land and settle; a held write never released never settles. */
function holdSet(ctx: Sim, nth: number): { release: () => Promise<void> } {
  const real = ctx.storage.set.bind(ctx.storage);
  let calls = 0;
  let land: (() => Promise<void>) | undefined;
  const set = (key: string, value: string): Promise<void> => {
    calls += 1;
    if (calls !== nth) return real(key, value);
    return new Promise<void>((done) => {
      land = async () => {
        await real(key, value);
        done();
      };
    });
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  return { release: async () => void (await land?.()) };
}

test("With `storage: ['ok', 'ok', 'ok', 'fail']` online and a route answering 2xx, `send` resolves `sent` with the endpoint's output and the route is posted once; with `['ok', 'ok', 'ok', 'fail', 'fail']`, `drain` on a new ctx over that storage posts the entry again with its key and the server store holds one entry for that write; under the first schedule a 409 with `data.transaction` resolves `conflict` with its `head`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (title) => {
      const ctx = simCtx(SEED, schedule(["ok", "ok", "ok", "fail"]));
      const server = createServer();
      server.attach(ctx);
      const c = makeClient();
      const r = await send(ctx, c.o, "editTodo", edit("t1", title), { base: 0, owner: OWNER });
      await settle();
      expect(r).toEqual({ state: "sent", value: { head: 1, title } });
      expect(server.posts).toHaveLength(1);
      c.dispose();
    }),
    { seed: SEED, numRuns: 6 },
  );

  const ctx = simCtx(SEED, schedule(["ok", "ok", "ok", "fail", "fail"]));
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const r = await send(ctx, c.o, "editTodo", edit("t1", "once"), { base: 0, owner: OWNER });
  await settle();
  expect(r.state).toBe("sent");
  expect(server.posts).toHaveLength(1);
  c.dispose();
  const next = simCtx();
  server.attach(next);
  await copyStorage(ctx, next, c.storageKey);
  const again = makeClient({ id: c.id });
  const stop = startDrain(next, again.o);
  await settle();
  expect(server.posts).toHaveLength(2);
  expect(server.posts[1]?.key).toBe(server.posts[0]?.key);
  expect(server.entries()).toEqual([{ todoId: "t1", title: "once" }]);
  stop();
  again.dispose();

  const late = simCtx(SEED, schedule(["ok", "ok", "ok", "fail"]));
  const other = createServer();
  other.attach(late);
  other.other("t1", "other");
  const k = makeClient();
  const refused = await send(late, k.o, "editTodo", edit("t1", "stale"), { base: 0, owner: OWNER });
  await settle();
  expect(refused).toEqual({ state: "conflict", head: 1 });
  k.dispose();
}, 10_000);

test("Online, with `send`'s storage `set` settling 11 s after it began, the entry is still `failed` with `offline.storage` in memory after that write settles.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const held = holdSet(ctx, 1);
  const sent = send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  await tick(ctx, 10_000);
  const r = await sent;
  expect(r.state).toBe("failed");
  expect(codeOf(r)).toBe("offline.storage");
  await tick(ctx, 1000);
  await held.release();
  await settle();
  const entries = c.o.get("entries");
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  const err: unknown = Reflect.get(entries[0] ?? {}, "error");
  expect(typeof err === "object" && err !== null ? Reflect.get(err, "code") : undefined).toBe("offline.storage");
  c.dispose();
}, 10_000);

test("Online, with the flush's `sending` `set` never settling, `send` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  holdSet(ctx, 2);
  const done: string[] = [];
  const sent = send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  void sent.then((r) => done.push(r.state));
  await settle();
  await tick(ctx, 9000);
  expect(done).toEqual([]);
  await tick(ctx, 1000);
  const r = await sent;
  await settle();
  expect(r.state).toBe("failed");
  expect(codeOf(r)).toBe("offline.storage");
  expect(server.posts).toHaveLength(0);
  c.dispose();
}, 10_000);

test("Online, with a `conflict` entry and the `set` of `resolve(ctx, o, key, 'mine')` never settling, `resolve` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.other("t1", "other");
  const c = makeClient();
  const first = await send(ctx, c.o, "editTodo", edit("t1", "mine"), { base: 0, owner: OWNER });
  await settle();
  expect(first.state).toBe("conflict");
  const entry = entriesOf(c.o)[0];
  if (entry === undefined) throw new Error("no conflict entry");
  const posted = server.posts.length;
  let calls = 0;
  const real = ctx.storage.set.bind(ctx.storage);
  const set = (key: string, value: string): Promise<void> => {
    calls += 1;
    return calls === 1 ? new Promise<void>(() => {}) : real(key, value);
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  const done: unknown[] = [];
  const resolved = resolve(ctx, c.o, entry.key, "mine");
  void resolved.then((r) => done.push(r));
  await settle();
  await tick(ctx, 9000);
  expect(done).toEqual([]);
  await tick(ctx, 1000);
  const r = await resolved;
  await settle();
  expect(typeof r === "object" ? r.state : r).toBe("failed");
  expect(typeof r === "object" ? codeOf(r) : undefined).toBe("offline.storage");
  expect(server.posts).toHaveLength(posted);
  c.dispose();
}, 10_000);

test("Offline, with `storage: ['ok', 'fail', 'ok', 'fail']`, `resolve(ctx, o, key, 'theirs')` on the entry `send` left `failed` resolves `true`, and `keel.outbox.<id>` then holds no entry with that key.", async () => {
  const ctx = simCtx(SEED, schedule(["ok", "fail", "ok", "fail"]));
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  ctx.net.setOnline(false);
  const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  expect(r.state).toBe("failed");
  const entry = entriesOf(c.o)[0];
  if (entry === undefined) throw new Error("no failed entry");
  await expect(resolve(ctx, c.o, entry.key, "theirs")).resolves.toBe(true);
  await settle();
  expect((await stored(ctx, c.storageKey)).some((e) => e.key === entry.key)).toBe(false);
  expect(entriesOf(c.o).some((e) => e.key === entry.key)).toBe(false);
  c.dispose();
}, 10_000);

test("Online, with a ctx whose `storage.set` throws synchronously on its second call (the flush's `sending` write), `send` resolves `failed` with `offline.storage`.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const real = ctx.storage.set.bind(ctx.storage);
  let calls = 0;
  const set = (key: string, value: string): Promise<void> => {
    calls += 1;
    if (calls === 2) throw new RangeError("storage");
    return real(key, value);
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  expect(r.state).toBe("failed");
  expect(codeOf(r)).toBe("offline.storage");
  expect(server.posts).toHaveLength(0);
  c.dispose();
}, 10_000);

test("Offline, with `send`'s storage `set` held past 10 s and then released, `keel.outbox.<id>` holds the entry `failed` once that write settles, and `drain` on a new ctx over that storage, online, posts nothing.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  ctx.net.setOnline(false);
  const held = holdSet(ctx, 1);
  const sent = send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  await settle();
  await tick(ctx, 10_000);
  const r = await sent;
  expect(r.state).toBe("failed");
  await tick(ctx, 1000);
  await held.release();
  await settle();
  expect((await stored(ctx, c.storageKey)).map((e) => e.state)).toEqual(["failed"]);
  c.dispose();

  const next = simCtx();
  server.attach(next);
  await copyStorage(ctx, next, c.storageKey);
  const again = makeClient({ id: c.id });
  const stop = startDrain(next, again.o);
  await settle();
  expect(server.posts).toHaveLength(0);
  stop();
  again.dispose();
}, 10_000);

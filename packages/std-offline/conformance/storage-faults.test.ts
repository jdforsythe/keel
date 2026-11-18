// Spec: std.outbox Conformance, bullet 1: "With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`."
// Spec: std.outbox Conformance, bullet 2: "With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key."
// Spec: std.outbox Conformance, bullet 3: "Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted."
// Spec: std.outbox Conformance, bullet 4: "With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts."
// Spec: std.outbox Conformance, bullet 6: "Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key."
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

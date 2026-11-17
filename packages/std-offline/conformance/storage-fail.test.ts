// Spec: std.offline Conformance 11 and the Write paragraph (a rejected write in a `'mine'` `resolve`): "With a sim schedule `storage: ['ok', 'fail']` (the load's `get`, then `send`'s `set`), `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`; with `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts."
// Spec: std.offline Write paragraph: "A write to `ctx.storage` that rejects, in `send`, a flush or a `'mine'` `resolve`, leaves the entry `failed` with `offline.storage` in memory, posts nothing more and releases the flush." (the cases under a running flush)
// Seed 1337
import type { SimCtx } from "@keel/ctx";
import { resolve, send } from "@keel/std-offline";
import { expect, test } from "vitest";
import {
  ORIGIN,
  SEED,
  type SimSchedule,
  createServer,
  edit,
  entriesOf,
  makeClient,
  settle,
  simCtx,
} from "./fixtures.ts";

const schedule = (storage: ("ok" | "fail")[]): SimSchedule => ({ net: [], storage, offline: [], plans: {} });

test("With a sim schedule `storage: ['ok', 'fail']`, `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`.", async () => {
  const ctx = simCtx(SEED, schedule(["ok", "fail"]));
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "x"), { base: 0 });
  await settle();
  expect(r.state).toBe("failed");
  if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
  expect(server.posts).toHaveLength(0);
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  c.dispose();
});

test("With `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts.", async () => {
  const ctx = simCtx(SEED, schedule(["ok", "ok", "fail"]));
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "x"), { base: 0 });
  await settle();
  expect(r.state).toBe("failed");
  if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
  expect(server.posts).toHaveLength(0);
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  await send(ctx, c.o, ORIGIN, "editTodo", edit("t2", "y"), { base: 0 });
  await settle();
  expect(server.posts.map((p) => p.title)).toContain("y");
  c.dispose();
});

test("A `'mine'` `resolve` whose storage write rejects resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`.", async () => {
  // The load's `get`, `send`'s `set`, the flush's `sending` and `conflict` writes, then `resolve`'s own `set`.
  const ctx = simCtx(SEED, schedule(["ok", "ok", "ok", "ok", "fail"]));
  const server = createServer();
  server.attach(ctx);
  server.other("t1", "other");
  const c = makeClient();
  await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "mine"), { base: 0 });
  await settle();
  const entry = entriesOf(c.o)[0];
  if (entry === undefined || entry.state !== "conflict") throw new Error("no conflict entry");
  const posts = server.posts.length;
  const r = await resolve(ctx, c.o, entry.key, "mine");
  expect(r).not.toBe(false);
  if (r === false) throw new Error("resolve gave false");
  expect(r.state).toBe("failed");
  if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
  expect(server.posts).toHaveLength(posts);
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  c.dispose();
});

/**
 * A storage whose writes finish in the order issued, one per `pump` step (an IndexedDB-like store slower than the network).
 * `failNext()` makes the next write issued reject.
 */
function slowStorage(ctx: SimCtx) {
  const real = ctx.storage.set.bind(ctx.storage);
  const queue: { run: () => Promise<void>; fail: boolean }[] = [];
  const state = { slow: false, failing: false };
  const set = (key: string, value: string): Promise<void> => {
    if (!state.slow) return real(key, value);
    const fail = state.failing;
    state.failing = false;
    return new Promise<void>((done, bad) => {
      queue.push({
        fail,
        run: async () => {
          if (fail) return bad(new Error("QuotaExceeded /data/user/secret.db"));
          await real(key, value);
          done();
        },
      });
    });
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  const pumpAll = async (): Promise<void> => {
    for (let i = 0; i < 40; i++) {
      await settle();
      const next = queue.shift();
      if (next === undefined) {
        if (i > 3) return;
        continue;
      }
      await next.run();
    }
  };
  return {
    slow: (on: boolean): void => {
      state.slow = on;
    },
    failNext: (): void => {
      state.failing = true;
    },
    pumpAll,
    pumpUntil: async (done: () => boolean): Promise<void> => {
      for (let i = 0; i < 40 && !done(); i++) {
        await settle();
        const next = queue.shift();
        if (next !== undefined) await next.run();
      }
    },
  };
}

test("A `'mine'` `resolve` whose storage write rejects while a flush is running posts nothing for the entry and leaves it `failed` with `offline.storage`.", async () => {
  const ctx = simCtx(SEED);
  const server = createServer();
  server.attach(ctx);
  server.other("t1", "other");
  const c = makeClient();
  await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "mine"), { base: 0 });
  await settle();
  const entry = entriesOf(c.o)[0];
  if (entry === undefined || entry.state !== "conflict") throw new Error("no conflict entry");
  const posts = server.posts.length;
  const st = slowStorage(ctx);
  st.slow(true);
  server.gated(true);
  void send(ctx, c.o, ORIGIN, "editTodo", edit("t2", "second"), { base: 0 });
  await st.pumpUntil(() => server.posts.length > posts);
  expect(server.posts.map((p) => p.title)).toEqual(["mine", "second"]);
  server.gated(false);
  server.release();
  await settle();
  st.failNext();
  const pending = resolve(ctx, c.o, entry.key, "mine");
  await st.pumpAll();
  const r = await pending;
  if (r === false) throw new Error("resolve gave false");
  expect(r.state).toBe("failed");
  if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
  await st.pumpAll();
  expect(server.posts.filter((p) => p.key === entry.key)).toHaveLength(1);
  expect(entriesOf(c.o).find((e) => e.key === entry.key)?.state).toBe("failed");
  c.dispose();
});

test("A `send` whose storage write rejects while a flush is running posts nothing for the entry and leaves it `failed` with `offline.storage`.", async () => {
  const ctx = simCtx(SEED);
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  const st = slowStorage(ctx);
  st.slow(true);
  server.gated(true);
  void send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "first"), { base: 0 });
  await st.pumpUntil(() => server.posts.length > 0);
  server.gated(false);
  server.release();
  await settle();
  st.failNext();
  const pending = send(ctx, c.o, ORIGIN, "editTodo", edit("t2", "second"), { base: 0 });
  await st.pumpAll();
  const r = await pending;
  expect(r.state).toBe("failed");
  if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
  await st.pumpAll();
  expect(server.posts.map((p) => p.title)).toEqual(["first"]);
  expect(entriesOf(c.o).find((e) => e.title === "second")?.state).toBe("failed");
  c.dispose();
});

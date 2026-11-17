// Spec: std.offline Conformance 11 and the Write paragraph (a rejected write in a `'mine'` `resolve`): "With a sim schedule `storage: ['ok', 'fail']` (the load's `get`, then `send`'s `set`), `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`; with `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts."
// Seed 1337
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

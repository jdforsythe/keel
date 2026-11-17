// Spec: std.offline Conformance 11: "With a sim schedule `storage: ['ok', 'fail']` (the load's `get`, then `send`'s `set`), `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`; with `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts."
// Seed 1337
import { send } from "@keel/std-offline";
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

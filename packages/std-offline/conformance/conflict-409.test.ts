// Spec: std.offline, clause "A 409 with `data.transaction` leaves the entry `conflict` with that `head`, and the next entry is posted; a 409 without it is sent once more."
// Seed 1337
// Assumption: the outbox reads `data.transaction` and `data.head` from the 409 body's `error.data` (a k.server `Result` err JSON);
// the endpoint declares `errors: { 409: s.json() }`. See the report.
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { OWNER, createServer, edit, entriesOf, makeClient, settle, simCtx, startDrain } from "./fixtures.ts";

test("A 409 with `data.transaction` leaves the entry `conflict` with that `head`, and the next entry is posted.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (others) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      for (let i = 0; i < others; i++) server.other("t1", `other${i}`);
      const c = makeClient();
      const stop = startDrain(ctx, c.o);
      await settle();
      ctx.net.setOnline(false);
      await send(ctx, c.o, "editTodo", edit("t1", "stale"), { base: 0, owner: OWNER });
      await send(ctx, c.o, "editTodo", edit("t2", "fresh"), { base: others, owner: OWNER });
      ctx.net.setOnline(true);
      await settle();
      expect(server.posts.map((p) => p.title)).toEqual(["stale", "fresh"]);
      const left = entriesOf(c.o);
      expect(left).toHaveLength(1);
      expect(left[0]?.title).toBe("stale");
      expect(left[0]?.state).toBe("conflict");
      expect(left[0]?.head).toBe(others);
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("A `send` refused with a k.sync conflict resolves `{ state: 'conflict', head }`.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.other("t1", "other");
  const c = makeClient();
  const r = await send(ctx, c.o, "editTodo", edit("t1", "stale"), { base: 0, owner: OWNER });
  expect(r).toEqual({ state: "conflict", head: 1 });
  c.dispose();
});

test("A 409 without `data.transaction` is sent once more, with the same key.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), async (title) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      server.next({ kind: "overlap" });
      const c = makeClient();
      const r = await send(ctx, c.o, "editTodo", edit("t1", title), { base: 0, owner: OWNER });
      expect(r.state).toBe("sent");
      expect(server.posts).toHaveLength(2);
      expect(server.posts[1]?.key).toBe(server.posts[0]?.key);
      expect(server.entries()).toEqual([{ todoId: "t1", title }]);
      c.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("A second 409 without `data.transaction` leaves the entry `failed` (std.offline Flush).", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.next({ kind: "overlap" }, { kind: "overlap" });
  const c = makeClient();
  const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
  expect(r.state).toBe("failed");
  expect(server.posts).toHaveLength(2);
  expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
  c.dispose();
});

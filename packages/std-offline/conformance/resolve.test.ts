// Spec: std.offline, clause "`resolve(ctx, o, key, 'mine')` queues the entry last with `base` equal to its conflict `head`; `'theirs'` removes it; each adds one `<id>.resolve` entry to the outbox log."
// Seed 1337
// Assumption: `outbox(...)` returns the client store, so `o.log()` is the outbox log and its entries are named `<id>.resolve`
// with payload `{ key, resolution }` (std.offline Resolve).
import { resolve, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, createServer, edit, entriesOf, makeClient, resolveLog, settle, simCtx } from "./fixtures.ts";

/** An outbox holding one `conflict` entry (head `others`) and, offline, one `queued` entry behind it. */
async function conflicted(others: number) {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  for (let i = 0; i < others; i++) server.other("t1", `other${i}`);
  const c = makeClient();
  await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "mine"), { base: 0 });
  const entry = entriesOf(c.o)[0];
  if (entry === undefined) throw new Error("no conflict entry");
  return { ctx, server, c, key: entry.key };
}

test("`resolve(ctx, o, key, 'mine')` queues the entry last with `base` equal to its conflict `head`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (others) => {
      const { ctx, c, key } = await conflicted(others);
      expect(entriesOf(c.o).map((e) => e.state)).toEqual(["conflict"]);
      ctx.net.setOnline(false);
      await send(ctx, c.o, ORIGIN, "editTodo", edit("t2", "behind"), { base: others });
      const before = resolveLog(c.o, c.id).length;
      await resolve(ctx, c.o, key, "mine");
      const after = entriesOf(c.o);
      expect(after.map((e) => e.key).at(-1)).toBe(key);
      expect(after.map((e) => e.title)).toEqual(["behind", "mine"]);
      const mine = after.at(-1);
      expect(mine?.state).toBe("queued");
      expect(mine?.base).toBe(others);
      expect(resolveLog(c.o, c.id)).toHaveLength(before + 1);
      expect(resolveLog(c.o, c.id).at(-1)).toEqual({ key, resolution: "mine" });
      c.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("`resolve(ctx, o, key, 'mine')` online sends the write over what it conflicted with, with its original key.", async () => {
  const { ctx, server, c, key } = await conflicted(2);
  await resolve(ctx, c.o, key, "mine");
  await settle();
  expect(server.posts.at(-1)?.key).toBe(key);
  expect(server.posts.at(-1)?.base).toBe(2);
  expect(server.entries().at(-1)).toEqual({ todoId: "t1", title: "mine" });
  expect(entriesOf(c.o)).toEqual([]);
  c.dispose();
});

test("`resolve(ctx, o, key, 'theirs')` removes the entry and adds one `<id>.resolve` entry to the outbox log.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (others) => {
      const { ctx, server, c, key } = await conflicted(others);
      const before = resolveLog(c.o, c.id).length;
      const posts = server.posts.length;
      await resolve(ctx, c.o, key, "theirs");
      expect(entriesOf(c.o)).toEqual([]);
      expect(resolveLog(c.o, c.id)).toHaveLength(before + 1);
      expect(resolveLog(c.o, c.id).at(-1)).toEqual({ key, resolution: "theirs" });
      expect(server.posts).toHaveLength(posts);
      c.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("`resolve(ctx, o, key, 'theirs')` removes a `failed` entry too (std.offline Resolve).", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  server.next({ kind: "status", status: 500 });
  const c = makeClient();
  const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "x"), { base: 0 });
  expect(r.state).toBe("failed");
  const entry = entriesOf(c.o)[0];
  expect(entry?.state).toBe("failed");
  await resolve(ctx, c.o, entry?.key ?? "", "theirs");
  expect(entriesOf(c.o)).toEqual([]);
  expect(resolveLog(c.o, c.id)).toHaveLength(1);
  c.dispose();
});

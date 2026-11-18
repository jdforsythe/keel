// Spec: std.offline, clause "After a network failure the next post happens 1 s, 2 s, 4 s later on `ctx.clock` (at most 60 s apart), or at once on `{ kind: 'net', online: true }`."
// Seed 1337
// Assumption: a retry timer started by `send`'s own flush needs no `drain`; the `net` resume test runs `drain` (std.offline Flush).
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { OWNER, createServer, edit, makeClient, settle, simCtx, startDrain, tick } from "./fixtures.ts";

test("After a network failure the next post happens 1 s, 2 s, 4 s later on `ctx.clock` (at most 60 s apart).", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (failures) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      server.next(...Array.from({ length: failures }, () => ({ kind: "reject" as const })));
      const c = makeClient();
      const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
      expect(r).toEqual({ state: "queued" });
      expect(server.posts.map((p) => p.at)).toEqual([0]);
      for (let k = 0; k < failures; k++) {
        const gap = Math.min(1000 * 2 ** k, 60_000);
        await tick(ctx, gap - 1);
        expect(server.posts).toHaveLength(k + 1);
        await tick(ctx, 1);
        expect(server.posts).toHaveLength(k + 2);
        expect((server.posts[k + 1]?.at ?? 0) - (server.posts[k]?.at ?? 0)).toBe(gap);
      }
      expect(server.entries()).toEqual([{ todoId: "t1", title: "x" }]);
      c.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("After a network failure the next post happens at once on `{ kind: 'net', online: true }`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 900 }), async (away) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      server.next({ kind: "reject" });
      const c = makeClient();
      const stop = startDrain(ctx, c.o);
      await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
      expect(server.posts).toHaveLength(1);
      ctx.net.setOnline(false);
      await tick(ctx, away);
      ctx.net.setOnline(true);
      await settle();
      expect(server.posts).toHaveLength(2);
      expect(server.posts[1]?.at).toBe(away);
      expect(server.entries()).toEqual([{ todoId: "t1", title: "x" }]);
      stop();
      c.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

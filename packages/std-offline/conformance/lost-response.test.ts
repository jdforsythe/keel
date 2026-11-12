// Spec: std.offline, clause "When the fetch rejects after the server committed, the entry is resent with the same key and the server store holds one entry for that write."
// Seed 1337
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, createServer, edit, entriesOf, makeClient, simCtx, tick } from "./fixtures.ts";

test("When the fetch rejects after the server committed, the entry is resent with the same key and the server store holds one entry for that write.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3 }), fc.string({ minLength: 1, maxLength: 8 }), async (lost, title) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      server.next(...Array.from({ length: lost }, () => ({ kind: "lose" as const })));
      const c = makeClient();
      const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", title), { base: 0 });
      expect(r).toEqual({ state: "queued" });
      expect(server.entries()).toHaveLength(1);
      let gap = 1000;
      for (let i = 0; i < lost; i++) {
        await tick(ctx, gap);
        gap *= 2;
      }
      expect(server.posts).toHaveLength(lost + 1);
      expect(new Set(server.posts.map((p) => p.key)).size).toBe(1);
      expect(server.entries()).toEqual([{ todoId: "t1", title }]);
      expect(entriesOf(c.o)).toEqual([]);
      c.dispose();
    }),
    { seed: 1337, numRuns: 12 },
  );
});

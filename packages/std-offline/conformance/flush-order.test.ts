// Spec: std.offline, clause "After `setOnline(true)`, queued entries are posted in the order added, one at a time, each with its original key."
// Seed 1337
// Assumption: the flush on `{ kind: 'net', online: true }` is registered by `drain` (std.offline Flush), so the test runs `drain` in a scope first.
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, TODOS, createServer, edit, entriesOf, makeClient, settle, simCtx, startDrain } from "./fixtures.ts";

test("After `setOnline(true)`, queued entries are posted in the order added, one at a time, each with its original key.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(fc.constantFrom(...TODOS), fc.string({ minLength: 1, maxLength: 8 })), {
        minLength: 2,
        maxLength: 5,
      }),
      async (writes) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        server.gated(true);
        const c = makeClient();
        const stop = startDrain(ctx, c.o);
        await settle();
        ctx.net.setOnline(false);
        for (const [todoId, title] of writes)
          await send(ctx, c.o, ORIGIN, "editTodo", edit(todoId, title), { base: 0 });
        const keys = entriesOf(c.o).map((e) => e.key);
        expect(keys).toHaveLength(writes.length);
        expect(server.posts).toHaveLength(0);
        ctx.net.setOnline(true);
        await settle();
        // One request at a time: the first is in flight and the rest wait for it.
        expect(server.posts).toHaveLength(1);
        for (let n = 1; n <= writes.length; n++) {
          server.release();
          await settle();
          expect(server.posts).toHaveLength(Math.min(n + 1, writes.length));
        }
        expect(server.posts.map((p) => p.key)).toEqual(keys);
        expect(server.posts.map((p) => p.title)).toEqual(writes.map(([, title]) => title));
        stop();
        c.dispose();
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
});

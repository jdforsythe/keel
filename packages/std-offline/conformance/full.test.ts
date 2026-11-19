// Spec: std.offline, clause "`send` to an outbox holding `limit` entries resolves `failed` with `offline.full` and adds nothing."
// Seed 1337
// Assumption: the `failed` result's `error` is a KeelError-shaped `{ code }`, so `offline.full` is `error.code`.
import { send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, createServer, edit, entriesOf, makeClient, simCtx, stored } from "./fixtures.ts";

test("`send` to an outbox holding `limit` entries resolves `failed` with `offline.full` and adds nothing.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (limit) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = makeClient({ limit });
      ctx.net.setOnline(false);
      for (let i = 0; i < limit; i++) {
        const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", `w${i}`), { base: 0 });
        expect(r).toEqual({ state: "queued" });
      }
      const keys = entriesOf(c.o).map((e) => e.key);
      expect(keys).toHaveLength(limit);
      const r = await send(ctx, c.o, ORIGIN, "editTodo", edit("t1", "one too many"), { base: 0 });
      expect(r.state).toBe("failed");
      expect(r.state === "failed" ? Reflect.get(Object(r.error), "code") : undefined).toBe("offline.full");
      expect(entriesOf(c.o).map((e) => e.key)).toEqual(keys);
      expect((await stored(ctx, c.storageKey)).map((e) => e.key)).toEqual(keys);
      expect(server.posts).toHaveLength(0);
      c.dispose();
    }),
    { seed: 1337, numRuns: 12 },
  );
});

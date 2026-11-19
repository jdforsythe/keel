// Spec: std.live, clause "Under sim, after `setOnline(false)`, `status()` is `offline` and no read runs; after `setOnline(true)` the stream reopens and exactly one read runs."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { boardArb, counting, createServer, mount, settle, simCtx, tick } from "./fixtures.ts";

test("Under sim, after `setOnline(false)`, `status()` is `offline` and no read runs; after `setOnline(true)` the stream reopens and exactly one read runs.", async () => {
  await fc.assert(
    fc.asyncProperty(
      boardArb,
      fc.integer({ min: 1, max: 100_000 }),
      fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 }),
      async (board, away, saves) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const r = counting(() => board);
        const m = mount(ctx, r.read);
        await settle();
        expect(r.calls()).toBe(1);
        expect(m.status()).toBe("live");
        const opens = server.opens();
        ctx.net.setOnline(false);
        await settle();
        expect(m.status()).toBe("offline");
        for (const item of saves) server.save(item);
        await tick(ctx, away);
        expect(m.status()).toBe("offline");
        expect(r.calls()).toBe(1);
        expect(server.opens()).toBe(opens);
        ctx.net.setOnline(true);
        await settle();
        expect(server.opens()).toBe(opens + 1);
        expect(r.calls()).toBe(2);
        expect(m.status()).toBe("live");
        m.dispose();
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

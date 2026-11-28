// std.live, clause "`status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or a read is pending or failed; `offline` while `ctx.net.online()` is false; `denied` once the channel denies."
// Spec: std.live, clause "After the stream opens, `read` runs once and its value is committed with `hydrate`; `status()` is `connecting` before that commit and `live` after it."
// Seed 1337
// Assumption: a drop while online is `server.drop()` (the stream ends, `online()` stays true); the first reopen is 1 s later on `ctx.clock` (std.channels).
import fc from "fast-check";
import { expect, test } from "vitest";
import { createServer, mount, readBoard, settle, simCtx, tick } from "./fixtures.ts";

test("After a drop while online, `status()` is not `live` while no stream is open, and after the reopen a write made in the gap is read", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 4 }),
      fc.integer({ min: 0, max: 999 }),
      async (items, into) => {
        const ctx = simCtx();
        const server = createServer();
        server.attach(ctx);
        const m = mount(ctx, readBoard);
        await settle();
        expect(m.status()).toBe("live");
        expect(server.openNow()).toBe(1);
        server.drop();
        await settle();
        expect(ctx.net.online()).toBe(true);
        expect(server.openNow()).toBe(0);
        expect(m.status()).not.toBe("live");
        // writes made while no stream is open reach no one
        for (const item of items) server.save(item);
        await tick(ctx, into);
        expect(server.openNow()).toBe(0);
        expect(m.status()).not.toBe("live");
        expect(m.view.get("items")).toEqual([]);
        await tick(ctx, 1000 - into);
        await tick(ctx, 1000);
        expect(server.openNow()).toBe(1);
        expect(m.view.get("items")).toEqual(items);
        expect(m.status()).toBe("live");
        m.dispose();
      },
    ),
    { seed: 1337, numRuns: 15 },
  );
});

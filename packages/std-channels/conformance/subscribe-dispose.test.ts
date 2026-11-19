// Spec: std.channels, clause "Disposing the scope that called `subscribe` aborts its request, and `on` gets no later event."
// Seed 1337
// Assumption: `scope(fn)` returns a handle with `dispose()` (k.reactive).
import { scope } from "@keel/reactive";
import { subscribe } from "@keel/std-channels";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, roomChannel, scripted, settle, simCtx, waitFor } from "./fixtures.ts";

test("Disposing the scope that called `subscribe` aborts its request, and `on` gets no later event.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 1, max: 5 }), async (before, after) => {
      const ctx = simCtx();
      const srv = scripted(ctx);
      const got: unknown[] = [];
      const sc = scope(() => {
        subscribe(ctx, ORIGIN, roomChannel, { room: "a" }, (e) => got.push(e));
      });
      await waitFor(() => srv.requests.length === 1);
      srv.send({ kind: "reset" });
      for (let i = 1; i <= before; i++) srv.send({ kind: "saved", store: "chan.log", head: i });
      await waitFor(() => got.length === before + 1);
      expect(srv.requests[0]?.signal.aborted).toBe(false);
      sc.dispose();
      await settle();
      expect(srv.requests[0]?.signal.aborted).toBe(true);
      const count = got.length;
      for (let i = 0; i < after; i++) srv.send({ kind: "saved", store: "chan.log", head: 100 + i });
      await ctx.clock.advance(60_000);
      await settle();
      expect(got).toHaveLength(count);
      expect(srv.requests).toHaveLength(1);
    }),
    { seed: 1337, numRuns: 10 },
  );
});

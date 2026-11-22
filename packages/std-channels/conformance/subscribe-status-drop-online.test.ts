// Spec: std.channels, clause "Under sim, `subscribe` reopens 1 s, 2 s, 4 s after successive drops on `ctx.clock`, sends nothing while `online()` is false, reconnects on `{ kind: 'net', online: true }`, and its `status()` passes through `connecting`, `open`, `offline` and `denied` as those happen."
// Seed 1337
// Assumptions: as subscribe-backoff.test.ts. A drop while online is the stream ending (`end()`); the gap is the backoff wait
// until the reopened stream, and `status()` is `open` once the stream delivers its `reset`.
import { scope } from "@keel/reactive";
import { subscribe } from "@keel/std-channels";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, roomChannel, scripted, settle, simCtx, waitFor } from "./fixtures.ts";

type Handle = ReturnType<typeof subscribe>;

test("`status()` is `connecting` during the backoff wait after a drop while online, until the reopened stream, and never `open` in that gap", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 999 }), async (into) => {
      const ctx = simCtx();
      const srv = scripted(ctx);
      const box: { handle?: Handle } = {};
      const sc = scope(() => {
        box.handle = subscribe(ctx, ORIGIN, roomChannel, { room: "a" }, () => undefined);
      });
      const status = () => box.handle?.status();
      await waitFor(() => srv.requests.length === 1);
      srv.send({ kind: "reset" });
      await waitFor(() => status() === "open");
      // a drop while online: the stream ends
      srv.end();
      await settle();
      expect(ctx.net.online()).toBe(true);
      expect(status()).toBe("connecting");
      // anywhere inside the 1 s wait, nothing is open
      await ctx.clock.advance(into);
      await settle();
      expect(srv.requests).toHaveLength(1);
      expect(status()).toBe("connecting");
      // the reopen starts the next request; until its stream delivers, it is not open
      await ctx.clock.advance(1000 - into);
      await waitFor(() => srv.requests.length === 2);
      expect(status()).toBe("connecting");
      srv.send({ kind: "reset" });
      await waitFor(() => status() === "open");
      sc.dispose();
    }),
    { seed: 1337, numRuns: 8 },
  );
});

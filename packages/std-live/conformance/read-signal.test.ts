// Spec: std.live, clause "Under sim, a read that never settles has its `signal` not aborted 29,999 ms after it starts and aborted at 30,000 ms; disposing the scope while another such read is pending aborts its `signal`."
// Seed 1337
// Assumption: `read` is called as `read(ctx, signal)`; the first read starts when the stream opens on mount.
// The lead-in tick varies the clock reading at which the read starts; the bound counts from that start.
import fc from "fast-check";
import { expect, test } from "vitest";
import { controlled, createServer, mount, settle, simCtx, tick } from "./fixtures.ts";

test("Under sim, a read that never settles has its `signal` not aborted 29,999 ms after it starts and aborted at 30,000 ms; disposing the scope while another such read is pending aborts its `signal`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), async (lead) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      await tick(ctx, lead);

      const c = controlled();
      const m = mount(ctx, c.read);
      await settle();
      expect(c.calls()).toBe(1);
      const first = c.signal(0);
      expect(first.aborted).toBe(false);
      await tick(ctx, 29_999);
      expect(first.aborted).toBe(false);
      await tick(ctx, 1);
      expect(first.aborted).toBe(true);
      m.dispose();

      const d = controlled();
      const m2 = mount(ctx, d.read);
      await settle();
      expect(d.calls()).toBe(1);
      const second = d.signal(0);
      expect(second.aborted).toBe(false);
      m2.dispose();
      await settle();
      expect(second.aborted).toBe(true);
    }),
    { seed: 1337, numRuns: 10 },
  );
});

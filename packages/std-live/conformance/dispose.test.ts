// Spec: std.live, clause "Disposing the scope closes the stream, and a read in flight then commits nothing."
// Seed 1337
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { boardArb, controlled, createServer, mount, settle, simCtx, tick } from "./fixtures.ts";

test("Disposing the scope closes the stream, and a read in flight then commits nothing.", async () => {
  await fc.assert(
    fc.asyncProperty(boardArb, async (board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = controlled();
      const m = mount(ctx, c.read);
      await settle();
      expect(server.openNow()).toBe(1);
      expect(c.calls()).toBe(1);
      m.dispose();
      await settle();
      expect(server.openNow()).toBe(0);
      c.resolve(0, ok(board));
      await settle();
      expect(m.view.log()).toHaveLength(0);
      const opens = server.opens();
      server.save("late");
      await tick(ctx, 100_000);
      expect(server.opens()).toBe(opens);
      expect(c.calls()).toBe(1);
      expect(m.view.log()).toHaveLength(0);
    }),
    { seed: 1337, numRuns: 15 },
  );
});

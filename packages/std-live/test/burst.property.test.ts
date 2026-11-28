// Property: std.live commits at most one read per event burst. For any script of bursts (k `saved` events while one
// read is pending), the reads run equal one per burst plus the first. Seed 1337.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { mount, server, settle } from "./helpers.ts";

test("each burst of saved events during a read causes exactly one more read", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 1, max: 6 }), { maxLength: 8 }), async (bursts) => {
      const { ctx, emit } = server();
      const pending: (() => void)[] = [];
      let reads = 0;
      const m = mount(
        ctx,
        () =>
          new Promise((done) => {
            reads++;
            pending.push(() => done(ok(reads)));
          }),
      );
      await settle();
      let expected = 1;
      for (const k of bursts) {
        for (let i = 0; i < k; i++) emit({ kind: "saved", store: "board", head: i + 1 });
        await settle();
        pending.shift()?.();
        await settle();
        expected++;
        expect(reads).toBe(expected);
      }
      pending.shift()?.();
      await settle();
      expect(m.view.log().length).toBeLessThanOrEqual(expected);
      m.dispose();
    }),
    { seed: 1337, numRuns: 40 },
  );
});

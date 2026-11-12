// Spec: std.live, clause "After the stream opens, `read` runs once and its value is committed with `hydrate`; `status()` is `connecting` before that commit and `live` after it."
// Seed 1337
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { boardArb, controlled, createServer, mount, settle, simCtx } from "./fixtures.ts";

test("After the stream opens, `read` runs once and its value is committed with `hydrate`; `status()` is `connecting` before that commit and `live` after it.", async () => {
  await fc.assert(
    fc.asyncProperty(boardArb, async (board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = controlled();
      const m = mount(ctx, c.read);
      expect(m.status()).toBe("connecting");
      await settle();
      expect(server.opens()).toBe(1);
      expect(c.calls()).toBe(1);
      expect(m.status()).toBe("connecting");
      expect(m.view.log()).toHaveLength(0);
      c.resolve(0, ok(board));
      await settle();
      expect(c.calls()).toBe(1);
      expect(m.view.log().map((e) => e.name)).toEqual([m.hydrate.name]);
      expect(m.view.get("items")).toEqual(board.items);
      expect(m.view.get("head")).toBe(board.head);
      expect(m.status()).toBe("live");
      m.dispose();
    }),
    { seed: 1337, numRuns: 25 },
  );
});

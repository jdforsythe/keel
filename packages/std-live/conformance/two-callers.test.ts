// Spec: std.live, clause "With callers A and B subscribed to one sim server, a write by A is in B's hydrated store after B's next read, with no input from B."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { api, createServer, mount, readBoard, settle, simCtx } from "./fixtures.ts";

test("With callers A and B subscribed to one sim server, a write by A is in B's hydrated store after B's next read, with no input from B.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 5 }), async (items) => {
      const server = createServer();
      const a = simCtx();
      const b = simCtx(1338);
      server.attach(a);
      server.attach(b);
      const ma = mount(a, readBoard);
      const mb = mount(b, readBoard);
      await settle();
      expect(server.openNow()).toBe(2);
      const before = mb.view.log().length;
      for (const item of items) {
        const r = await api.add({ body: { item } }, a);
        expect(r.ok).toBe(true);
        await settle();
        expect(mb.view.get("items")).toEqual(server.value().items);
      }
      expect(mb.view.get("items")).toEqual(items);
      expect(mb.view.log().length).toBeGreaterThan(before);
      expect(mb.view.log().every((e) => e.name === mb.hydrate.name)).toBe(true);
      ma.dispose();
      mb.dispose();
    }),
    { seed: 1337, numRuns: 15 },
  );
});

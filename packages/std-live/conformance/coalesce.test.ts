// Spec: std.live, clause "Three `saved` events during one read cause exactly one more read."
// Seed 1337
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { boardArb, controlled, createServer, mount, settle, simCtx } from "./fixtures.ts";

test("Three `saved` events during one read cause exactly one more read.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = controlled();
  const m = mount(ctx, c.read);
  await settle();
  expect(c.calls()).toBe(1);
  for (const head of [1, 2, 3]) server.emit({ kind: "saved", store: "board", head });
  await settle();
  expect(c.calls()).toBe(1);
  c.resolve(0, ok({ head: 3, items: [] }));
  await settle();
  expect(c.calls()).toBe(2);
  c.resolve(1, ok({ head: 3, items: [] }));
  await settle();
  expect(c.calls()).toBe(2);
  m.dispose();
});

test("For any number of `saved` events during one read, exactly one more read runs after it.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 12 }), boardArb, async (n, board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = controlled();
      const m = mount(ctx, c.read);
      await settle();
      for (let head = 1; head <= n; head++) server.emit({ kind: "saved", store: "board", head });
      await settle();
      c.resolve(0, ok(board));
      await settle();
      expect(c.calls()).toBe(2);
      c.resolve(1, ok(board));
      await settle();
      expect(c.calls()).toBe(2);
      m.dispose();
    }),
    { seed: 1337, numRuns: 25 },
  );
});

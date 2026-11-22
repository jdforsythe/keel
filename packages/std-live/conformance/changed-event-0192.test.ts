// Spec: std.live, clause "A `changed` event during one read causes exactly one more read; with callers A and B on one sim server whose route follows a database, a write by A that calls `changed` is in B's hydrated store after B's next read."
// Seed 1337
// Pending (rfc:0192): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: the sim server is modelled in changed-fixtures.ts (see its header); the first half uses the existing sim server's `emit`.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { createFollowingServer } from "./changed-fixtures.ts";
import { api, boardArb, controlled, createServer, mount, readBoard, settle, simCtx } from "./fixtures.ts";

const CLAUSE =
  "A `changed` event during one read causes exactly one more read; with callers A and B on one sim server whose route follows a database, a write by A that calls `changed` is in B's hydrated store after B's next read.";

test(`${CLAUSE} (one \`changed\` during a read causes exactly one more)`, async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = controlled();
  const m = mount(ctx, c.read);
  await settle();
  expect(c.calls()).toBe(1);
  server.emit({ kind: "changed" });
  await settle();
  expect(c.calls()).toBe(1);
  c.resolve(0, ok({ head: 0, items: [] }));
  await settle();
  expect(c.calls()).toBe(2);
  c.resolve(1, ok({ head: 0, items: [] }));
  await settle();
  expect(c.calls()).toBe(2);
  m.dispose();
});

test(`${CLAUSE} (for any number of \`changed\` events during one read, exactly one more read runs)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 12 }), boardArb, async (n, board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = controlled();
      const m = mount(ctx, c.read);
      await settle();
      for (let i = 0; i < n; i++) server.emit({ kind: "changed" });
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

test(`${CLAUSE} (a write by A that calls \`changed\` is in B's hydrated store after B's next read)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 5 }), async (items) => {
      const server = createFollowingServer();
      const a = simCtx();
      const b = simCtx(1338);
      server.attach(a);
      server.attach(b);
      const ma = mount(a, readBoard);
      const mb = mount(b, readBoard);
      await settle();
      expect(server.openNow()).toBe(2);
      for (const item of items) {
        expect((await api.add({ body: { item } }, a)).ok).toBe(true);
        await settle();
        expect(mb.view.get("items")).toEqual(server.items());
      }
      expect(mb.view.get("items")).toEqual(items);
      ma.dispose();
      mb.dispose();
    }),
    { seed: 1337, numRuns: 15 },
  );
});

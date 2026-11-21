// Spec: std.live, clause "A read that resolves after a read started later commits nothing."
// Seed 1337
// Assumption: a read is tagged by its call index through `head`; "commits nothing" is read off the hydrated store's log,
// whose committed tags must rise strictly with the index of the read that produced them, whatever order reads resolve in.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { controlled, createServer, mount, settle, simCtx, tagsOf } from "./fixtures.ts";

type Op = { op: "save" } | { op: "resolve"; pick: number } | { op: "bounce" };
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ op: "save" }),
  fc.constant<Op>({ op: "bounce" }),
  fc.nat({ max: 5 }).map((pick): Op => ({ op: "resolve", pick })),
);

test("A read that resolves after a read started later commits nothing.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(opArb, { maxLength: 14 }), async (ops) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const c = controlled();
      const m = mount(ctx, c.read);
      await settle();
      const resolved = new Set<number>();
      let saves = 0;
      for (const o of ops) {
        if (o.op === "save") server.emit({ kind: "saved", store: "board", head: ++saves });
        else if (o.op === "bounce") {
          ctx.net.setOnline(false);
          ctx.net.setOnline(true);
        } else {
          const open = [...Array(c.calls()).keys()].filter((i) => !resolved.has(i));
          const i = open[o.pick % Math.max(open.length, 1)];
          if (i !== undefined) {
            resolved.add(i);
            c.resolve(i, ok({ head: i, items: [] }));
          }
        }
        await settle();
      }
      // Resolve whatever is left, newest first.
      for (let i = c.calls() - 1; i >= 0; i--) {
        if (!resolved.has(i)) c.resolve(i, ok({ head: i, items: [] }));
        await settle();
      }
      const tags = tagsOf(m.view);
      for (let k = 1; k < tags.length; k++) expect(tags[k]).toBeGreaterThan(tags[k - 1] ?? Number.NEGATIVE_INFINITY);
      m.dispose();
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("A read resolved after the stream reopened and a later read started commits nothing, whatever order reads resolve in.", async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = controlled();
  const m = mount(ctx, c.read);
  await settle();
  ctx.net.setOnline(false);
  await settle();
  ctx.net.setOnline(true);
  await settle();
  for (let i = c.calls() - 1; i >= 0; i--) {
    c.resolve(i, ok({ head: i, items: [] }));
    await settle();
  }
  const tags = tagsOf(m.view);
  expect(tags).toEqual([...tags].sort((a, b) => a - b));
  expect(new Set(tags).size).toBe(tags.length);
  m.dispose();
});

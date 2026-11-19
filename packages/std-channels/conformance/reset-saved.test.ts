// Spec: std.channels, clause "A member's stream starts with `{ kind: 'reset' }` and then gets `{ kind: 'saved', store, head }` after each save of a store its channel's `stores` creates, in save order."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Op, serve, settle, waitFor } from "./fixtures.ts";

const ops = fc.array(fc.constantFrom<Op>("bump", "note", "other"), { maxLength: 8 });

test("A member's stream starts with `{ kind: 'reset' }` and then gets `{ kind: 'saved', store, head }` after each save of a store its channel's `stores` creates, in save order.", async () => {
  await fc.assert(
    fc.asyncProperty(ops, async (seq) => {
      const h = await serve();
      try {
        const a = await h.enroll();
        const b = await h.enroll();
        const first = await h.open("r", a);
        const second = await h.open("r", b);
        await waitFor(() => first.events.length >= 1 && second.events.length >= 1);
        const expected: unknown[] = [{ kind: "reset" }];
        const heads = { bump: 0, note: 0 };
        for (const op of seq) {
          await h.act(op, a);
          if (op === "bump") expected.push({ kind: "saved", store: "chan.log", head: ++heads.bump });
          if (op === "note") expected.push({ kind: "saved", store: "chan.notes", head: ++heads.note });
        }
        await waitFor(() => first.events.length >= expected.length && second.events.length >= expected.length);
        await settle();
        expect(first.events).toEqual(expected);
        expect(second.events).toEqual(expected);
        first.close();
        second.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

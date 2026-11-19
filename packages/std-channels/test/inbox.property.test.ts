import fc from "fast-check";
import { expect, test } from "vitest";
import type { ChannelEvent } from "../src/ChannelEvent.ts";
import { inbox } from "../src/server/internal/inbox.ts";

const saved = (head: number): ChannelEvent<never> => ({ kind: "saved", store: "a.s", head });

test("an inbox hands out what was pushed, in order, up to 256 unread; past that it ends", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 300 }), async (n) => {
      const box = inbox<never>();
      const ac = new AbortController();
      for (let i = 0; i < n; i++) box.push(saved(i));
      if (n > 256) {
        expect(await box.next(ac.signal)).toBeUndefined();
        return;
      }
      const got: unknown[] = [];
      for (let i = 0; i < n; i++) got.push(await box.next(ac.signal));
      expect(got).toEqual(Array.from({ length: n }, (_, i) => saved(i)));
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("a waiting next resolves on a push, and undefined once the signal aborts", async () => {
  const box = inbox<never>();
  const ac = new AbortController();
  const first = box.next(ac.signal);
  box.push({ kind: "reset" });
  expect(await first).toEqual({ kind: "reset" });
  const second = box.next(ac.signal);
  ac.abort();
  expect(await second).toBeUndefined();
  box.push({ kind: "reset" });
  expect(await box.next(ac.signal)).toBeUndefined();
});

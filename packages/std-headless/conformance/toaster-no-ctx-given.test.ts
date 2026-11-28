// RFC 0162 Conformance diff: "A Toaster toast with `duration` dismisses itself after that time on the ctx's clock, rendered by `render` with no ctx given."
// std.headless Toaster "a `status` item with `duration` 5,000 calls `onDismiss` after 5,000 ms of sim clock and not before". Seed: 1337.
// @vitest-environment happy-dom
// A `duration` below 5,000 counts as 5,000 (std.headless Toaster), so durations run from 5,000 up.
// ASSUMPTION: the handle exposes the sim ctx `render` made as `ctx` (RFC 0162 Conformance diff: "the same one its handle exposes as `ctx`"); time moves with `t.ctx.clock.advance(ms)` then `await t.settle()`.
// Not built: the handle's `ctx` (RFC 0162: "the same one its handle exposes as `ctx`"); `Harness` (k.testing) lists no `ctx`, so these assertions fail until it exists.
import { signal } from "@keel/reactive";
import { Toaster } from "@keel/std-headless";
import type { ToastItem } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, inScope, page } from "./fixtures.ts";

const saved: ToastItem = { id: "saved", text: "Order saved", tone: "status" };

test("A Toaster toast with `duration` dismisses itself after that time on the ctx's clock, rendered by `render` with no ctx given", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 5_000, max: 20_000 }), async (duration) => {
      const items = inScope(() => signal<readonly ToastItem[]>([saved]));
      const dismissed: string[] = [];
      const t = render(
        page((c) =>
          Toaster(
            {
              id: "tz",
              items: () => items.get(),
              onDismiss: (id) => {
                dismissed.push(id);
                items.set(items.get().filter((i) => i.id !== id));
              },
              dismiss: "Dismiss",
              duration,
            },
            c,
          ),
        ),
        { props: {} },
      );
      t.ctx.clock.advance(duration - 1);
      await t.settle();
      expect(dismissed).toEqual([]);
      t.ctx.clock.advance(1);
      await t.settle();
      expect(dismissed).toEqual(["saved"]);
      t.dispose();
    }),
    { seed: SEED, numRuns: 15 },
  );
});

// Spec: std.headless, clause "A Toaster renders empty `status` and `alert` regions; a `status` item with `duration` 5,000 calls `onDismiss` after 5,000 ms of sim clock and not before; focus inside it holds it past 5,000 ms; an `alert` item stays."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: time moves with `ctx.clock.advance(ms)` then `await t.settle()`; the dismiss button `<id>.dismiss.<item>` is "inside the item", so focus on it sends `pause`
// and blur sends `resume`; `onDismiss` is called once per item.
import { Toaster } from "@keel/std-headless";
import type { ToastItem } from "@keel/std-headless";
import { signal } from "@keel/reactive";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { inScope, page, SEED, simCtx } from "./fixtures.ts";

const mount = (initial: readonly ToastItem[]) => {
  const ctx = simCtx();
  const items = inScope(() => signal<readonly ToastItem[]>(initial));
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
          duration: 5000,
        },
        c,
      ),
    ),
    { props: {}, ctx },
  );
  const wait = async (ms: number) => {
    ctx.clock.advance(ms);
    await t.settle();
  };
  return { t, items, dismissed, wait };
};

const saved: ToastItem = { id: "saved", text: "Order saved", tone: "status" };
const failed: ToastItem = { id: "failed", text: "Payment failed", tone: "alert" };

describe("std.headless: Toaster", () => {
  test("A Toaster renders empty `status` and `alert` regions", () => {
    const { t } = mount([]);
    expect(t.find("tz.status").role).toBe("status");
    expect(t.find("tz.alert").role).toBe("alert");
    expect(t.find("tz.status").text).toBe("");
    expect(t.find("tz.alert").text).toBe("");
    t.dispose();
  });

  test("an item renders in the region of its tone with a dismiss button", () => {
    const { t } = mount([saved, failed]);
    expect(t.find("tz.toast.saved").text).toContain("Order saved");
    expect(t.find("tz.toast.failed").text).toContain("Payment failed");
    expect(t.find("tz.dismiss.saved").role).toBe("button");
    expect(t.find("tz.dismiss.saved").name).toBe("Dismiss");
    expect(t.find("tz.status").text).toContain("Order saved");
    expect(t.find("tz.alert").text).toContain("Payment failed");
    expect(t.find("tz.status").text).not.toContain("Payment failed");
    t.dispose();
  });

  test("a `status` item with `duration` 5,000 calls `onDismiss` after 5,000 ms of sim clock and not before", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 4999 }), async (early) => {
        const { t, dismissed, wait } = mount([saved]);
        await wait(early);
        expect(dismissed).toEqual([]);
        await wait(4999 - early);
        expect(dismissed).toEqual([]);
        await wait(1);
        expect(dismissed).toEqual(["saved"]);
        await wait(10_000);
        expect(dismissed).toEqual(["saved"]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("focus inside it holds it past 5,000 ms", async () => {
    const { t, dismissed, wait } = mount([saved]);
    await wait(3000);
    await t.fire("tz.dismiss.saved", { type: "focus" });
    await wait(60_000);
    expect(dismissed).toEqual([]);
    t.dispose();
  });

  test("leaving the item resumes it and starts the full duration again", async () => {
    const { t, dismissed, wait } = mount([saved]);
    await wait(4000);
    await t.fire("tz.dismiss.saved", { type: "focus" });
    await wait(20_000);
    await t.fire("tz.dismiss.saved", { type: "blur" });
    await wait(4999);
    expect(dismissed).toEqual([]);
    await wait(1);
    expect(dismissed).toEqual(["saved"]);
    t.dispose();
  });

  test("an `alert` item stays", async () => {
    const { t, dismissed, wait } = mount([failed]);
    await wait(600_000);
    expect(dismissed).toEqual([]);
    expect(t.find("tz.toast.failed").text).toContain("Payment failed");
    await t.fire("tz.dismiss.failed", { type: "click" });
    await t.settle();
    expect(dismissed).toEqual(["failed"]);
    t.dispose();
  });
});

// @vitest-environment happy-dom
// A Toaster's per-toast chart keys stay within the 64-character key for any id and any number of toasts.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { render } from "@keel/testing";
import { expect, test } from "vitest";
import { page, shown, simCtx } from "../conformance/fixtures.ts";
import type { ToastItem } from "../src/ToastItem.ts";
import { Toaster } from "../src/Toaster.ts";
import { openChart } from "../src/openChart.ts";

const held = (): Signal<readonly ToastItem[]> => {
  const made: Signal<readonly ToastItem[]>[] = [];
  scope(() => void made.push(signal<readonly ToastItem[]>([])));
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};

test("a 64-character Toaster id shows toast after toast, past the tenth and the hundredth", async () => {
  const id = "t".repeat(64);
  const items = held();
  const t = render(
    page((c) => Toaster({ id, items: () => items.get(), onDismiss: () => {}, dismiss: "Dismiss" }, undefined, c)),
    { props: {}, ctx: simCtx() },
  );
  for (let n = 1; n <= 120; n++) {
    items.set([...items.get().slice(-3), { id: `n${n}`, text: "Saved", tone: "alert" }]);
    await t.settle();
  }
  expect(shown(`${id}.toast.n120`)).toBe(true);
  t.dispose();
});

test("an invalid instance key names the character class `[\\w.-]` in its message", () => {
  scope(() => {
    expect(() => instance(openChart, "a b")).toThrow("[\\w.-]{1,64}");
  });
});

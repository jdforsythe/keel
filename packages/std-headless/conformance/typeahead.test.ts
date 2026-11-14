// Spec: std.options, Conformance "Typing `b`, `e` within 500 ms highlights the first option after the active one whose text starts with `be`; after 500 ms with no key a new buffer starts."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: time moves with `ctx.clock.advance(ms)` then `await t.settle()`; a buffer is cleared when 500 ms have passed since the last key (at 499 ms it is still held);
// no wrap past the last option is asserted.
import { Listbox, Menu } from "@keel/std-headless";
import type { Option } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, page, simCtx } from "./fixtures.ts";

const words: readonly Option<string>[] = [
  { key: "apple", text: "Apple" },
  { key: "banana", text: "Banana" },
  { key: "beet", text: "Beet" },
  { key: "berry", text: "Berry" },
  { key: "cherry", text: "Cherry" },
];

const mount = () => {
  const ctx = simCtx();
  const t = render(
    page((c) =>
      Listbox(
        { id: "ty", label: "Words", options: () => words, mode: "single", selected: () => [], onChange: () => {} },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx },
  );
  const type = (k: string) => t.fire("ty.list", { type: "keydown", key: k });
  const wait = async (ms: number) => {
    ctx.clock.advance(ms);
    await t.settle();
  };
  return { t, type, wait, active: () => t.find("ty.list").state.active };
};

describe("std.options: typeahead", () => {
  test("Typing `b`, `e` within 500 ms highlights the first option after the active one whose text starts with `be`", async () => {
    const { t, type, wait, active } = mount();
    await t.fire("ty.list", { type: "focus" });
    expect(active()).toBe("ty.option.apple");
    await type("b");
    expect(active()).toBe("ty.option.banana");
    await wait(499);
    await type("e");
    expect(active()).toBe("ty.option.beet");
    t.dispose();
  });

  test("after 500 ms with no key a new buffer starts", async () => {
    const { t, type, wait, active } = mount();
    await t.fire("ty.list", { type: "focus" });
    await type("b");
    expect(active()).toBe("ty.option.banana");
    await wait(500);
    await type("b");
    expect(active()).toBe("ty.option.beet");
    t.dispose();
  });

  test("typeahead is case-insensitive for any casing of `be` (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("be", "BE", "bE", "Be"), async (typed) => {
        const { t, type, active } = mount();
        await t.fire("ty.list", { type: "focus" });
        for (const ch of typed) await type(ch);
        expect(active()).toBe("ty.option.beet");
        t.dispose();
      }),
      { seed: SEED, numRuns: 4 },
    );
  });

  test("a Menu takes typeahead too: after 500 ms a new buffer starts", async () => {
    const ctx = simCtx();
    const t = render(
      page((c) => Menu({ id: "tm", trigger: () => "Words", items: () => words, onSelect: () => {} }, undefined, c)),
      { props: {}, ctx },
    );
    await t.fire("tm.trigger", { type: "keydown", key: "Enter" });
    await t.fire("tm.menu", { type: "keydown", key: "b" });
    expect(t.find("tm.menu").state.active).toBe("tm.item.banana");
    ctx.clock.advance(500);
    await t.settle();
    await t.fire("tm.menu", { type: "keydown", key: "b" });
    expect(t.find("tm.menu").state.active).toBe("tm.item.beet");
    t.dispose();
  });
});

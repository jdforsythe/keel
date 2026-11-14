// Spec: std.options, Conformance "In single mode Space calls `onChange([key])` with the active key; in multiple it adds or removes the key and keeps the others; a disabled option is never in a call."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: `onChange` receives the whole new selection; in multiple the order of the keys in a call is not asserted (compared sorted); `selected` is read afresh on each call.
import { Listbox } from "@keel/std-headless";
import type { Option } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, page, simCtx } from "./fixtures.ts";

const base: readonly Option<string>[] = [
  { key: "apple", text: "Apple" },
  { key: "banana", text: "Banana" },
  { key: "cherry", text: "Cherry" },
  { key: "date", text: "Date" },
];

const mount = (mode: "single" | "multiple", selected: readonly string[], options: readonly Option<string>[] = base) => {
  const calls: string[][] = [];
  const t = render(
    page((c) =>
      Listbox(
        {
          id: "lb",
          label: "Fruit",
          options: () => options,
          mode,
          selected: () => selected,
          onChange: (keys) => {
            calls.push([...keys]);
          },
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  return { t, calls };
};

const key = (t: ReturnType<typeof mount>["t"], k: string) => t.fire("lb.list", { type: "keydown", key: k });

describe("std.options: Listbox selection", () => {
  test("In single mode Space calls `onChange([key])` with the active key", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (n) => {
        const { t, calls } = mount("single", []);
        await t.fire("lb.list", { type: "focus" });
        for (let i = 0; i < n; i++) await key(t, "ArrowDown");
        await key(t, " ");
        expect(calls).toEqual([[base[n]?.key]]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("in single mode Enter does the same as Space, and a click jumps to the option and does the same", async () => {
    const { t, calls } = mount("single", []);
    await t.fire("lb.list", { type: "focus" });
    await key(t, "ArrowDown");
    await key(t, "Enter");
    await t.fire("lb.option.cherry", { type: "click" });
    expect(calls).toEqual([["banana"], ["cherry"]]);
    t.dispose();
  });

  test("in multiple it adds the key and keeps the others", async () => {
    const { t, calls } = mount("multiple", ["cherry", "date"]);
    await t.fire("lb.list", { type: "focus" });
    expect(t.find("lb.list").state.active).toBe("lb.option.cherry");
    await key(t, "Home");
    await key(t, " ");
    expect(calls).toHaveLength(1);
    expect([...(calls[0] ?? [])].sort()).toEqual(["apple", "cherry", "date"]);
    t.dispose();
  });

  test("in multiple it removes the key and keeps the others", async () => {
    const { t, calls } = mount("multiple", ["banana", "date"]);
    await t.fire("lb.list", { type: "focus" });
    expect(t.find("lb.list").state.active).toBe("lb.option.banana");
    await key(t, " ");
    expect(calls).toEqual([["date"]]);
    t.dispose();
  });

  test("a disabled option is never in a call (property over disabled flags and key sequences, both modes)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"single" | "multiple">("single", "multiple"),
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        fc.array(fc.constantFrom("ArrowDown", "ArrowUp", "Home", "End", " ", "Enter"), { maxLength: 14 }),
        async (mode, off, keys) => {
          const options = base.map((o, i) => ({ ...o, disabled: off[i] === true }));
          const disabled = options.filter((o) => o.disabled).map((o) => o.key);
          const enabledSelected = options.filter((o) => !o.disabled && o.key !== "date").map((o) => o.key);
          const { t, calls } = mount(mode, enabledSelected.slice(0, 1), options);
          await t.fire("lb.list", { type: "focus" });
          for (const k of keys) await key(t, k);
          for (const k of disabled) await t.fire(`lb.option.${k}`, { type: "click" });
          for (const call of calls) for (const d of disabled) expect(call).not.toContain(d);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("a disabled option can be highlighted and Space on it makes no call", async () => {
    const options = base.map((o) => (o.key === "banana" ? { ...o, disabled: true } : o));
    const { t, calls } = mount("single", [], options);
    await t.fire("lb.list", { type: "focus" });
    await key(t, "ArrowDown");
    expect(t.find("lb.list").state.active).toBe("lb.option.banana");
    await key(t, " ");
    expect(calls).toEqual([]);
    t.dispose();
  });
});

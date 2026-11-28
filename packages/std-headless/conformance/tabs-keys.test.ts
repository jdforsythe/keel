// Spec: std.options, clause "Tabs: ArrowRight on the last tab calls `onChange` with the first key and focuses it; only the selected tab has `tabindex=\"0\"` and only its panel is shown; `focusOrder()` (k.a11y) holds one tab."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: the app holds `selected` in a signal that `onChange` sets; "only its panel is shown" is read by id (`hidden`); "only the selected tab has `tabindex="0"`" is
// read through `focusOrder()`, which lists a tab only when its `tabindex` is 0, and by id.
import { signal } from "@keel/reactive";
import { Tabs } from "@keel/std-headless";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, el, fruit, inScope, page, shown, simCtx } from "./fixtures.ts";

const keys = fruit.map((o) => o.key);

const mount = (start: string) => {
  const picked = inScope(() => signal(start));
  const changes: string[] = [];
  const t = render(
    page((c) =>
      Tabs(
        {
          id: "tb",
          label: "Fruit",
          tabs: () => fruit,
          selected: () => picked.get(),
          onChange: (k) => {
            changes.push(k);
            picked.set(k);
          },
          panel: (k) => Text({ id: `tb.body.${k}`, children: `About ${k}` }),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  return { t, changes, picked };
};

const tabsIn = (order: readonly string[]) => order.filter((id) => id.startsWith("tb.tab."));

describe("std.options: Tabs keys", () => {
  test("Tabs: ArrowRight on the last tab calls `onChange` with the first key and focuses it", async () => {
    const { t, changes } = mount("cherry");
    await t.fire("tb.tab.cherry", { type: "focus" });
    await t.fire("tb.tab.cherry", { type: "keydown", key: "ArrowRight" });
    expect(changes).toEqual(["apple"]);
    expect(t.find("tb.tab.apple").state.focused).toBe(true);
    t.dispose();
  });

  test('only the selected tab has `tabindex="0"` and only its panel is shown', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...keys), async (sel) => {
        const { t } = mount(sel);
        for (const k of keys) {
          expect(el(`tb.tab.${k}`)?.getAttribute("tabindex")).toBe(k === sel ? "0" : "-1");
          expect(t.find(`tb.tab.${k}`).state.selected).toBe(k === sel);
          expect(shown(`tb.panel.${k}`)).toBe(k === sel);
        }
        expect(t.find("tb.list").role).toBe("tablist");
        t.dispose();
      }),
      { seed: SEED, numRuns: 9 },
    );
  });

  test("`focusOrder()` (k.a11y) holds one tab", async () => {
    const { t } = mount("banana");
    expect(tabsIn(t.focusOrder())).toEqual(["tb.tab.banana"]);
    await t.fire("tb.tab.banana", { type: "focus" });
    await t.fire("tb.tab.banana", { type: "keydown", key: "ArrowRight" });
    expect(tabsIn(t.focusOrder())).toEqual(["tb.tab.cherry"]);
    expect(t.focusOrder()).toContain("tb.panel.cherry");
    expect(t.focusOrder()).not.toContain("tb.panel.banana");
    t.dispose();
  });

  test("ArrowRight, ArrowLeft, Home and End call `onChange` with the new active key and focus follows it (property against a wrapping model)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2 }),
        fc.array(fc.constantFrom("ArrowRight", "ArrowLeft", "Home", "End"), { minLength: 1, maxLength: 10 }),
        async (start, presses) => {
          const { t, changes } = mount(keys[start] ?? "apple");
          await t.fire(`tb.tab.${keys[start]}`, { type: "focus" });
          let at = start;
          let n = 0;
          for (const k of presses) {
            await t.fire(`tb.tab.${keys[at]}`, { type: "keydown", key: k });
            at = k === "ArrowRight" ? (at + 1) % 3 : k === "ArrowLeft" ? (at + 2) % 3 : k === "Home" ? 0 : 2;
            n += 1;
            expect(changes).toHaveLength(n);
            expect(changes[n - 1]).toBe(keys[at]);
            expect(t.find(`tb.tab.${keys[at]}`).state.focused).toBe(true);
            expect(tabsIn(t.focusOrder())).toEqual([`tb.tab.${keys[at]}`]);
          }
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});

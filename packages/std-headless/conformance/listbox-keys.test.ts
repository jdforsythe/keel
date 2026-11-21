// Spec: std.options, Conformance "A Listbox focused with nothing selected highlights `option.<first>`: the list's `aria-activedescendant` names it and `find` gives `state.active`; ArrowDown at the last option stays there; End then Home highlight the last and the first."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: the list is `<id>.list` and keys are fired at it; `find(list).state.active` is the id `aria-activedescendant` names.
import { Listbox } from "@keel/std-headless";
import type { Option } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, el, fruit, page, simCtx } from "./fixtures.ts";

const five: readonly Option<string>[] = [
  { key: "a", text: "Alpha" },
  { key: "b", text: "Beta" },
  { key: "c", text: "Gamma" },
  { key: "d", text: "Delta" },
  { key: "e", text: "Epsilon" },
];

const mount = (
  over: {
    options?: readonly Option<string>[];
    selected?: readonly string[];
    orientation?: "vertical" | "horizontal";
  } = {},
) =>
  render(
    page((c) =>
      Listbox(
        {
          id: "lb",
          label: "Fruit",
          options: () => over.options ?? fruit,
          mode: "single",
          selected: () => over.selected ?? [],
          onChange: () => {},
          orientation: over.orientation ?? "vertical",
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );

const key = (t: ReturnType<typeof mount>, k: string) => t.fire("lb.list", { type: "keydown", key: k });

describe("std.options: Listbox keys", () => {
  test("A Listbox focused with nothing selected highlights `option.<first>`: the list's `aria-activedescendant` names it and `find` gives `state.active`", async () => {
    const t = mount();
    expect(t.find("lb.list").role).toBe("listbox");
    await t.fire("lb.list", { type: "focus" });
    expect(t.find("lb.list").state.active).toBe("lb.option.apple");
    expect(el("lb.list")?.getAttribute("aria-activedescendant")).toBe("lb.option.apple");
    expect(t.find("lb.list").state.focused).toBe(true);
    t.dispose();
  });

  test("ArrowDown at the last option stays there", async () => {
    const t = mount();
    await t.fire("lb.list", { type: "focus" });
    for (let i = 0; i < 6; i++) await key(t, "ArrowDown");
    expect(t.find("lb.list").state.active).toBe("lb.option.cherry");
    t.dispose();
  });

  test("End then Home highlight the last and the first", async () => {
    const t = mount();
    await t.fire("lb.list", { type: "focus" });
    await key(t, "End");
    expect(t.find("lb.list").state.active).toBe("lb.option.cherry");
    await key(t, "Home");
    expect(t.find("lb.list").state.active).toBe("lb.option.apple");
    t.dispose();
  });

  test("a focused Listbox with a selected option highlights the first selected option", async () => {
    const t = mount({ selected: ["cherry", "banana"] });
    await t.fire("lb.list", { type: "focus" });
    expect(t.find("lb.list").state.active).toBe("lb.option.banana");
    t.dispose();
  });

  test("ArrowDown and ArrowUp move without wrap, Home and End jump, for any key sequence (property against a clamping model)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("ArrowDown", "ArrowUp", "Home", "End"), { maxLength: 12 }),
        async (keys) => {
          const t = mount({ options: five });
          await t.fire("lb.list", { type: "focus" });
          let at = 0;
          for (const k of keys) {
            await key(t, k);
            at = k === "ArrowDown" ? Math.min(at + 1, 4) : k === "ArrowUp" ? Math.max(at - 1, 0) : k === "Home" ? 0 : 4;
            expect(t.find("lb.list").state.active).toBe(`lb.option.${five[at]?.key}`);
          }
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a horizontal Listbox moves with ArrowRight and ArrowLeft without wrap (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom("ArrowRight", "ArrowLeft"), { maxLength: 10 }), async (keys) => {
        const t = mount({ options: five, orientation: "horizontal" });
        await t.fire("lb.list", { type: "focus" });
        let at = 0;
        for (const k of keys) {
          await key(t, k);
          at = k === "ArrowRight" ? Math.min(at + 1, 4) : Math.max(at - 1, 0);
          expect(t.find("lb.list").state.active).toBe(`lb.option.${five[at]?.key}`);
        }
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("blur closes the Listbox: no option stays highlighted", async () => {
    const t = mount();
    await t.fire("lb.list", { type: "focus" });
    await t.fire("lb.list", { type: "blur" });
    expect(t.find("lb.list").state.active).toBeFalsy();
    t.dispose();
  });
});

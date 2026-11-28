// Spec: std.options, clause "A Menu trigger's Enter opens the menu with focus on `menu` and the first item highlighted; ArrowUp on the first wraps to the last; Enter calls `onSelect` and returns focus to the trigger; Escape returns focus without a call; Tab closes it without moving focus back."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: keys in the open menu are fired at `<id>.menu`; the harness's `keydown` does not move focus itself, so "Tab closes it without moving focus back" is
// the trigger not focused and `expanded` false.
import { Menu } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, page, simCtx } from "./fixtures.ts";

const items = [
  { key: "new", text: "New file" },
  { key: "open", text: "Open file" },
  { key: "save", text: "Save file" },
] as const;

const mount = () => {
  const selected: string[] = [];
  const t = render(
    page((c) =>
      Menu(
        {
          id: "mn",
          trigger: () => "File",
          items: () => items,
          onSelect: (k) => {
            selected.push(k);
          },
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  const menu = (k: string) => t.fire("mn.menu", { type: "keydown", key: k });
  const open = async () => {
    await t.fire("mn.trigger", { type: "focus" });
    await t.fire("mn.trigger", { type: "keydown", key: "Enter" });
  };
  return { t, selected, menu, open };
};

describe("std.options: Menu keys", () => {
  test("A Menu trigger's Enter opens the menu with focus on `menu` and the first item highlighted", async () => {
    const { t, open } = mount();
    expect(t.find("mn.trigger").state.expanded).toBe(false);
    await open();
    expect(t.find("mn.trigger").state.expanded).toBe(true);
    expect(t.find("mn.menu").role).toBe("menu");
    expect(t.find("mn.menu").state.focused).toBe(true);
    expect(t.find("mn.menu").state.active).toBe("mn.item.new");
    t.dispose();
  });

  test("ArrowUp on the first wraps to the last", async () => {
    const { t, open, menu } = mount();
    await open();
    await menu("ArrowUp");
    expect(t.find("mn.menu").state.active).toBe("mn.item.save");
    await menu("ArrowDown");
    expect(t.find("mn.menu").state.active).toBe("mn.item.new");
    t.dispose();
  });

  test("Enter calls `onSelect` and returns focus to the trigger", async () => {
    const { t, open, menu, selected } = mount();
    await open();
    await menu("ArrowDown");
    await menu("Enter");
    expect(selected).toEqual(["open"]);
    expect(t.find("mn.trigger").state.focused).toBe(true);
    expect(t.find("mn.trigger").state.expanded).toBe(false);
    t.dispose();
  });

  test("Escape returns focus without a call", async () => {
    const { t, open, menu, selected } = mount();
    await open();
    await menu("ArrowDown");
    await menu("Escape");
    expect(selected).toEqual([]);
    expect(t.find("mn.trigger").state.focused).toBe(true);
    expect(t.find("mn.trigger").state.expanded).toBe(false);
    t.dispose();
  });

  test("Tab closes it without moving focus back", async () => {
    const { t, open, menu, selected } = mount();
    await open();
    await menu("Tab");
    expect(selected).toEqual([]);
    expect(t.find("mn.trigger").state.expanded).toBe(false);
    expect(t.find("mn.trigger").state.focused).not.toBe(true);
    t.dispose();
  });

  test("Space and a click choose too, and ArrowDown, ArrowUp, Home and End keep the highlight in range (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("ArrowDown", "ArrowUp", "Home", "End"), { maxLength: 10 }),
        async (keys) => {
          const { t, open, menu, selected } = mount();
          await open();
          let at = 0;
          for (const k of keys) {
            await menu(k);
            at = k === "ArrowDown" ? (at + 1) % 3 : k === "ArrowUp" ? (at + 2) % 3 : k === "Home" ? 0 : 2;
            expect(t.find("mn.menu").state.active).toBe(`mn.item.${items[at]?.key}`);
          }
          await menu(" ");
          expect(selected).toEqual([items[at]?.key]);
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a click on an item chooses it and an item with `checked` is a `menuitemcheckbox`", async () => {
    const selected: string[] = [];
    const t = render(
      page((c) =>
        Menu(
          {
            id: "mc",
            trigger: () => "View",
            items: () => [
              { key: "grid", text: "Grid", checked: true },
              { key: "list", text: "List" },
            ],
            onSelect: (k) => {
              selected.push(k);
            },
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("mc.trigger", { type: "keydown", key: "Enter" });
    expect(t.find("mc.item.grid").role).toBe("menuitemcheckbox");
    expect(t.find("mc.item.list").role).toBe("menuitem");
    await t.fire("mc.item.list", { type: "click" });
    expect(selected).toEqual(["list"]);
    t.dispose();
  });
});

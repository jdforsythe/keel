// Spec: std.headless, clause "Every widget of this section and std.options rendered with its required props has no axe violations open and closed."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: the harness's render checks run axe (E1703) after the first render and after every `fire`, so a harness that returns from `render` and `fire` has no violation;
// "open" is reached with each widget's own opening key or click.
import { Combobox, Dialog, Disclosure, Listbox, Menu, Tabs, Toaster } from "@keel/std-headless";
import { render } from "@keel/testing";
import { Box, Button, Text } from "@keel/ui";
import { signal } from "@keel/reactive";
import { describe, expect, test } from "vitest";
import { fruit, inScope, page, simCtx } from "./fixtures.ts";

describe("std.headless and std.options: axe violations", () => {
  test("Every widget of this section and std.options rendered with its required props has no axe violations open and closed: Listbox", async () => {
    const t = render(
      page((c) =>
        Listbox(
          {
            id: "ax",
            label: "Fruit",
            options: () => fruit,
            mode: "multiple",
            selected: () => ["banana"],
            onChange: () => {},
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.list", { type: "focus" });
    await t.fire("ax.list", { type: "keydown", key: "ArrowDown" });
    expect(t.find("ax.list").role).toBe("listbox");
    await t.fire("ax.list", { type: "blur" });
    await t.settle();
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Listbox named by `labelledBy`", async () => {
    const t = render(
      page((c) =>
        Box({
          id: "ax",
          children: () => [
            Text({ id: "ax.name", children: "Fruit" }),
            Listbox(
              {
                id: "ax.lb",
                labelledBy: "ax.name",
                options: () => fruit,
                mode: "single",
                selected: () => [],
                onChange: () => {},
              },
              c,
            ),
          ],
        }),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("ax.lb.list", { type: "focus" });
    expect(t.find("ax.lb.list").name).toBe("Fruit");
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Combobox", async () => {
    const text = inScope(() => signal(""));
    const t = render(
      page((c) =>
        Combobox(
          {
            id: "ax",
            label: "Fruit",
            text: () => text.get(),
            onInput: (v) => text.set(v),
            options: () => fruit,
            onChange: () => {},
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.input", { type: "keydown", key: "ArrowDown" });
    expect(t.find("ax.input").state.expanded).toBe(true);
    await t.fire("ax.input", { type: "keydown", key: "Escape" });
    expect(t.find("ax.input").state.expanded).toBe(false);
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Menu", async () => {
    const t = render(
      page((c) =>
        Menu(
          {
            id: "ax",
            trigger: () => "Actions",
            items: () => [...fruit, { key: "pin", text: "Pinned", checked: true }],
            onSelect: () => {},
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.trigger", { type: "keydown", key: "Enter" });
    expect(t.find("ax.trigger").state.expanded).toBe(true);
    await t.fire("ax.menu", { type: "keydown", key: "Escape" });
    expect(t.find("ax.trigger").state.expanded).toBe(false);
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Tabs", async () => {
    const picked = inScope(() => signal("apple"));
    const t = render(
      page((c) =>
        Tabs(
          {
            id: "ax",
            label: "Fruit",
            tabs: () => fruit,
            selected: () => picked.get(),
            onChange: (k) => picked.set(k),
            panel: (k) => Text({ id: `ax.body.${k}`, children: `About ${k}` }),
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.tab.apple", { type: "focus" });
    await t.fire("ax.tab.apple", { type: "keydown", key: "ArrowRight" });
    expect(t.find("ax.tab.banana").state.selected).toBe(true);
    await t.fire("ax.tab.banana", { type: "blur" });
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Dialog and alert Dialog", async () => {
    for (const alert of [undefined, "This cannot be undone."]) {
      const t = render(
        page((c) =>
          Dialog(
            {
              id: "ax",
              title: "Settings",
              trigger: () => "Open settings",
              content: (close) => Button({ id: "ax.ok", children: "Close", onClick: close }),
              ...(alert === undefined ? {} : { alert: { description: alert } }),
            },
            c,
          ),
        ),
        { props: {}, ctx: simCtx() },
      );
      await t.settle();
      await t.fire("ax.trigger", { type: "click" });
      await t.fire("ax.dialog", { type: "keydown", key: "Escape" });
      expect(t.find("ax.trigger").role).toBe("button");
      t.dispose();
    }
  });

  test("Every widget ... no axe violations open and closed: Disclosure", async () => {
    const t = render(
      page((c) =>
        Disclosure(
          { id: "ax", summary: () => "Details", children: () => Text({ id: "ax.body", children: "More" }) },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.button", { type: "click" });
    expect(t.find("ax.button").state.expanded).toBe(true);
    await t.fire("ax.button", { type: "click" });
    t.dispose();
  });

  test("Every widget ... no axe violations open and closed: Toaster empty and with both tones", async () => {
    const empty = render(
      page((c) => Toaster({ id: "ax", items: () => [], onDismiss: () => {}, dismiss: "Dismiss", duration: 5000 }, c)),
      { props: {}, ctx: simCtx() },
    );
    await empty.settle();
    empty.dispose();
    const t = render(
      page((c) =>
        Toaster(
          {
            id: "ax",
            items: () => [
              { id: "n1", text: "Saved", tone: "status" },
              { id: "n2", text: "Failed", tone: "alert" },
            ],
            onDismiss: () => {},
            dismiss: "Dismiss",
            duration: 5000,
          },
          c,
        ),
      ),
      { props: {}, ctx: simCtx() },
    );
    await t.settle();
    await t.fire("ax.dismiss.n1", { type: "focus" });
    t.dispose();
  });
});

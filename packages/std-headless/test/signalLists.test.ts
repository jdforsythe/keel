// @vitest-environment happy-dom
// A list read from a signal of the parent component updates the widget, never re-runs the parent.
import { computed, signal } from "@keel/reactive";
import { render } from "@keel/testing";
import type { Harness } from "@keel/testing";
import { Box, Text } from "@keel/ui";
import { expect, test } from "vitest";
import { Combobox } from "../src/Combobox.ts";
import { Listbox } from "../src/Listbox.ts";
import { Menu } from "../src/Menu.ts";
import { Tabs } from "../src/Tabs.ts";
import type { ToastItem } from "../src/ToastItem.ts";
import { Toaster } from "../src/Toaster.ts";
import { fruit, page, rendered, simCtx } from "./support.ts";

/** The ids `<prefix><key>` of the fruit keys rendered, in the fruit list's order. */
const optionIds = (t: Harness, prefix: string): string[] =>
  fruit.map((o) => `${prefix}${o.key}`).filter((id) => rendered(t, id));

test("typing in a Combobox narrows its options and keeps the parent's state and focus", async () => {
  let runs = 0;
  const t = render(
    page((c) => {
      runs += 1;
      const typed = signal("");
      return Box({
        children: () => [
          Combobox(
            {
              id: "p",
              label: "Fruit",
              text: () => typed.get(),
              onInput: (v) => typed.set(v),
              options: () => fruit.filter((o) => o.text.toLowerCase().includes(typed.get())),
              onChange: () => {},
            },
            c,
          ),
          Text({ id: "p.echo", children: () => computed(() => typed.get()) }),
        ],
      });
    }),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("p.input", { type: "focus" });
  await t.fire("p.input", { type: "input", value: "an" });
  expect(runs).toBe(1);
  expect(t.find("p.echo").text).toBe("an");
  expect(t.find("p.input").state.expanded).toBe(true);
  expect(t.find("p.input").state.focused).toBe(true);
  expect(optionIds(t, "p.option.")).toEqual(["p.option.banana"]);
  t.dispose();
});

test("Listbox, Menu, Tabs and Toaster lists read from a parent signal update in place", async () => {
  let runs = 0;
  const shown = { set: (_n: number) => {} };
  const t = render(
    page((c) => {
      runs += 1;
      const n = signal(3);
      shown.set = (v) => n.set(v);
      const opts = () => fruit.slice(0, n.get());
      const toasts = (): readonly ToastItem[] =>
        fruit.slice(0, n.get()).map((o) => ({ id: o.key, text: o.text, tone: "alert" }));
      return Box({
        children: () => [
          Listbox({ id: "l", label: "L", options: opts, mode: "single", selected: () => [], onChange: () => {} }, c),
          Menu({ id: "m", trigger: () => "M", items: opts, onSelect: () => {} }, c),
          Tabs({ id: "t", label: "T", tabs: opts, selected: () => "apple", onChange: () => {}, panel: (k) => k }, c),
          Toaster({ id: "z", items: toasts, onDismiss: () => {}, dismiss: "Dismiss" }, c),
        ],
      });
    }),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("l.list", { type: "focus" });
  shown.set(1);
  await t.settle();
  expect(runs).toBe(1);
  expect(optionIds(t, "l.option.")).toEqual(["l.option.apple"]);
  expect(optionIds(t, "m.item.")).toEqual(["m.item.apple"]);
  expect(optionIds(t, "t.tab.")).toEqual(["t.tab.apple"]);
  expect(rendered(t, "z.toast.banana")).toBe(false);
  expect(t.find("l.list").state.focused).toBe(true);
  t.dispose();
});

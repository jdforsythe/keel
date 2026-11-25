// @vitest-environment happy-dom
// A prop an app changes while a widget is mounted shows in place: the widget's focus and open state stay, which a
// node made again would lose.
import { computed, scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { expect, test } from "vitest";
import { Combobox } from "../src/Combobox.ts";
import { Dialog } from "../src/Dialog.ts";
import { Disclosure } from "../src/Disclosure.ts";
import { Listbox } from "../src/Listbox.ts";
import { Menu } from "../src/Menu.ts";
import type { Option } from "../src/Option.ts";
import { Tabs } from "../src/Tabs.ts";
import { Toaster } from "../src/Toaster.ts";
import { isOpen, page, simCtx } from "./support.ts";

const held = <T>(start: T): Signal<T> => {
  const made: Signal<T>[] = [];
  scope(() => void made.push(signal(start)));
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};
const focused = (): string => document.activeElement?.id ?? "";
const fruit = (suffix: string): readonly Option[] => [
  { key: "apple", text: `Apple${suffix}` },
  { key: "pear", text: `Pear${suffix}` },
];

test("Listbox: label, mode and option text follow their props; the list keeps focus and its active option", async () => {
  const label = held("Fruit");
  const mode = held<"single" | "multiple">("single");
  const opts = held(fruit(""));
  const changes: string[][] = [];
  const t = render(
    page((c) =>
      Listbox(
        {
          id: "lb",
          get label() {
            return label.get();
          },
          options: () => opts.get(),
          get mode() {
            return mode.get();
          },
          selected: () => ["apple"],
          onChange: (keys) => void changes.push(keys),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("lb.list", { type: "focus" });
  await t.fire("lb.list", { type: "keydown", key: "ArrowDown" });
  label.set("Fresh fruit");
  mode.set("multiple");
  opts.set(fruit(" (ripe)"));
  await t.settle();
  expect(t.find("lb.list").name).toBe("Fresh fruit");
  // Space in multiple mode adds the active option to the selection; in single mode it would replace it.
  await t.fire("lb.list", { type: "keydown", key: " " });
  expect(changes).toEqual([["apple", "pear"]]);
  expect(t.find("lb.option.pear").text).toBe("Pear (ripe)");
  expect(t.find("lb.list").state.active).toBe("lb.option.pear");
  expect(focused()).toBe("lb.list");
  t.dispose();
});

test("Combobox: its label follows the prop while the list stays open and the input focused", async () => {
  const label = held("Fruit");
  const t = render(
    page((c) =>
      Combobox(
        {
          id: "cb",
          get label() {
            return label.get();
          },
          text: () => "",
          onInput: () => {},
          options: () => fruit(""),
          onChange: () => {},
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("cb.input", { type: "focus" });
  await t.fire("cb.input", { type: "keydown", key: "ArrowDown" });
  label.set("Any fruit");
  await t.settle();
  expect(t.find("cb.input").name).toBe("Any fruit");
  expect(t.find("cb.input").state.expanded).toBe(true);
  expect(focused()).toBe("cb.input");
  t.dispose();
});

test("Menu: item text follows the items while the menu stays open and focused", async () => {
  const items = held(fruit(""));
  const t = render(
    page((c) => Menu({ id: "mn", trigger: () => "Fruit", items: () => items.get(), onSelect: () => {} }, c)),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("mn.trigger", { type: "keydown", key: "Enter" });
  items.set(fruit(" now"));
  await t.settle();
  expect(t.find("mn.item.apple").text).toBe("Apple now");
  expect(t.find("mn.trigger").state.expanded).toBe(true);
  expect(t.find("mn.menu").state.active).toBe("mn.item.apple");
  expect(focused()).toBe("mn.menu");
  t.dispose();
});

test("Tabs: label and tab text follow their props; the selected tab keeps focus", async () => {
  const label = held("Fruit");
  const tabs = held(fruit(""));
  const t = render(
    page((c) =>
      Tabs(
        {
          id: "tb",
          get label() {
            return label.get();
          },
          tabs: () => tabs.get(),
          selected: () => "apple",
          onChange: () => {},
          panel: (k) => k,
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("tb.tab.apple", { type: "focus" });
  label.set("Orchard");
  tabs.set(fruit(" tab"));
  await t.settle();
  expect(t.find("tb.list").name).toBe("Orchard");
  expect(t.find("tb.tab.apple").text).toBe("Apple tab");
  expect(t.find("tb.tab.apple").state.selected).toBe(true);
  expect(focused()).toBe("tb.tab.apple");
  t.dispose();
});

test("Dialog: title and description follow their props while it stays open", async () => {
  const title = held("Delete");
  const said = held("This cannot be undone.");
  const t = render(
    page((c) =>
      Dialog(
        {
          id: "dl",
          get title() {
            return title.get();
          },
          trigger: () => "Delete",
          content: () => "Body",
          alert: {
            get description() {
              return said.get();
            },
          },
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("dl.trigger", { type: "click" });
  title.set("Delete row");
  said.set("The row goes for good.");
  await t.settle();
  expect(t.find("dl.title").text).toBe("Delete row");
  expect(t.find("dl.dialog").name).toBe("Delete row");
  expect(t.find("dl.description").text).toBe("The row goes for good.");
  expect(isOpen(t, "dl")).toBe(true);
  t.dispose();
});

test("Disclosure: a summary slot with its own binding updates while the panel stays shown", async () => {
  const summary = held("Shipping");
  const t = render(
    page((c) => Disclosure({ id: "ds", summary: () => computed(() => summary.get()), children: () => "Two days" }, c)),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("ds.button", { type: "click" });
  summary.set("Shipping to you");
  await t.settle();
  expect(t.find("ds.button").text).toBe("Shipping to you");
  expect(t.find("ds.button").state.expanded).toBe(true);
  t.dispose();
});

test("Toaster: the dismiss text and an item's text follow their props; the toast and its focus stay", async () => {
  const dismiss = held("Dismiss");
  const said = held("Saved");
  const t = render(
    page((c) =>
      Toaster(
        {
          id: "tz",
          items: () => [{ id: "a", text: said.get(), tone: "alert" }],
          onDismiss: () => {},
          get dismiss() {
            return dismiss.get();
          },
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("tz.dismiss.a", { type: "focus" });
  dismiss.set("Close");
  said.set("Saved twice");
  await t.settle();
  expect(t.find("tz.dismiss.a").name).toBe("Close");
  expect(t.find("tz.toast.a").text).toContain("Saved twice");
  expect(focused()).toBe("tz.dismiss.a");
  t.dispose();
});

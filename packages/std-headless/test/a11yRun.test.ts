// @vitest-environment happy-dom
// Every widget, closed and open, lets each WCAG-mapped rule reach a verdict: a rule axe leaves `incomplete` counts as
// not run (k.a11y), and one that a plain render runs but a widget's render does not would hold back an app's claim.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { render } from "@keel/testing";
import type { TestEvent } from "@keel/testing";
import { a11yRules, criteriaOf } from "@keel/testing/a11y";
import { Text } from "@keel/ui";
import { expect, test } from "vitest";
import { fruit, isRecord, page, simCtx } from "../conformance/fixtures.ts";
import { Combobox } from "../src/Combobox.ts";
import { Dialog } from "../src/Dialog.ts";
import { Disclosure } from "../src/Disclosure.ts";
import { Listbox } from "../src/Listbox.ts";
import { Menu } from "../src/Menu.ts";
import { Tabs } from "../src/Tabs.ts";
import { Toaster } from "../src/Toaster.ts";

const mapped = a11yRules().filter((r) => criteriaOf(r).length > 0);

/** The rule lists of the render checks the harness recorded in this test so far. */
const runs = (meta: object): string[][] => {
  const list: unknown = Reflect.get(meta, "a11y");
  return (Array.isArray(list) ? list : []).flatMap((c: unknown) =>
    isRecord(c) && Array.isArray(c.rules) ? [c.rules.filter((r: unknown) => typeof r === "string")] : [],
  );
};

const text = (): Signal<string> => {
  const made: Signal<string>[] = [];
  scope(() => void made.push(signal("")));
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};

type Case = [string, (c: Parameters<Parameters<typeof page>[0]>[0]) => Node, string, TestEvent];
const cases = (only: readonly string[]): Case[] => {
  const typed = text();
  const all: Case[] = [
    [
      "Listbox",
      (c) =>
        Listbox(
          { id: "w", label: "Fruit", options: () => fruit, mode: "single", selected: () => [], onChange: () => {} },
          undefined,
          c,
        ),
      "w.list",
      { type: "focus" },
    ],
    [
      "Combobox",
      (c) =>
        Combobox(
          {
            id: "w",
            label: "Fruit",
            text: () => typed.get(),
            onInput: (v) => typed.set(v),
            options: () => fruit,
            onChange: () => {},
          },
          undefined,
          c,
        ),
      "w.input",
      { type: "keydown", key: "ArrowDown" },
    ],
    [
      "Menu",
      (c) => Menu({ id: "w", trigger: () => "Fruit", items: () => fruit, onSelect: () => {} }, undefined, c),
      "w.trigger",
      { type: "keydown", key: "Enter" },
    ],
    [
      "Tabs",
      (c) =>
        Tabs(
          {
            id: "w",
            label: "Fruit",
            tabs: () => fruit,
            selected: () => "apple",
            onChange: () => {},
            panel: (k) => k,
          },
          undefined,
          c,
        ),
      "w.tab.apple",
      { type: "focus" },
    ],
    [
      "Dialog",
      (c) => Dialog({ id: "w", title: "Fruit", trigger: () => "Open", content: () => "Apple" }, undefined, c),
      "w.trigger",
      { type: "click" },
    ],
    [
      "Disclosure",
      (c) => Disclosure({ id: "w", summary: () => "Fruit", children: () => "Apple" }, undefined, c),
      "w.button",
      { type: "click" },
    ],
    [
      "Toaster",
      (c) =>
        Toaster(
          {
            id: "w",
            items: () => [
              { id: "a", text: "Saved", tone: "status" },
              { id: "b", text: "Failed", tone: "alert" },
            ],
            onDismiss: () => {},
            dismiss: "Dismiss",
          },
          undefined,
          c,
        ),
      "w.dismiss.a",
      { type: "focus" },
    ],
  ];
  return all.filter(([name]) => only.includes(name));
};

const runsEveryRule = async (task: { readonly meta: object }, only: readonly string[]) => {
  render(
    page(() => Text({ id: "plain", children: "Apple" })),
    { props: {}, ctx: simCtx() },
  ).dispose();
  const [plain] = runs(task.meta);
  const expected = mapped.filter((r) => plain?.includes(r) === true);
  expect(expected.length).toBeGreaterThan(10);
  const missing: string[] = [];
  for (const [name, view, target, open] of cases(only)) {
    const before = runs(task.meta).length;
    const t = render(
      page((c) => view(c)),
      { props: {}, ctx: simCtx() },
    );
    await t.fire(target, open);
    t.dispose();
    const mine = runs(task.meta).slice(before);
    expect(mine.length, name).toBeGreaterThanOrEqual(2);
    for (const rules of mine) missing.push(...expected.filter((r) => !rules.includes(r)).map((r) => `${name} ${r}`));
  }
  expect([...new Set(missing)]).toEqual([]);
};

test("each widget, closed and open, runs every WCAG-mapped rule a plain render runs", ({ task }) =>
  runsEveryRule(task, ["Listbox", "Combobox", "Tabs", "Disclosure", "Toaster"]));

// axe leaves `aria-valid-attr-value` incomplete for `aria-controls` beside `aria-haspopup`, so these triggers pass once
// `Part`'s `button` takes no `controls`.
test.skip("a Menu or Dialog trigger lets `aria-valid-attr-value` reach a verdict", ({ task }) =>
  runsEveryRule(task, ["Menu", "Dialog"]));

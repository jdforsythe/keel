// @vitest-environment happy-dom
// A click on a tab selects it: the pointer path, not only the keyboard. A disabled tab ignores the click.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import { expect, test } from "vitest";
import { page, simCtx } from "../conformance/fixtures.ts";
import type { Option } from "../src/Option.ts";
import { Tabs } from "../src/Tabs.ts";

const tabs: readonly Option[] = [
  { key: "a", text: "A" },
  { key: "b", text: "B" },
  { key: "c", text: "C", disabled: true },
];

const mount = () => {
  const made: Signal<string>[] = [];
  scope(() => void made.push(signal("a")));
  const [picked] = made;
  if (picked === undefined) throw new Error("no signal");
  const changes: string[] = [];
  const t = render(
    page((c) =>
      Tabs(
        {
          id: "tb",
          label: "L",
          tabs: () => tabs,
          selected: () => picked.get(),
          onChange: (k) => {
            changes.push(k);
            picked.set(k);
          },
          panel: (k) => Text({ id: `tb.body.${k}`, children: k }),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  return { t, changes };
};

test("Tabs: a click selects the tab, and arrows continue from it", async () => {
  const { t, changes } = mount();
  await t.fire("tb.tab.b", { type: "click" });
  expect(changes).toEqual(["b"]);
  expect(t.find("tb.tab.b").state.selected).toBe(true);
  await t.fire("tb.tab.b", { type: "keydown", key: "ArrowLeft" });
  expect(changes).toEqual(["b", "a"]);
  t.dispose();
});

test("Tabs: a focus then a click (a real pointer press) selects once", async () => {
  const { t, changes } = mount();
  await t.fire("tb.tab.b", { type: "focus" });
  await t.fire("tb.tab.b", { type: "click" });
  expect(changes).toEqual(["b"]);
  t.dispose();
});

test("Tabs: a click on a disabled tab changes nothing", async () => {
  const { t, changes } = mount();
  await t.fire("tb.tab.c", { type: "click" });
  expect(changes).toEqual([]);
  t.dispose();
});

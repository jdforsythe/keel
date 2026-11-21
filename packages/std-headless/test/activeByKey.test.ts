// @vitest-environment happy-dom
// The active option is kept by key when the list is replaced while open: present, it stays active at its new
// position; gone, nothing is active.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { expect, test } from "vitest";
import { page, simCtx } from "../conformance/fixtures.ts";
import { Combobox } from "../src/Combobox.ts";
import { Listbox } from "../src/Listbox.ts";
import { Menu } from "../src/Menu.ts";
import type { Option } from "../src/Option.ts";

const opts = (...keys: string[]): readonly Option[] => keys.map((key) => ({ key, text: key.toUpperCase() }));
const held = (start: readonly Option[]): Signal<readonly Option[]> => {
  const made: Signal<readonly Option[]>[] = [];
  scope(() => void made.push(signal(start)));
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};

test("Combobox: a replaced list keeps the active key at its new index, and Enter chooses it", async () => {
  const list = held(opts("a", "b", "c"));
  const chosen: string[] = [];
  const t = render(
    page((c) =>
      Combobox(
        {
          id: "cb",
          label: "L",
          text: () => "",
          onInput: () => {},
          options: () => list.get(),
          onChange: (k) => chosen.push(k),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("cb.input", { type: "keydown", key: "ArrowDown" });
  await t.fire("cb.input", { type: "keydown", key: "ArrowDown" });
  expect(t.find("cb.input").state.active).toBe("cb.option.b");
  list.set(opts("x", "y", "b"));
  await t.settle();
  expect(t.find("cb.input").state.active).toBe("cb.option.b");
  await t.fire("cb.input", { type: "keydown", key: "ArrowUp" });
  expect(t.find("cb.input").state.active).toBe("cb.option.y");
  list.set(opts("p", "q", "r"));
  await t.settle();
  expect(t.find("cb.input").state.active).toBeFalsy();
  await t.fire("cb.input", { type: "keydown", key: "Enter" });
  expect(chosen).toEqual([]);
  await t.fire("cb.input", { type: "keydown", key: "ArrowDown" });
  expect(t.find("cb.input").state.active).toBe("cb.option.p");
  t.dispose();
});

test("Listbox and Menu keep the active key across a replaced list; a gone key leaves nothing active", async () => {
  const list = held(opts("a", "b", "c"));
  const picked: string[] = [];
  const t = render(
    page((c) =>
      Listbox(
        {
          id: "lb",
          label: "L",
          options: () => list.get(),
          mode: "single",
          selected: () => [],
          onChange: (k) => picked.push(...k),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("lb.list", { type: "focus" });
  await t.fire("lb.list", { type: "keydown", key: "End" });
  list.set(opts("c", "a"));
  await t.settle();
  expect(t.find("lb.list").state.active).toBe("lb.option.c");
  await t.fire("lb.list", { type: "keydown", key: " " });
  expect(picked).toEqual(["c"]);
  t.dispose();

  const items = held(opts("a", "b", "c"));
  const selected: string[] = [];
  const m = render(
    page((c) => Menu({ id: "mn", trigger: () => "M", items: () => items.get(), onSelect: (k) => selected.push(k) }, c)),
    { props: {}, ctx: simCtx() },
  );
  await m.fire("mn.trigger", { type: "keydown", key: "Enter" });
  await m.fire("mn.menu", { type: "keydown", key: "ArrowDown" });
  items.set(opts("z", "a"));
  await m.settle();
  expect(m.find("mn.menu").state.active).toBeFalsy();
  await m.fire("mn.menu", { type: "keydown", key: "Enter" });
  expect(selected).toEqual([]);
  m.dispose();
});

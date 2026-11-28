// @vitest-environment happy-dom
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { render } from "@keel/testing";
import { expect, test } from "vitest";
import { Combobox } from "../src/Combobox.ts";
import { Listbox } from "../src/Listbox.ts";
import { fruit, page, simCtx } from "./support.ts";

const text = (): Signal<string> => {
  const made: Signal<string>[] = [];
  scope(() => void made.push(signal("")), { detached: true });
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};

test("Alt+ArrowDown opens a Combobox with no option active; ArrowDown then moves to the first", async () => {
  const value = text();
  const t = render(
    page((c) =>
      Combobox(
        {
          id: "cm",
          label: "Fruit",
          text: () => value.get(),
          onInput: (v) => value.set(v),
          options: () => fruit,
          onChange: () => {},
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("cm.input", { type: "keydown", key: "ArrowDown", alt: true });
  expect(t.find("cm.input").state.expanded).toBe(true);
  expect(t.find("cm.input").state.active).toBeFalsy();
  await t.fire("cm.input", { type: "keydown", key: "ArrowDown" });
  expect(t.find("cm.input").state.active).toBe("cm.option.apple");
  t.dispose();
});

test("a printable key with `mod` is not typeahead", async () => {
  const t = render(
    page((c) =>
      Listbox(
        { id: "lm", label: "Fruit", options: () => fruit, mode: "single", selected: () => [], onChange: () => {} },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("lm.list", { type: "focus" });
  await t.fire("lm.list", { type: "keydown", key: "c", mod: true });
  expect(t.find("lm.list").state.active).toBe("lm.option.apple");
  await t.fire("lm.list", { type: "keydown", key: "c" });
  expect(t.find("lm.list").state.active).toBe("lm.option.cherry");
  t.dispose();
});

// Spec: std.options, Conformance "A Combobox with no options while open hides the `listbox` and shows `empty` in a `status`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: the Combobox opens by typing (`input` event), which opens at -1 even with no options; `hidden` is read by id because `find(id)` does not return it.
import { signal } from "@keel/reactive";
import { Combobox } from "@keel/std-headless";
import type { Option } from "@keel/std-headless";
import { render } from "@keel/testing";
import { describe, expect, test } from "vitest";
import { fruit, inScope, page, shown, simCtx } from "./fixtures.ts";

const mount = (options: readonly Option<string>[]) => {
  const text = inScope(() => signal(""));
  const t = render(
    page((c) =>
      Combobox(
        {
          id: "ce",
          label: "Fruit",
          text: () => text.get(),
          onInput: (v) => text.set(v),
          options: () => options,
          onChange: () => {},
          empty: () => "No fruit found",
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  return t;
};

describe("std.options: Combobox with no options", () => {
  test("A Combobox with no options while open hides the `listbox` and shows `empty` in a `status`", async () => {
    const t = mount([]);
    await t.fire("ce.input", { type: "input", value: "zzz" });
    expect(t.find("ce.input").state.expanded).toBe(true);
    expect(shown("ce.list")).toBe(false);
    expect(t.find("ce.empty").role).toBe("status");
    expect(t.find("ce.empty").text).toBe("No fruit found");
    t.dispose();
  });

  test("a Combobox with options while open shows the `listbox` and not `empty`", async () => {
    const t = mount(fruit);
    await t.fire("ce.input", { type: "input", value: "a" });
    expect(t.find("ce.input").state.expanded).toBe(true);
    expect(shown("ce.list")).toBe(true);
    expect(shown("ce.empty") && document.getElementById("ce.empty")?.textContent === "No fruit found").toBe(false);
    t.dispose();
  });

  test("a closed Combobox hides the `listbox` whatever its options", () => {
    for (const options of [[], fruit]) {
      const t = mount(options);
      expect(shown("ce.list")).toBe(false);
      t.dispose();
    }
  });
});

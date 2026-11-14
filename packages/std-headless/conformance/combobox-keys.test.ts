// Spec: std.options, Conformance "A Combobox's ArrowDown opens the list with `aria-expanded="true"` and the first option active; Enter calls `onChange` with its key and closes the list; Escape closes an open list and clears the text of a closed one."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: keys are fired at the part `<id>.input`; "clears the text" is `onInput('')`, which the fixture stores in a signal read by `text`; the options are static (the app's filtering is not under test).
import { signal } from "@keel/reactive";
import { Combobox } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { fruit, inScope, page, SEED, simCtx } from "./fixtures.ts";

const mount = (initial = "") => {
  const text = inScope(() => signal(initial));
  const inputs: string[] = [];
  const chosen: string[] = [];
  const t = render(
    page((c) =>
      Combobox(
        {
          id: "cb",
          label: "Fruit",
          text: () => text.get(),
          onInput: (v) => {
            inputs.push(v);
            text.set(v);
          },
          options: () => fruit,
          onChange: (k) => {
            chosen.push(k);
          },
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  const key = (k: string) => t.fire("cb.input", { type: "keydown", key: k });
  return { t, text, inputs, chosen, key };
};

describe("std.options: Combobox keys", () => {
  test('A Combobox\'s ArrowDown opens the list with `aria-expanded="true"` and the first option active', async () => {
    const { t, key } = mount();
    expect(t.find("cb.input").role).toBe("combobox");
    expect(t.find("cb.input").state.expanded).toBe(false);
    await key("ArrowDown");
    expect(t.find("cb.input").state.expanded).toBe(true);
    expect(t.find("cb.input").state.active).toBe("cb.option.apple");
    t.dispose();
  });

  test("Enter calls `onChange` with its key and closes the list", async () => {
    const { t, key, chosen } = mount();
    await key("ArrowDown");
    await key("Enter");
    expect(chosen).toEqual(["apple"]);
    expect(t.find("cb.input").state.expanded).toBe(false);
    t.dispose();
  });

  test("Escape closes an open list and clears the text of a closed one", async () => {
    const { t, key, inputs, text } = mount("app");
    await key("ArrowDown");
    await key("Escape");
    expect(t.find("cb.input").state.expanded).toBe(false);
    expect(inputs).toEqual([]);
    expect(text.get()).toBe("app");
    await key("Escape");
    expect(inputs).toEqual([""]);
    expect(text.get()).toBe("");
    t.dispose();
  });

  test("ArrowDown and ArrowUp wrap: n presses of ArrowDown highlight option (n - 1) mod 3 (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 9 }), fc.boolean(), async (n, down) => {
        const { t, key } = mount();
        for (let i = 0; i < n; i++) await key(down ? "ArrowDown" : "ArrowUp");
        const at = down ? (n - 1) % 3 : (((2 - (n - 1)) % 3) + 3) % 3;
        expect(t.find("cb.input").state.active).toBe(`cb.option.${fruit[at]?.key}`);
        t.dispose();
      }),
      { seed: SEED, numRuns: 24 },
    );
  });

  test("typing calls `onInput` and opens the list with no option active", async () => {
    const { t, inputs } = mount();
    await t.fire("cb.input", { type: "input", value: "ap" });
    expect(inputs).toEqual(["ap"]);
    expect(t.find("cb.input").state.expanded).toBe(true);
    expect(t.find("cb.input").state.active).toBeFalsy();
    t.dispose();
  });

  test("Enter with no active option passes through: no `onChange` call and the list stays as it was", async () => {
    const { t, chosen } = mount();
    await t.fire("cb.input", { type: "keydown", key: "Enter" });
    expect(chosen).toEqual([]);
    expect(t.find("cb.input").state.expanded).toBe(false);
    t.dispose();
  });
});

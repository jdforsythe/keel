// @vitest-environment happy-dom
// Spec: k.testing, clause "`find(id).value` is `'Milk'` for an `Input` with `value=\"Milk\"`, `text` `''`, and `'Milk 2'` after `fire(id, { type: 'input', value: 'Milk 2' })`; a `Select`'s is its selected option's value; a `Checkbox` and a `Box` have no `value` key."
// Seed: 1337 (the typed strings are drawn at that seed).
// Assumed: `Input`, `TextArea` and `Select` are given `id`, `label` and `value` as in the spec's example; the `Select` takes `options`; a `TextArea` has the value of an `input`-event `fire` as an `Input` does (the Harness bullet names `textarea` beside `input` and `select`).
import { render } from "@keel/testing";
import { Box, Checkbox, Input, Select, TextArea } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("k.testing: find(id).value", () => {
  it("`find(id).value` is `'Milk'` for an `Input` with `value=\"Milk\"`, and its `text` is `''`", () => {
    const t = render(
      page(() => Input({ id: "item.name", label: "Item", value: "Milk" })),
      { props: {}, ctx: simCtx() },
    );
    expect(t.find("item.name").value).toBe("Milk");
    expect(t.find("item.name").text).toBe("");
    t.dispose();
  });

  it("`find(id).value` is `'Milk 2'` after `fire(id, { type: 'input', value: 'Milk 2' })`, and its `text` stays `''`", async () => {
    const t = render(
      page(() => Input({ id: "item.name", label: "Item", value: "Milk" })),
      { props: {}, ctx: simCtx() },
    );
    await t.fire("item.name", { type: "input", value: "Milk 2" });
    expect(t.find("item.name").value).toBe("Milk 2");
    expect(t.find("item.name").text).toBe("");
    t.dispose();
  });

  it("property: after `fire(id, { type: 'input', value })` an `Input`'s and a `TextArea`'s `find(id).value` is that string, untrimmed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 24 }), async (v) => {
        const t = render(
          page(() => Box({ children: [Input({ id: "p.in", label: "I" }), TextArea({ id: "p.ta", label: "T" })] })),
          { props: {}, ctx: simCtx() },
        );
        await t.fire("p.in", { type: "input", value: v });
        await t.fire("p.ta", { type: "input", value: v });
        expect(t.find("p.in").value).toBe(v);
        expect(t.find("p.ta").value).toBe(v);
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("a `Select`'s `find(id).value` is its selected option's value", () => {
    const t = render(
      page(() => Select({ id: "s", label: "S", options: OPTIONS, value: "b" })),
      {
        props: {},
        ctx: simCtx(),
      },
    );
    expect(t.find("s").value).toBe("b");
    t.dispose();
  });

  it("a `Checkbox` and a `Box` have no `value` key", () => {
    const t = render(
      page(() => Box({ id: "b", children: [Checkbox({ id: "c", label: "C" })] })),
      { props: {}, ctx: simCtx() },
    );
    expect(t.find("c")).not.toHaveProperty("value");
    expect(t.find("b")).not.toHaveProperty("value");
    t.dispose();
  });
});

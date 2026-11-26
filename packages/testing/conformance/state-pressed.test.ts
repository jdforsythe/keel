// @vitest-environment happy-dom
// Spec text (k.testing): "`a11y(id?)` is built from the live DOM, nodes `{ id, role, name, state: { checked?, disabled?, expanded?, pressed?, selected?, invalid?, focused?, active?, sort?, rowindex?, rowcount? }, children }`, implicit roles and accessible names per WAI-ARIA: `checked` `'mixed'` for a mixed checkbox, `active` the id `aria-activedescendant` names, `sort` the `aria-sort` value, `rowindex`, `rowcount` the integer `aria-rowindex`, `aria-rowcount`."
// Seed: 1337.
// Assumed: `pressed` is the boolean the `aria-pressed` value says (`"true"` true, `"false"` false) on a toggle `button`, as `disabled` and `focused` are; with no `aria-pressed` there is no `pressed` key. `find(id).state` carries it as `a11y` does (k.testing find returns the same `state`). The element is addressed by `id` through the delegated `data-k` table, as in state-active-sort-mixed.test.ts.
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const T = template(
  ['<div id="root" data-k="root">', '<button id="tog" data-k="tog" type="button">Bold</button>', "</div>"].join(""),
);

const View = Object.assign(
  (props: { pressed: string }): Node => {
    const root = clone(T);
    const el = root.querySelector("#tog");
    if (el === null) throw new Error("fixture: #tog missing");
    if (props.pressed !== "") el.setAttribute("aria-pressed", props.pressed);
    return root;
  },
  { Props: s.object({ pressed: s.enum(["true", "false", ""]) }) },
);

const mount = (pressed: "true" | "false" | "") => render(View, { props: { pressed }, ctx: simCtx() });

describe("k.testing: a11y() and find(id).state carry pressed", () => {
  it("`a11y()` node `state` has `pressed: true` for a toggle button whose `aria-pressed` is `true`, and `pressed: false` for `false`", () => {
    const on = mount("true");
    expect(on.a11y("tog")).toMatchObject({ role: "button", name: "Bold", state: { pressed: true } });
    on.dispose();
    const off = mount("false");
    expect(off.a11y("tog")).toMatchObject({ role: "button", state: { pressed: false } });
    off.dispose();
  });

  it("`find(id).state.pressed` is the boolean `aria-pressed` says, for either value (property)", () => {
    fc.assert(
      fc.property(fc.boolean(), (pressed) => {
        const t = mount(pressed ? "true" : "false");
        expect(t.find("tog").state.pressed).toBe(pressed);
        expect(t.a11y("tog")).toMatchObject({ state: { pressed } });
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("a button with no `aria-pressed` has no `pressed` key in its state", () => {
    const t = mount("");
    expect("pressed" in t.find("tog").state).toBe(false);
    expect("pressed" in Object(t.a11y("tog")).state).toBe(false);
    t.dispose();
  });
});

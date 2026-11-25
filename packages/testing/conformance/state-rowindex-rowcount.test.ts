// @vitest-environment happy-dom
// Spec: k.testing, clause "`find(id).state` has `rowindex: 2` for a row with `aria-rowindex=\"2\"` and `rowcount: 10` for a grid with `aria-rowcount=\"10\"`, and no key for a value that is not an integer; `a11y()` gives a `th scope=\"row\"` role `rowheader`."
// Seed: 1337.
// Assumed: the elements are addressed by `id` through the delegated `data-k` table, as in state-active-sort-mixed.test.ts; `state.rowindex` and `state.rowcount` are numbers.
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, flatten, simCtx } from "./fixtures.ts";

const T = template(
  [
    '<div id="root" data-k="root">',
    '<div id="grid" data-k="grid" role="grid" aria-label="Rows">',
    '<div id="row" data-k="row" role="row"><div role="gridcell" id="cell" data-k="cell">c</div></div>',
    "</div>",
    '<table aria-label="Heads"><tbody><tr><th id="rh" data-k="rh" scope="row">Name</th><td>v</td></tr></tbody></table>',
    "</div>",
  ].join(""),
);

const View = Object.assign(
  (props: { rowindex: string; rowcount: string }): Node => {
    const root = clone(T);
    const set = (sel: string, name: string, value: string): void => {
      const el = root.querySelector(sel);
      if (el === null) throw new Error(`fixture: ${sel} missing`);
      el.setAttribute(name, value);
    };
    set("#row", "aria-rowindex", props.rowindex);
    set("#grid", "aria-rowcount", props.rowcount);
    return root;
  },
  { Props: s.object({ rowindex: s.string(), rowcount: s.string() }) },
);

const mount = (rowindex: string, rowcount: string) => render(View, { props: { rowindex, rowcount }, ctx: simCtx() });

describe("k.testing: find(id).state carries rowindex and rowcount; th scope=row is rowheader", () => {
  it('`find(id).state` has `rowindex: 2` for a row with `aria-rowindex="2"` and `rowcount: 10` for a grid with `aria-rowcount="10"`', () => {
    const t = mount("2", "10");
    expect(t.find("row").state.rowindex).toBe(2);
    expect(t.find("grid").state.rowcount).toBe(10);
    t.dispose();
  });

  it("`state.rowindex` and `state.rowcount` are the integers the attributes hold, for any integer (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 1, max: 100000 }), (i, c) => {
        const t = mount(String(i), String(c));
        expect(t.find("row").state.rowindex).toBe(i);
        expect(t.find("grid").state.rowcount).toBe(c);
        t.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("an empty value is not an integer and gives no key", () => {
    // axe-core refuses every other non-integer value of these attributes at render (E1703), so the empty value is the one a test can mount.
    const t = mount("", "");
    expect("rowindex" in t.find("row").state).toBe(false);
    expect("rowcount" in t.find("grid").state).toBe(false);
    expect("rowindex" in Object(t.a11y("row")).state).toBe(false);
    t.dispose();
  });

  it('`a11y()` gives a `th scope="row"` role `rowheader`', () => {
    const t = mount("1", "2");
    expect(flatten(t.a11y()).find((n) => n.id === "rh")).toMatchObject({ role: "rowheader", name: "Name" });
    expect(t.a11y("rh")).toMatchObject({ role: "rowheader" });
    t.dispose();
  });

  it("`a11y()` state carries `rowindex` and `rowcount` as `find` does", () => {
    const t = mount("2", "10");
    expect(t.a11y("row")).toMatchObject({ state: { rowindex: 2 } });
    expect(t.a11y("grid")).toMatchObject({ state: { rowcount: 10 } });
    t.dispose();
  });
});

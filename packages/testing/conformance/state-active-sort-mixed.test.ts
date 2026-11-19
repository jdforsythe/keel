// @vitest-environment happy-dom
// Spec: k.testing, Conformance "`find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`, `sort: 'ascending'` for a header with that `aria-sort`, and `checked: 'mixed'` for a mixed checkbox."
// Seed: 1337.
// Assumed: a mixed checkbox is `role="checkbox"` with `aria-checked="mixed"`; the elements are addressed by `id` through the delegated `data-k` table, as in fire-focus-0091.
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const T = template(
  [
    '<div id="root" data-k="root">',
    '<input id="c" data-k="c" role="combobox" aria-label="Fruit" aria-expanded="true" aria-controls="c.list">',
    '<ul id="c.list" data-k="c.list" role="listbox" aria-label="Fruits">',
    '<li id="c.option.a" data-k="c.option.a" role="option" aria-selected="false">Apple</li>',
    '<li id="c.option.b" data-k="c.option.b" role="option" aria-selected="false">Banana</li>',
    '<li id="c.option.c" data-k="c.option.c" role="option" aria-selected="false">Cherry</li>',
    "</ul>",
    '<table aria-label="Fruit table"><thead><tr>',
    '<th id="col" data-k="col" scope="col">Name</th>',
    "</tr></thead><tbody><tr><td>Apple</td></tr></tbody></table>",
    '<div id="all" data-k="all" role="checkbox" tabindex="0" aria-label="Select all"></div>',
    "</div>",
  ].join(""),
);

const Props = s.object({
  active: s.enum(["c.option.a", "c.option.b", "c.option.c"]),
  sort: s.enum(["ascending", "descending"]),
  checked: s.enum(["true", "false", "mixed"]),
});

const View = Object.assign(
  (props: { active: string; sort: string; checked: string }): Node => {
    const root = clone(T);
    const set = (sel: string, name: string, value: string): void => {
      const el = root.querySelector(sel);
      if (el === null) throw new Error(`fixture: ${sel} missing`);
      el.setAttribute(name, value);
    };
    set("#c", "aria-activedescendant", props.active);
    set("#col", "aria-sort", props.sort);
    set("#all", "aria-checked", props.checked);
    return root;
  },
  { Props },
);

describe("k.testing: find(id).state carries active, sort and 'mixed'", () => {
  it("`find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`", () => {
    const t = render(View, { props: { active: "c.option.b", sort: "ascending", checked: "false" }, ctx: simCtx() });
    expect(t.find("c").state.active).toBe("c.option.b");
    t.dispose();
  });

  it("`find(id).state.active` is the id `aria-activedescendant` names, for every option", () => {
    fc.assert(
      fc.property(fc.constantFrom("c.option.a", "c.option.b", "c.option.c"), (active) => {
        const t = render(View, { props: { active, sort: "ascending", checked: "false" }, ctx: simCtx() });
        expect(t.find("c").state.active).toBe(active);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`find(id).state` has `sort: 'ascending'` for a header with that `aria-sort`", () => {
    const t = render(View, { props: { active: "c.option.a", sort: "ascending", checked: "false" }, ctx: simCtx() });
    expect(t.find("col").state.sort).toBe("ascending");
    t.dispose();
  });

  it("`find(id).state.sort` is the `aria-sort` value", () => {
    fc.assert(
      fc.property(fc.constantFrom("ascending", "descending"), (sort) => {
        const t = render(View, { props: { active: "c.option.a", sort, checked: "false" }, ctx: simCtx() });
        expect(t.find("col").state.sort).toBe(sort);
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("`find(id).state` has `checked: 'mixed'` for a mixed checkbox", () => {
    const t = render(View, { props: { active: "c.option.a", sort: "ascending", checked: "mixed" }, ctx: simCtx() });
    expect(t.find("all").state.checked).toBe("mixed");
    t.dispose();
  });

  it("`find(id).state.checked` is not 'mixed' for a checkbox that is checked or unchecked", () => {
    fc.assert(
      fc.property(fc.constantFrom("true", "false"), (checked) => {
        const t = render(View, { props: { active: "c.option.a", sort: "ascending", checked }, ctx: simCtx() });
        expect(t.find("all").state.checked).not.toBe("mixed");
        t.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});

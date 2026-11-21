// @vitest-environment happy-dom
// Spec: k.roles, Conformance "`tree` renders a `<ul role="tree">`; a `treeitem` with `expanded` false writes `aria-expanded="false"`, a leaf none; a `group` with `list` renders a `<ul role="group">`."
// Spec: k.roles, Attributes "Each optional prop writes one attribute (ARIA names unless marked HTML); a prop left undefined writes none."
// Spec: k.roles, Attributes "An ARIA boolean writes `"true"` or `"false"`; an HTML boolean is present or absent."
// Seed: 1337.
// Assumed attribute names are the ARIA ones: aria-activedescendant, aria-multiselectable, aria-level, aria-setsize, aria-posinset, aria-selected.
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";
import { SEED, byId, cleanup, render } from "./roles-support.ts";

afterEach(cleanup);
type PartProps = Parameters<typeof Part>[0];
const text = (): string => "x";

describe("k.roles: tree", () => {
  test('`tree` renders a `<ul role="tree">`', () => {
    const { host, off } = render(() => Part({ id: "t", role: "tree", label: "Files", children: text }));
    const el = byId(host, "t");
    expect(el.tagName).toBe("UL");
    expect(el.getAttribute("role")).toBe("tree");
    expect(el.getAttribute("aria-label")).toBe("Files");
    off();
  });

  test("`tree` writes `activeDescendant` and `multiselectable`", () => {
    const { host, off } = render(() =>
      Part({ id: "t", role: "tree", label: "Files", activeDescendant: "t.a", multiselectable: true, children: text }),
    );
    expect(byId(host, "t").getAttribute("aria-activedescendant")).toBe("t.a");
    expect(byId(host, "t").getAttribute("aria-multiselectable")).toBe("true");
    off();
  });

  test('a `treeitem` renders an `<li role="treeitem">`', () => {
    const { host, off } = render(() => Part({ id: "i", role: "treeitem", children: text }));
    expect(byId(host, "i").tagName).toBe("LI");
    expect(byId(host, "i").getAttribute("role")).toBe("treeitem");
    off();
  });

  test('a `treeitem` with `expanded` false writes `aria-expanded="false"`', () => {
    const { host, off } = render(() => Part({ id: "i", role: "treeitem", expanded: false, children: text }));
    expect(byId(host, "i").getAttribute("aria-expanded")).toBe("false");
    off();
  });

  test('a `treeitem` with `expanded` true writes `aria-expanded="true"`', () => {
    const { host, off } = render(() => Part({ id: "i", role: "treeitem", expanded: true, children: text }));
    expect(byId(host, "i").getAttribute("aria-expanded")).toBe("true");
    off();
  });

  test("a leaf `treeitem` (no `expanded`) writes no `aria-expanded`", () => {
    const { host, off } = render(() => Part({ id: "i", role: "treeitem", children: text }));
    expect(byId(host, "i").hasAttribute("aria-expanded")).toBe(false);
    off();
  });

  test("`treeitem` writes `level`, `setSize`, `posInSet` and `selected`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 9 }), (level, n) => {
        const { host, off } = render(() =>
          Part({ id: "i", role: "treeitem", level, setSize: n, posInSet: 1, selected: true, children: text }),
        );
        const el = byId(host, "i");
        expect(el.getAttribute("aria-level")).toBe(String(level));
        expect(el.getAttribute("aria-setsize")).toBe(String(n));
        expect(el.getAttribute("aria-posinset")).toBe("1");
        expect(el.getAttribute("aria-selected")).toBe("true");
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test('a `group` with `list` renders a `<ul role="group">`', () => {
    const { host, off } = render(() => Part({ id: "g", role: "group", list: true, label: "Sub", children: text }));
    const el = byId(host, "g");
    expect(el.tagName).toBe("UL");
    expect(el.getAttribute("role")).toBe("group");
    off();
  });

  test("a `treeitem`'s children sit in a `group` given `list`, nested in the item", () => {
    const { host, off } = render(() =>
      Part({
        id: "t",
        role: "tree",
        label: "Files",
        children: () => [
          Part({
            id: "t.a",
            role: "treeitem",
            expanded: true,
            children: () => [
              "a",
              Part({
                id: "t.a.g",
                role: "group",
                list: true,
                label: "a",
                children: () => [Part({ id: "t.a.b", role: "treeitem", children: text })],
              }),
            ],
          }),
        ],
      }),
    );
    expect(byId(host, "t.a.g").parentElement).toBe(byId(host, "t.a"));
    expect(byId(host, "t.a.g").tagName).toBe("UL");
    off();
  });

  test("types: `tree` needs `label` or `labelledBy`; `treeitem` takes both optional; `expanded` is `treeitem` only", () => {
    expectTypeOf<{ id: string; role: "tree" }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "treeitem" }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "treeitem"; label: string }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "treeitem"; labelledBy: string }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "tree"; label: string; expanded: true }>().not.toMatchTypeOf<PartProps>();
    expect(true).toBe(true);
  });
});

describe("k.roles: attribute table, tree", () => {
  type Row = { name: string; make: () => Node; attr: string; expected: string };
  const tree = (props: object) => () => Part({ id: "e", role: "tree", label: "T", ...props, children: text });
  const item = (props: object) => () => Part({ id: "e", role: "treeitem", ...props, children: text });
  const rows: Row[] = [
    {
      name: "`multiselectable` on `tree` writes `aria-multiselectable`",
      make: tree({ multiselectable: true }),
      attr: "aria-multiselectable",
      expected: "true",
    },
    {
      name: "`activeDescendant` on `tree` writes `aria-activedescendant`",
      make: tree({ activeDescendant: "i1" }),
      attr: "aria-activedescendant",
      expected: "i1",
    },
    {
      name: "`expanded` on `treeitem` writes `aria-expanded`",
      make: item({ expanded: false }),
      attr: "aria-expanded",
      expected: "false",
    },
    { name: "`level` on `treeitem` writes `aria-level`", make: item({ level: 2 }), attr: "aria-level", expected: "2" },
    {
      name: "`setSize` on `treeitem` writes `aria-setsize`",
      make: item({ setSize: 3 }),
      attr: "aria-setsize",
      expected: "3",
    },
    {
      name: "`posInSet` on `treeitem` writes `aria-posinset`",
      make: item({ posInSet: 1 }),
      attr: "aria-posinset",
      expected: "1",
    },
    {
      name: "`selected` on `treeitem` writes `aria-selected`",
      make: item({ selected: true }),
      attr: "aria-selected",
      expected: "true",
    },
    {
      name: "`disabled` on `treeitem` writes `aria-disabled`",
      make: item({ disabled: true }),
      attr: "aria-disabled",
      expected: "true",
    },
  ];
  test.each(rows)("$name", ({ make, attr, expected }) => {
    const { host, off } = render(make);
    expect(byId(host, "e").getAttribute(attr)).toBe(expected);
    off();
  });

  test('an ARIA boolean writes `"true"` or `"false"`', () => {
    for (const v of [true, false]) {
      const a = render(item({ selected: v, disabled: v, expanded: v }));
      const el = byId(a.host, "e");
      for (const n of ["aria-selected", "aria-disabled", "aria-expanded"]) expect(el.getAttribute(n)).toBe(String(v));
      a.off();
      const b = render(tree({ multiselectable: v }));
      expect(byId(b.host, "e").getAttribute("aria-multiselectable")).toBe(String(v));
      b.off();
    }
  });

  test("a prop left undefined writes no attribute", () => {
    const a = render(item({}));
    for (const n of [
      "aria-expanded",
      "aria-level",
      "aria-setsize",
      "aria-posinset",
      "aria-selected",
      "aria-disabled",
    ]) {
      expect(byId(a.host, "e").hasAttribute(n)).toBe(false);
    }
    a.off();
    const b = render(tree({}));
    for (const n of ["aria-activedescendant", "aria-multiselectable"])
      expect(byId(b.host, "e").hasAttribute(n)).toBe(false);
    b.off();
  });
});

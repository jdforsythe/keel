// @vitest-environment happy-dom
// Spec: k.roles, Conformance "`grid` renders `<table role="grid" aria-label=...>`; `gridcell` a `<td role="gridcell">`; `current: 'date'` writes `aria-current="date"`."
// Spec: k.roles, Conformance "A `columnheader` with `abbr="Monday"` writes the `abbr` attribute."
// Spec: k.roles, Attributes "Each optional prop writes one attribute (ARIA names unless marked HTML); a prop left undefined writes none."
// Spec: k.roles, Attributes "An ARIA boolean writes `"true"` or `"false"`; an HTML boolean is present or absent."
// Seed: 1337.
// Assumed attribute names for the optional props are the ARIA ones: rowCount aria-rowcount, colCount aria-colcount, multiselectable aria-multiselectable, readOnly aria-readonly, selected aria-selected, colSpan colspan.
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";
import { SEED, byId, cleanup, render } from "./roles-support.ts";

afterEach(cleanup);
type PartProps = Parameters<typeof Part>[0];
type Of<R extends string> = Extract<PartProps, { role: R }>;
const text = (): string => "x";

describe("k.roles: grid", () => {
  test('`grid` renders `<table role="grid" aria-label=...>`', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z]{1,12}$/), (label) => {
        const { host, off } = render(() => Part({ id: "g", role: "grid", label, children: text }));
        const el = byId(host, "g");
        expect(el.tagName).toBe("TABLE");
        expect(el.getAttribute("role")).toBe("grid");
        expect(el.getAttribute("aria-label")).toBe(label);
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`grid` takes `labelledBy` instead of `label`, and writes `aria-labelledby`", () => {
    const { host, off } = render(() => Part({ id: "g", role: "grid", labelledBy: "h", children: text }));
    expect(byId(host, "g").getAttribute("aria-labelledby")).toBe("h");
    expect(byId(host, "g").hasAttribute("aria-label")).toBe(false);
    off();
  });

  test("`grid` writes `rowCount`, `colCount`, `multiselectable` and `readOnly` as ARIA attributes", () => {
    const { host, off } = render(() =>
      Part({
        id: "g",
        role: "grid",
        label: "G",
        rowCount: 6,
        colCount: 7,
        multiselectable: true,
        readOnly: false,
        children: text,
      }),
    );
    const el = byId(host, "g");
    expect(el.getAttribute("aria-rowcount")).toBe("6");
    expect(el.getAttribute("aria-colcount")).toBe("7");
    expect(el.getAttribute("aria-multiselectable")).toBe("true");
    expect(el.getAttribute("aria-readonly")).toBe("false");
    off();
  });

  test('`gridcell` renders a `<td role="gridcell">`', () => {
    const { host, off } = render(() => Part({ id: "c", role: "gridcell", children: text }));
    const el = byId(host, "c");
    expect(el.tagName).toBe("TD");
    expect(el.getAttribute("role")).toBe("gridcell");
    off();
  });

  test("`current: 'date'` writes `aria-current=\"date\"`; `true` and `false` write their strings", () => {
    for (const [current, written] of [
      ["date", "date"],
      [true, "true"],
      [false, "false"],
    ] as const) {
      const { host, off } = render(() => Part({ id: "c", role: "gridcell", current, children: text }));
      expect(byId(host, "c").getAttribute("aria-current")).toBe(written);
      off();
    }
  });

  test("`gridcell` writes `selected`, `disabled`, `readOnly` and `colSpan`", () => {
    const { host, off } = render(() =>
      Part({ id: "c", role: "gridcell", selected: true, disabled: true, readOnly: true, colSpan: 2, children: text }),
    );
    const el = byId(host, "c");
    expect(el.getAttribute("aria-selected")).toBe("true");
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect(el.getAttribute("aria-readonly")).toBe("true");
    expect(el.getAttribute("colspan")).toBe("2");
    off();
  });

  test("a `gridcell` without `current` writes no `aria-current`", () => {
    const { host, off } = render(() => Part({ id: "c", role: "gridcell", children: text }));
    expect(byId(host, "c").hasAttribute("aria-current")).toBe(false);
    off();
  });

  test("a `grid` holds `rowgroup`, `row`, `columnheader`, `rowheader` and `gridcell` parts as their tags", () => {
    const { host, off } = render(() =>
      Part({
        id: "g",
        role: "grid",
        label: "G",
        children: () => [
          Part({
            id: "g.h",
            role: "rowgroup",
            head: true,
            children: () => [
              Part({
                id: "g.h.r",
                role: "row",
                children: () => [Part({ id: "g.h.c", role: "columnheader", children: text })],
              }),
            ],
          }),
          Part({
            id: "g.b",
            role: "rowgroup",
            children: () => [
              Part({
                id: "g.b.r",
                role: "row",
                children: () => [
                  Part({ id: "g.b.rh", role: "rowheader", children: text }),
                  Part({ id: "g.b.c", role: "gridcell", children: text }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    expect(byId(host, "g.h").tagName).toBe("THEAD");
    expect(byId(host, "g.b").tagName).toBe("TBODY");
    expect(byId(host, "g.h.r").tagName).toBe("TR");
    expect(byId(host, "g.h.c").tagName).toBe("TH");
    expect(byId(host, "g.b.rh").getAttribute("scope")).toBe("row");
    expect(byId(host, "g.b.c").tagName).toBe("TD");
    off();
  });

  test('A `columnheader` with `abbr="Monday"` writes the `abbr` attribute', () => {
    const { host, off } = render(() => Part({ id: "h", role: "columnheader", abbr: "Monday", children: text }));
    expect(byId(host, "h").getAttribute("abbr")).toBe("Monday");
    off();
  });

  test("property: a `columnheader` writes `abbr` as given", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z]{1,12}$/), (abbr) => {
        const { host, off } = render(() => Part({ id: "h", role: "columnheader", abbr, children: text }));
        expect(byId(host, "h").getAttribute("abbr")).toBe(abbr);
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("types: `grid` needs `label` or `labelledBy`; `abbr` is `columnheader` only; `current` takes `'date'`", () => {
    expectTypeOf<{ id: string; role: "grid" }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "grid"; label: string }>().toMatchTypeOf<PartProps>();
    expectTypeOf<Of<"columnheader">>().toHaveProperty("abbr");
    expectTypeOf<Of<"cell">>().not.toHaveProperty("abbr");
    expectTypeOf<{ id: string; role: "gridcell"; current: "date" }>().toMatchTypeOf<PartProps>();
    expect(true).toBe(true);
  });
});

describe("k.roles: attribute table, grid", () => {
  type Row = { name: string; make: () => Node; attr: string; expected: string };
  const cell =
    (props: Record<string, never> | object = {}) =>
    () =>
      Part({ id: "e", role: "gridcell", ...props, children: text });
  const grid = (props: object) => () => Part({ id: "e", role: "grid", label: "G", ...props, children: text });
  const rows: Row[] = [
    {
      name: "`rowCount` on `grid` writes `aria-rowcount`",
      make: grid({ rowCount: 6 }),
      attr: "aria-rowcount",
      expected: "6",
    },
    {
      name: "`colCount` on `grid` writes `aria-colcount`",
      make: grid({ colCount: 7 }),
      attr: "aria-colcount",
      expected: "7",
    },
    {
      name: "`multiselectable` on `grid` writes `aria-multiselectable`",
      make: grid({ multiselectable: true }),
      attr: "aria-multiselectable",
      expected: "true",
    },
    {
      name: "`readOnly` on `grid` writes `aria-readonly`",
      make: grid({ readOnly: true }),
      attr: "aria-readonly",
      expected: "true",
    },
    {
      name: "`readOnly` on `gridcell` writes `aria-readonly`",
      make: cell({ readOnly: true }),
      attr: "aria-readonly",
      expected: "true",
    },
    {
      name: "`selected` on `gridcell` writes `aria-selected`",
      make: cell({ selected: true }),
      attr: "aria-selected",
      expected: "true",
    },
    {
      name: "`disabled` on `gridcell` writes `aria-disabled`",
      make: cell({ disabled: true }),
      attr: "aria-disabled",
      expected: "true",
    },
    {
      name: "`current` on `gridcell` writes `aria-current`",
      make: cell({ current: "date" }),
      attr: "aria-current",
      expected: "date",
    },
    {
      name: "`colSpan` on `gridcell` writes the HTML `colspan`",
      make: cell({ colSpan: 2 }),
      attr: "colspan",
      expected: "2",
    },
    {
      name: "`abbr` on `columnheader` writes the HTML `abbr`",
      make: () => Part({ id: "e", role: "columnheader", abbr: "Mon", children: text }),
      attr: "abbr",
      expected: "Mon",
    },
  ];
  test.each(rows)("$name", ({ make, attr, expected }) => {
    const { host, off } = render(make);
    expect(byId(host, "e").getAttribute(attr)).toBe(expected);
    off();
  });

  test('an ARIA boolean writes `"true"` or `"false"`', () => {
    for (const v of [true, false]) {
      const { host, off } = render(cell({ selected: v, readOnly: v, disabled: v }));
      const el = byId(host, "e");
      for (const a of ["aria-selected", "aria-readonly", "aria-disabled"]) expect(el.getAttribute(a)).toBe(String(v));
      off();
    }
  });

  test("a prop left undefined writes no attribute", () => {
    const { host, off } = render(cell());
    const el = byId(host, "e");
    for (const a of ["aria-selected", "aria-readonly", "aria-disabled", "aria-current", "colspan"])
      expect(el.hasAttribute(a)).toBe(false);
    off();
    const g = render(grid({}));
    const gel = byId(g.host, "e");
    for (const a of ["aria-rowcount", "aria-colcount", "aria-multiselectable", "aria-readonly"])
      expect(gel.hasAttribute(a)).toBe(false);
    g.off();
    const h = render(() => Part({ id: "e", role: "columnheader", children: text }));
    expect(byId(h.host, "e").hasAttribute("abbr")).toBe(false);
    h.off();
  });
});

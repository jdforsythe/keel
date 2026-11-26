// @vitest-environment happy-dom
// Property: `Part` renders every role, given generated required props inside its required parent, with no axe violation.
import { mount } from "@keel/runtime-dom";
import { fixedTime } from "@keel/tooling/test-time";
import { Part } from "@keel/ui/aria";
import type { PartRole } from "@keel/ui/aria";
import axe from "axe-core";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { testCtx } from "./testCtx.ts";

const SEED = 1337;
const config: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  rules: Object.fromEntries(
    ["region", "landmark-one-main", "page-has-heading-one", "landmark-unique", "color-contrast"].map((id) => [
      id,
      { enabled: false },
    ]),
  ),
};

type Gen = { name: string; on: boolean; checked: boolean | "mixed"; sort: "ascending" | "descending" | undefined };
const gen: fc.Arbitrary<Gen> = fc.record({
  name: fc.stringMatching(/^[A-Z][a-z]{1,10}$/),
  on: fc.boolean(),
  checked: fc.constantFrom<boolean | "mixed">(true, false, "mixed"),
  sort: fc.constantFrom<"ascending" | "descending" | undefined>("ascending", "descending", undefined),
});

const text = (g: Gen) => () => g.name;
const table = (g: Gen, cell: () => Node): Node =>
  Part({
    id: "t",
    role: "table",
    label: g.name,
    children: () => [
      Part({
        id: "g",
        role: "rowgroup",
        children: () => [Part({ id: "r", role: "row", rowIndex: 1, children: () => [cell()] })],
      }),
    ],
  });

const cases: Record<PartRole, (g: Gen) => Node[]> = {
  listbox: (g) => [
    Part({
      id: "l",
      role: "listbox",
      label: g.name,
      children: () => [Part({ id: "o", role: "option", selected: g.on, children: text(g) })],
    }),
  ],
  menu: (g) => [
    Part({
      id: "m",
      role: "menu",
      label: g.name,
      children: () => [Part({ id: "i", role: "menuitem", children: text(g) })],
    }),
  ],
  option: (g) => cases.listbox(g),
  menuitem: (g) => cases.menu(g),
  menuitemcheckbox: (g) => [
    Part({
      id: "m",
      role: "menu",
      label: g.name,
      children: () => [Part({ id: "i", role: "menuitemcheckbox", checked: g.on, children: text(g) })],
    }),
  ],
  combobox: (g) => [
    Part({ id: "c", role: "combobox", label: g.name, expanded: g.on, controls: "l" }),
    ...cases.listbox(g),
  ],
  button: (g) => [
    Part({ id: "b", role: "button", controls: "p", children: text(g) }),
    Part({ id: "p", role: "generic", children: text(g) }),
  ],
  checkbox: (g) => [Part({ id: "c", role: "checkbox", label: g.name, checked: g.checked })],
  tablist: (g) => [
    Part({
      id: "tl",
      role: "tablist",
      label: g.name,
      children: () => [Part({ id: "t", role: "tab", selected: g.on, controls: "p", children: text(g) })],
    }),
    Part({ id: "p", role: "tabpanel", labelledBy: "t", children: text(g) }),
  ],
  tab: (g) => cases.tablist(g),
  tabpanel: (g) => cases.tablist(g),
  dialog: (g) => [
    Part({ id: "h", role: "generic", children: text(g) }),
    Part({ id: "d", role: "dialog", labelledBy: "h", open: false, children: text(g) }),
  ],
  alertdialog: (g) => [
    Part({ id: "h", role: "generic", children: text(g) }),
    Part({ id: "s", role: "generic", children: text(g) }),
    Part({ id: "d", role: "alertdialog", labelledBy: "h", describedBy: "s", open: false, children: text(g) }),
  ],
  status: (g) => [Part({ id: "s", role: "status", children: text(g) })],
  alert: (g) => [Part({ id: "s", role: "alert", children: text(g) })],
  generic: (g) => [Part({ id: "s", role: "generic", children: text(g) })],
  navigation: (g) => [Part({ id: "n", role: "navigation", label: g.name, children: text(g) })],
  group: (g) => [Part({ id: "n", role: "group", label: g.name, children: text(g) })],
  table: (g) => [table(g, () => Part({ id: "c", role: "cell", children: text(g) }))],
  rowgroup: (g) => cases.table(g),
  row: (g) => cases.table(g),
  cell: (g) => cases.table(g),
  columnheader: (g) => [table(g, () => Part({ id: "c", role: "columnheader", sort: g.sort, children: text(g) }))],
  rowheader: (g) => [table(g, () => Part({ id: "c", role: "rowheader", children: text(g) }))],
  grid: (g) => [
    Part({
      id: "g",
      role: "grid",
      label: g.name,
      rowCount: 1,
      readOnly: g.on,
      children: () => [
        Part({
          id: "g.b",
          role: "rowgroup",
          children: () => [
            Part({
              id: "g.r",
              role: "row",
              children: () => [
                Part({ id: "g.h", role: "columnheader", abbr: g.name, children: text(g) }),
                Part({
                  id: "g.c",
                  role: "gridcell",
                  selected: g.on,
                  current: g.on ? "date" : false,
                  children: text(g),
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
  gridcell: (g) => cases.grid(g),
  tree: (g) => [
    Part({
      id: "t",
      role: "tree",
      label: g.name,
      children: () => [
        Part({
          id: "t.a",
          role: "treeitem",
          expanded: true,
          level: 1,
          setSize: 1,
          posInSet: 1,
          children: () => [
            g.name,
            Part({
              id: "t.a.g",
              role: "group",
              list: true,
              label: g.name,
              children: () => [Part({ id: "t.b", role: "treeitem", selected: g.on, level: 2, children: text(g) })],
            }),
          ],
        }),
      ],
    }),
  ],
  treeitem: (g) => cases.tree(g),
  slider: (g) => [
    Part({ id: "s", role: "slider", label: g.name, min: 0, max: 10, value: 4, valueText: g.name, disabled: g.on }),
  ],
  radiogroup: (g) => [
    Part({
      id: "r",
      role: "radiogroup",
      label: g.name,
      required: g.on,
      children: () => [
        Part({ id: "r.a", role: "radio", label: g.name, name: "n", checked: g.on, value: "a" }),
        Part({ id: "r.b", role: "radio", label: `${g.name}b`, name: "n", checked: !g.on, value: "b" }),
      ],
    }),
  ],
  radio: (g) => cases.radiogroup(g),
};

afterEach(() => {
  document.body.innerHTML = "";
});

test(
  "every role with generated required props has no axe violations",
  async () => {
    document.documentElement.setAttribute("lang", "en");
    document.head.innerHTML = "<title>Part</title>";
    const roles = Object.keys(cases).filter((r): r is PartRole => r in cases);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...roles), gen, async (role, g) => {
        document.body.innerHTML = '<main><div id="host"></div></main>';
        const host = document.getElementById("host");
        if (host === null) throw new Error("no host");
        const off = mount(() => Part({ id: "w", role: "generic", children: () => cases[role](g) }), host, {
          ctx: testCtx,
        });
        const r = await axe.run(host, config);
        expect(r.violations.map((v) => `${role}: ${v.id}`)).toEqual([]);
        off();
      }),
      { seed: SEED, numRuns: 93 },
    );
  },
  fixedTime(60_000),
);

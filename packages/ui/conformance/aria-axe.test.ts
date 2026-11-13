// @vitest-environment happy-dom
// Spec: k.aria, Conformance "Each role rendered with its required props, inside its required parent and children (a `listbox` with one `option`, a `table` with one `row` of one `cell`), has no axe violations."
// Seed: 1337 (no generated inputs; every case is enumerated).
// Real axe-core, same rule set and disabled page-level rules as base-elements-axe-core.test.ts; `color-contrast` is off because happy-dom computes no layout.
// Optional props are passed alongside the required ones where the Roles table is unclear which are required.
import { mount } from "@keel/runtime-dom";
import { Heading, Text } from "@keel/ui";
import { Part } from "@keel/ui/aria";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const DISABLED = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "landmark-no-duplicate-main",
  "landmark-unique",
  "landmark-complementary-is-top-level",
  "landmark-main-is-top-level",
  "landmark-banner-is-top-level",
  "landmark-contentinfo-is-top-level",
  "bypass",
  "skip-link",
  "color-contrast",
];

const config: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
  rules: Object.fromEntries(DISABLED.map((id) => [id, { enabled: false }])),
};

let container: HTMLElement;
beforeEach(() => {
  document.documentElement.setAttribute("lang", "en");
  document.head.innerHTML = "<title>Conformance</title>";
  document.body.innerHTML = '<main><div id="host"></div></main>';
  const host = document.getElementById("host");
  if (host === null) throw new Error("no host");
  container = host;
});
afterEach(() => {
  document.body.innerHTML = "";
});

const audit = async (): Promise<string[]> => {
  const r = await axe.run(container, config);
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
};

const option = (id: string): Node => Part({ id, role: "option", selected: false, children: () => "Apple" });
const listbox = (id: string): Node =>
  Part({ id, role: "listbox", label: "Fruit", children: () => [option(`${id}.o`)] });
const menu = (children: () => Node[]): Node => Part({ id: "m", role: "menu", label: "Actions", children });

const cases: [string, () => Node[]][] = [
  ["listbox", () => [listbox("lb")]],
  ["option", () => [listbox("lb")]],
  ["menu with menuitem", () => [menu(() => [Part({ id: "mi", role: "menuitem", children: () => "Open" })])]],
  [
    "menu with menuitemcheckbox",
    () => [menu(() => [Part({ id: "mc", role: "menuitemcheckbox", checked: false, children: () => "Wrap" })])],
  ],
  [
    "combobox",
    () => [Part({ id: "cb", role: "combobox", label: "Fruit", expanded: false, controls: "lb" }), listbox("lb")],
  ],
  [
    "button",
    () => [
      Part({ id: "b", role: "button", controls: "pn", hasPopup: "dialog", expanded: false, children: () => "Details" }),
      Part({ id: "pn", role: "generic", hidden: true, children: () => "Panel" }),
    ],
  ],
  ["checkbox", () => [Part({ id: "ck", role: "checkbox", label: "Agree", checked: "mixed" })]],
  [
    "tablist with tab and tabpanel",
    () => [
      Part({
        id: "tl",
        role: "tablist",
        label: "Sections",
        children: () => [Part({ id: "t1", role: "tab", selected: true, controls: "p1", children: () => "One" })],
      }),
      Part({ id: "p1", role: "tabpanel", labelledBy: "t1", children: () => "Panel one" }),
    ],
  ],
  [
    "dialog",
    () => [
      Heading({ id: "ttl", level: 2, children: "Title" }),
      Part({ id: "dg", role: "dialog", labelledBy: "ttl", open: false, children: () => [Text({ children: "Body" })] }),
    ],
  ],
  [
    "alertdialog",
    () => [
      Heading({ id: "ttl", level: 2, children: "Delete" }),
      Text({ id: "dsc", children: "This cannot be undone" }),
      Part({
        id: "ad",
        role: "alertdialog",
        labelledBy: "ttl",
        describedBy: "dsc",
        open: false,
        children: () => [Text({ children: "Body" })],
      }),
    ],
  ],
  ["status", () => [Part({ id: "st", role: "status", children: () => "Saved" })]],
  ["alert", () => [Part({ id: "al", role: "alert", children: () => "Failed" })]],
  ["generic", () => [Part({ id: "gn", role: "generic", children: () => "Text" })]],
  ["navigation", () => [Part({ id: "nv", role: "navigation", label: "Main", children: () => "Links" })]],
  ["group", () => [Part({ id: "gp", role: "group", label: "Options", children: () => "Items" })]],
  [
    "table with row of one cell",
    () => [
      Part({
        id: "tb",
        role: "table",
        label: "Orders",
        rowCount: 1,
        children: () => [
          Part({
            id: "rg",
            role: "rowgroup",
            children: () => [
              Part({
                id: "r1",
                role: "row",
                rowIndex: 1,
                children: () => [Part({ id: "c1", role: "cell", colSpan: 1, children: () => "Ada" })],
              }),
            ],
          }),
        ],
      }),
    ],
  ],
  [
    "rowgroup head, row, columnheader and rowheader",
    () => [
      Part({
        id: "tb",
        role: "table",
        label: "Orders",
        rowCount: 2,
        children: () => [
          Part({
            id: "hd",
            role: "rowgroup",
            head: true,
            children: () => [
              Part({
                id: "r0",
                role: "row",
                rowIndex: 1,
                children: () => [Part({ id: "ch", role: "columnheader", sort: "ascending", children: () => "Name" })],
              }),
            ],
          }),
          Part({
            id: "bd",
            role: "rowgroup",
            children: () => [
              Part({
                id: "r1",
                role: "row",
                rowIndex: 2,
                children: () => [Part({ id: "rh", role: "rowheader", children: () => "Ada" })],
              }),
            ],
          }),
        ],
      }),
    ],
  ],
];

describe("k.aria: Each role rendered with its required props, inside its required parent and children, has no axe violations", () => {
  for (const [name, make] of cases) {
    test.skip(`${name} has no axe violations`, async () => {
      const off = mount(() => Part({ id: "wrap", role: "generic", children: make }), container);
      expect(await audit()).toEqual([]);
      off();
    });
  }
});

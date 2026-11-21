// @vitest-environment happy-dom
// Spec: k.roles, Conformance "A `grid` with one `row` of one `gridcell`, a `tree` with one `treeitem`, a `slider` and a `radiogroup` with two `radio`s each have no axe violations."
// Seed: 1337 (no generated inputs; every case is enumerated).
// Real axe-core with the rule set and disabled page-level rules of aria-axe.test.ts; `color-contrast` is off because happy-dom computes no layout.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
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

const audit = async (make: () => Node): Promise<string[]> => {
  const off = mount(make, container, { ctx: createCtx({ mode: "sim", seed: 1337 }) });
  const r = await axe.run(container, config);
  off();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
};
const cell = (): Node => Part({ id: "g.c", role: "gridcell", children: () => "1" });

describe("k.roles: axe", () => {
  test("A `grid` with one `row` of one `gridcell` has no axe violations", async () => {
    const make = (): Node =>
      Part({
        id: "g",
        role: "grid",
        label: "Days",
        children: () => [
          Part({
            id: "g.b",
            role: "rowgroup",
            children: () => [Part({ id: "g.r", role: "row", children: () => [cell()] })],
          }),
        ],
      });
    expect(await audit(make)).toEqual([]);
  });

  test("A `tree` with one `treeitem` has no axe violations", async () => {
    const make = (): Node =>
      Part({
        id: "t",
        role: "tree",
        label: "Files",
        children: () => [Part({ id: "t.a", role: "treeitem", children: () => "a" })],
      });
    expect(await audit(make)).toEqual([]);
  });

  test("A `slider` has no axe violations", async () => {
    const make = (): Node => Part({ id: "s", role: "slider", label: "Size", min: 0, max: 10, value: 4 });
    expect(await audit(make)).toEqual([]);
  });

  test("A `radiogroup` with two `radio`s has no axe violations", async () => {
    const make = (): Node =>
      Part({
        id: "g",
        role: "radiogroup",
        label: "Size",
        children: () => [
          Part({ id: "g.a", role: "radio", label: "Small", name: "size", checked: true }),
          Part({ id: "g.b", role: "radio", label: "Large", name: "size", checked: false }),
        ],
      });
    expect(await audit(make)).toEqual([]);
  });
});

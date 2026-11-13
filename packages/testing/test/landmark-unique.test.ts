// @vitest-environment happy-dom
// Spec: k.a11y Render checks: axe-core runs `landmark-unique` beside the WCAG tags. Property seed: 1337.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "../src/internal/axe.ts";

const SEED = 1337;
const dom = (html: string): HTMLElement => {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};
const rules = (html: string): string[] => axe(dom(html), false).violations.map((v) => v.rule);
afterEach(() => {
  document.body.innerHTML = "";
});

describe("landmark-unique (axe-core)", () => {
  it("navs sharing a name violate once per group", () => {
    expect(rules('<nav aria-label="Site"></nav><nav aria-label="site"></nav>')).toEqual(["landmark-unique"]);
    expect(rules('<nav aria-label="a"></nav><nav aria-label="a"></nav><nav aria-label="a"></nav>')).toEqual([
      "landmark-unique",
    ]);
  });

  it("distinct names, one landmark per role, and different roles pass", () => {
    expect(rules('<nav aria-label="Site"></nav><nav aria-label="Docs"></nav>')).toEqual([]);
    expect(rules("<nav></nav>")).toEqual([]);
    expect(rules('<nav aria-label="A"></nav><aside aria-label="A"></aside>')).toEqual([]);
  });

  it("hidden landmarks are skipped and the violation names the element", () => {
    expect(rules('<nav hidden aria-label="a"></nav><nav aria-label="a"></nav>')).toEqual([]);
    const [first] = axe(dom('<nav id="a" aria-label="x"></nav><nav aria-label="x"></nav>'), false).violations;
    expect(first).toMatchObject({ rule: "landmark-unique", element: "a", at: '<nav id="a">' });
  });

  it("any N navs with pairwise-distinct names pass; a duplicated name fails", () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 2, maxLength: 8 });
    const html = (ns: readonly string[]): string => ns.map((n) => `<nav aria-label="${n}"></nav>`).join("");
    fc.assert(
      fc.property(names, fc.nat(), (ns, k) => {
        expect(rules(html(ns))).toEqual([]);
        const dup = [...ns, ns[k % ns.length] ?? ""];
        expect(rules(html(dup)).filter((r) => r === "landmark-unique")).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

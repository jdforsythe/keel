// @vitest-environment happy-dom
// Spec: k.testing a11y (axe-compatible rule landmark-unique). Property seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assertAccessible } from "../src/internal/assertAccessible.ts";
import { axe } from "../src/internal/axe.ts";

const SEED = 1337;
const dom = (html: string): HTMLElement => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};
const rules = (html: string): string[] => axe(dom(html)).map((v) => v.rule);

describe("landmark-unique", () => {
  it("two unnamed navs, or two navs with one name, both violate", () => {
    expect(rules("<nav></nav><nav></nav>")).toEqual(["landmark-unique", "landmark-unique"]);
    expect(rules('<nav aria-label="Site"></nav><nav aria-label="site"></nav>')).toEqual([
      "landmark-unique",
      "landmark-unique",
    ]);
  });

  it("distinct names, one landmark per role, and different roles pass", () => {
    expect(rules('<nav aria-label="Site"></nav><nav aria-label="Docs"></nav>')).toEqual([]);
    expect(rules("<nav></nav>")).toEqual([]);
    expect(rules('<nav aria-label="A"></nav><aside aria-label="A"></aside>')).toEqual([]);
  });

  it("region and form count only with a name; header and footer only outside sectioning content", () => {
    expect(rules("<section></section><section></section><form></form><form></form>")).toEqual([]);
    expect(rules('<section aria-label="x"></section><div role="region" aria-label="x"></div>')).toHaveLength(2);
    expect(rules('<form aria-label="f"></form><form aria-label="f"></form>')).toHaveLength(2);
    expect(rules("<header></header><header></header>")).toHaveLength(2);
    expect(rules("<article><header></header></article><section><header></header></section>")).toEqual([]);
  });

  it("hidden landmarks are skipped and the report names the element and a fix", () => {
    expect(rules("<nav hidden></nav><nav></nav>")).toEqual([]);
    expect(axe(dom('<nav id="a"></nav><nav></nav>'))[0]).toEqual({
      rule: "landmark-unique",
      at: '<nav id="a">',
      help: "shares its landmark role and name with another landmark; give each a distinct label",
    });
    expect(() => assertAccessible(dom("<nav></nav><nav></nav>"))).toThrow(/^E1703 landmark-unique: <nav>/);
  });

  it("any N same-role landmarks with pairwise-distinct names pass; a duplicated name fails", () => {
    const names = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 2, maxLength: 8 });
    const html = (ns: readonly string[]): string => ns.map((n) => `<nav aria-label="${n}"></nav>`).join("");
    fc.assert(
      fc.property(names, fc.nat(), (ns, k) => {
        expect(rules(html(ns))).toEqual([]);
        const dup = [...ns, ns[k % ns.length] ?? ""];
        expect(rules(html(dup)).filter((r) => r === "landmark-unique")).toHaveLength(2);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

// @vitest-environment happy-dom
// Spec: k.ui, clause "The `keel.base` layer holds `th{text-align:inherit}` and `.k-scroll{overflow-x:auto;min-width:0}` with any tokens, `brandTokens` and tokens with no `base` alike."
// Spec: k.ui, clause "`<Box scroll=\"x\" label=\"Prices\">` renders a `div` with `role=\"region\"`, `tabindex=\"0\"`, `aria-label=\"Prices\"` and class `k-scroll`, in server and client output, and has no axe violations holding a `table`; `labelledBy=\"t\"` writes `aria-labelledby=\"t\"` and no `aria-label`; a `Box` without `scroll` writes none of these."
// Spec: k.ui, clause "`scroll` with `as`, `scroll=\"y\"`, and `scroll=\"x\"` with neither or both of `label` and `labelledBy` are type errors."
// Seed: 1337.
// Not built yet (rfc:0203): the cases fail until `Box` takes `scroll`; plain `test`, not skipped. `tsc` reports the new props as unknown until then.
// The server-output half is packages/server/conformance/scroll-region-server.test.ts; axe is real axe-core with the page-level rules off, as base-elements-axe-core.test.ts.
// Type-level assertions are checked by `tsc`; the runtime expects keep each case a test.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Box } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import axe from "axe-core";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { baseLayer, compileWith, ruleBody } from "./base-support.ts";
import { SEED } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: SEED });
type BoxP = Parameters<typeof Box>[0];

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

const table = (): Node => {
  const t = document.createElement("table");
  t.innerHTML = "<caption>Prices</caption><thead><tr><th>Item</th></tr></thead><tbody><tr><td>Tea</td></tr></tbody>";
  return t;
};

const THEMES = [
  ["the fixture tokens with no `base`", () => compileWith({}, [])],
  ["`brandTokens`", () => compileStyles({ tokens: brandTokens, usages: [] })],
  ["tokens with a `base.page`", () => compileWith({ base: { page: { fg: "fg", bg: "bg" } } }, [])],
] as const;

describe("k.ui: the two base rules", () => {
  for (const [name, make] of THEMES) {
    test(`The \`keel.base\` layer holds \`th{text-align:inherit}\` and \`.k-scroll{overflow-x:auto;min-width:0}\` with ${name}`, () => {
      const layer = baseLayer(make().css) ?? "";
      expect(ruleBody(layer, "th")).toBe("text-align:inherit");
      const scroll = ruleBody(layer, ".k-scroll") ?? "";
      expect(
        scroll
          .split(";")
          .filter((d) => d !== "")
          .sort(),
      ).toEqual(["min-width:0", "overflow-x:auto"]);
    });
  }

  test("the two rules are in the layer for any token color value and any use of style props (property)", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^#[0-9a-f]{6}$/), fc.constantFrom("0", "1", "2", "3"), (hex, p) => {
        const { css } = compileWith({ color: { fg: hex, bg: "#ffffff", accent: "#0a5" } }, [{ props: { p } }]);
        const layer = baseLayer(css) ?? "";
        expect(ruleBody(layer, "th")).toBe("text-align:inherit");
        expect(ruleBody(layer, ".k-scroll")).toContain("overflow-x:auto");
        expect(ruleBody(layer, ".k-scroll")).toContain("min-width:0");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});

describe("k.ui: the scroll region", () => {
  test('`<Box scroll="x" label="Prices">` renders a `div` with `role="region"`, `tabindex="0"`, `aria-label="Prices"` and class `k-scroll` in client output', () => {
    const off = mount(() => Box({ id: "x", scroll: "x", label: "Prices", children: table }), container, {
      ctx: simCtx,
    });
    const el = document.getElementById("x");
    expect(el?.tagName).toBe("DIV");
    expect(el?.getAttribute("role")).toBe("region");
    expect(el?.getAttribute("tabindex")).toBe("0");
    expect(el?.getAttribute("aria-label")).toBe("Prices");
    expect(el?.classList.contains("k-scroll")).toBe(true);
    off();
  });

  test("any label is written as the `aria-label` of the region (property)", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), (label) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const off = mount(() => Box({ id: "x", scroll: "x", label, children: "c" }), host, { ctx: simCtx });
        const el = host.querySelector("#x");
        expect(el?.getAttribute("aria-label")).toBe(label);
        expect(el?.getAttribute("role")).toBe("region");
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a scroll region holding a `table` has no axe violations", async () => {
    const off = mount(() => Box({ id: "x", scroll: "x", label: "Prices", children: table }), container, {
      ctx: simCtx,
    });
    expect(document.getElementById("x")?.getAttribute("role")).toBe("region");
    const r = await axe.run(container, config);
    expect(r.violations.map((v) => v.id)).toEqual([]);
    off();
  });

  test('`labelledBy="t"` writes `aria-labelledby="t"` and no `aria-label`', () => {
    const off = mount(() => Box({ id: "x", scroll: "x", labelledBy: "t", children: table }), container, {
      ctx: simCtx,
    });
    const el = document.getElementById("x");
    expect(el?.getAttribute("aria-labelledby")).toBe("t");
    expect(el?.hasAttribute("aria-label")).toBe(false);
    expect(el?.getAttribute("role")).toBe("region");
    off();
  });

  test("a `Box` without `scroll` writes none of these", () => {
    const off = mount(() => Box({ id: "x", children: "c" }), container, { ctx: simCtx });
    const el = document.getElementById("x");
    expect(el).not.toBeNull();
    expect(el?.hasAttribute("role")).toBe(false);
    expect(el?.hasAttribute("tabindex")).toBe(false);
    expect(el?.hasAttribute("aria-label")).toBe(false);
    expect(el?.hasAttribute("aria-labelledby")).toBe(false);
    expect(el?.classList.contains("k-scroll")).toBe(false);
    off();
  });
});

describe("k.ui: scroll type errors", () => {
  test('`scroll="x"` with exactly one of `label` and `labelledBy` is accepted', () => {
    expectTypeOf<{ scroll: "x"; label: string }>().toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; labelledBy: string }>().toMatchTypeOf<BoxP>();
    expect(Box({ id: "x", scroll: "x", label: "Prices" }).nodeType).toBe(1);
  });

  test("`scroll` with `as` is a type error", () => {
    expectTypeOf<{ scroll: "x"; label: string; as: "section" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; labelledBy: string; as: "nav" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test('`scroll="y"` is a type error', () => {
    expectTypeOf<{ scroll: "y"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "both"; label: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test('`scroll="x"` with neither `label` nor `labelledBy` is a type error', () => {
    expectTypeOf<{ scroll: "x" }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });

  test('`scroll="x"` with both `label` and `labelledBy` is a type error', () => {
    expectTypeOf<{ scroll: "x"; label: string; labelledBy: string }>().not.toMatchTypeOf<BoxP>();
    expectTypeOf<{ scroll: "x"; label: string }>().toMatchTypeOf<BoxP>();
    expect(true).toBe(true);
  });
});

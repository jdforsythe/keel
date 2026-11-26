// Properties of compileStyles: determinism, dedupe, order independence, injective class names. Seed 1337.
import { defineTokens } from "@keel/ui";
import type { StyleState } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import type { StyleUsage } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const tokens = defineTokens({
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" }, accent: "#0a5" },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "16px", "1.5": "6px", "x-y": "2px" },
  radius: { 1: "4px" },
  fontSize: { sm: "14px", lg: "24px" },
  breakpoint: { md: "768px", lg: "1024px", hover: "1200px" },
  motion: { fast: "120ms" },
});
const spaceT = fc.constantFrom("0", "1", "2", "3", "1.5", "x-y");
const usage: fc.Arbitrary<StyleUsage> = fc.record(
  {
    props: fc.record(
      {
        p: spaceT,
        mx: spaceT,
        w: spaceT,
        bg: fc.constantFrom("fg", "bg", "accent"),
        fontSize: fc.constantFrom("sm", "lg"),
        direction: fc.constantFrom("row", "column"),
        justify: fc.constantFrom("start", "between"),
      },
      { requiredKeys: [] },
    ),
    breakpoint: fc.constantFrom("md", "lg", "hover"),
    state: fc.constantFrom<StyleState>("hover", "focusVisible", "active", "disabled"),
  },
  { requiredKeys: ["props"] },
);
const usages = fc.array(usage, { maxLength: 8 });
const ruleCount = (css: string, c: string): number => css.split(`.${c}{`).length + css.split(`.${c}:`).length - 2;

describe("compileStyles properties", () => {
  it("is deterministic: equal input gives byte-identical output", () => {
    fc.assert(
      fc.property(usages, (us) => {
        expect(compileStyles({ tokens, usages: us })).toEqual(compileStyles({ tokens, usages: structuredClone(us) }));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("dedupes: every class has exactly one rule, whatever the repetition", () => {
    fc.assert(
      fc.property(usages, (us) => {
        const { classes, css } = compileStyles({ tokens, usages: [...us, ...us] });
        for (const c of new Set(classes.flat())) expect(ruleCount(css, c)).toBe(1);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("css does not depend on usage order", () => {
    fc.assert(
      fc.property(usages, (us) => {
        expect(compileStyles({ tokens, usages: [...us].reverse() }).css).toBe(
          compileStyles({ tokens, usages: us }).css,
        );
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("class names are injective over (prop, token, breakpoint, state)", () => {
    fc.assert(
      fc.property(usage, usage, (a, b) => {
        const { classes } = compileStyles({ tokens, usages: [a, b] });
        const key = (u: StyleUsage, prop: string): string =>
          JSON.stringify([prop, u.props.p, u.breakpoint ?? null, u.state ?? null]);
        const ca = classes[0]?.[0];
        const cb = classes[1]?.[0];
        if (a.props.p !== undefined && b.props.p !== undefined && ca !== undefined && cb !== undefined)
          expect(ca === cb).toBe(key(a, "p") === key(b, "p"));
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("emits readable names for alphanumeric tokens and hashed, CSS-safe names otherwise", () => {
    const { classes, css } = compileStyles({
      tokens,
      usages: [
        { props: { p: "2" } },
        { props: { p: "3" }, breakpoint: "md" },
        { props: { bg: "accent" }, state: "hover" },
        { props: { p: "1.5" } },
        { props: { p: "1" }, breakpoint: "hover" },
      ],
    });
    expect(classes.slice(0, 3)).toEqual([["k-p-2"], ["k-md-p-3"], ["k-hover-bg-accent"]]);
    for (const c of classes.flat()) expect(c).toMatch(/^k-[A-Za-z0-9_-]+$/);
    expect(classes[3]?.[0]).toContain("_");
    expect(classes[4]?.[0]).not.toBe("k-hover-p-1");
    expect(css).toContain(".k-hover-bg-accent:hover{background-color:var(--k-color-accent)}");
  });

  it("orders sections: root, base, breakpoints in token order, then states", () => {
    const { css } = compileStyles({
      tokens,
      usages: [
        { props: { p: "1" }, state: "hover" },
        { props: { p: "1" }, breakpoint: "lg" },
        { props: { p: "1" }, breakpoint: "md" },
        { props: { p: "1" } },
      ],
    });
    const at = (s: string): number => css.indexOf(s);
    expect(at(":root{")).toBe(0);
    expect(at(".k-p-1{")).toBeLessThan(at("(min-width: 768px)"));
    expect(at("(min-width: 768px)")).toBeLessThan(at("(min-width: 1024px)"));
    expect(at("(min-width: 1024px)")).toBeLessThan(at(".k-hover-p-1:hover"));
    expect(css).toContain(
      '@media screen and (prefers-color-scheme: dark){\n:root:not([data-k-scheme="light"]){--k-color-fg:#eee;--k-color-bg:#111}\n}',
    );
  });

  it("flex props imply display:flex", () => {
    const { css } = compileStyles({ tokens, usages: [{ props: { direction: "column", justify: "between" } }] });
    expect(css).toContain(".k-direction-column{display:flex;flex-direction:column}");
    expect(css).toContain(".k-justify-between{display:flex;justify-content:space-between}");
  });

  it("keeps [hidden] hidden over a flex rule, written once in the keel.base layer before the atomic rules", () => {
    const { css } = compileStyles({
      tokens,
      usages: [{ props: { direction: "column" } }, { props: { align: "center" }, state: "hover" }],
    });
    expect(css.split("[hidden]{display:none!important}").length).toBe(2);
    expect(css.indexOf("[hidden]{display:none!important}")).toBeLessThan(css.indexOf(".k-direction-column{"));
    expect(css.indexOf("@layer keel.base{")).toBeLessThan(css.indexOf("[hidden]"));
  });

  it("sizes count padding and border: w and h are border-box", () => {
    const { css } = compileStyles({ tokens, usages: [{ props: { w: "1", h: "2", p: "1" } }] });
    expect(css).toContain("{box-sizing:border-box;width:var(--k-space-1)}");
    expect(css).toContain("{box-sizing:border-box;height:var(--k-space-2)}");
    expect(css).toMatch(/\.k-p-1[^{]*\{padding:var\(--k-space-1\)\}/);
  });

  it("rejects unknown tokens and breakpoints with E1801, unsafe values with E1807", () => {
    const code = (f: () => unknown): unknown => {
      try {
        f();
      } catch (e) {
        return e instanceof Error && "code" in e ? e.code : "no-code";
      }
      return "no-throw";
    };
    expect(code(() => compileStyles({ tokens, usages: [{ props: { p: "16px" } }] }))).toBe("E1801");
    expect(code(() => compileStyles({ tokens, usages: [{ props: { direction: "diagonal" } }] }))).toBe("E1801");
    expect(code(() => compileStyles({ tokens, usages: [{ props: { p: "1" }, breakpoint: "xl" }] }))).toBe("E1801");
    // A value outside its group's form (k.values) is refused by `defineTokens` and by `compileStyles` alike.
    const bad = { space: { 1: "1px}body{color:red" } };
    expect(code(() => defineTokens(bad))).toBe("E1807");
    expect(code(() => compileStyles({ tokens: bad, usages: [] }))).toBe("E1807");
  });
});

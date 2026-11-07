// @vitest-environment happy-dom
// Spec: k.ui, clause "Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once."
import { mount } from "@keel/runtime-dom";
import { Box, Text } from "@keel/ui";
import type { StyleProps, TokenName } from "@keel/ui";
import { compileStyles } from "@keel/ui/css";
import type { StyleUsage } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, countRules, norm, tokens } from "./fixtures.ts";

const propSets = fc.record(
  {
    p: fc.constantFrom("0", "1", "2", "3"),
    m: fc.constantFrom("0", "1", "2", "3"),
    gap: fc.constantFrom("0", "1", "2", "3"),
    bg: fc.constantFrom("fg", "bg", "accent"),
    fg: fc.constantFrom("fg", "bg", "accent"),
    radius: fc.constantFrom("1"),
    fontSize: fc.constantFrom("sm", "md", "lg"),
  },
  { requiredKeys: [] },
);

describe("k.ui: Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once", () => {
  it("Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once", () => {
    fc.assert(
      fc.property(propSets, propSets, (a, b) => {
        const { classes, css } = compileStyles({ tokens, usages: [{ props: a }, { props: { ...a } }, { props: b }] });
        expect(classes[0]).toEqual(classes[1]);
        for (const c of new Set(classes.flat())) expect(countRules(css, c)).toBe(1);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  // Rendered class lists (DOM) of two elements with identical style props; CSS through the public @keel/ui/css API.
  const tn = (...names: TokenName[]) => fc.constantFrom<TokenName[]>(...names);
  const sp = tn("0", "1", "2", "3");
  const colour = tn("fg", "bg", "accent");
  const flat = fc.record(
    {
      p: sp,
      m: sp,
      gap: sp,
      bg: colour,
      fg: colour,
      radius: tn("1"),
      fontSize: tn("sm", "md", "lg"),
    },
    { requiredKeys: [] },
  );
  // `bg` is always present so the class list is never empty.
  type Flat = Partial<Record<"p" | "m" | "gap" | "bg" | "fg" | "radius" | "fontSize", TokenName>>;
  type Resp = { readonly base: TokenName; readonly md: TokenName };
  type Gen = {
    readonly base: Flat;
    readonly md?: Flat;
    readonly hover?: Flat;
    readonly respP?: Resp;
    readonly respGap?: Resp;
  };
  const styleProps: fc.Arbitrary<Gen> = fc.record(
    {
      base: fc.tuple(flat, colour).map(([f, bg]) => ({ ...f, bg })),
      md: flat,
      hover: flat,
      respP: fc.record({ base: sp, md: sp }),
      respGap: fc.record({ base: sp, md: sp }),
    },
    { requiredKeys: ["base"] },
  );

  const toProps = (g: Gen): StyleProps => ({
    ...g.base,
    ...(g.respP === undefined ? {} : { p: g.respP }),
    ...(g.respGap === undefined ? {} : { gap: g.respGap }),
    ...(g.hover === undefined ? {} : { states: { hover: g.hover } }),
  });
  const toUsages = (g: Gen): StyleUsage[] => [
    {
      props: {
        ...g.base,
        ...(g.respP === undefined ? {} : { p: g.respP.base }),
        ...(g.respGap === undefined ? {} : { gap: g.respGap.base }),
      },
    },
    {
      props: {
        ...(g.respP === undefined ? {} : { p: g.respP.md }),
        ...(g.respGap === undefined ? {} : { gap: g.respGap.md }),
      },
      breakpoint: "md",
    },
    ...(g.hover === undefined ? [] : [{ props: g.hover, state: "hover" as const }]),
  ];

  const mountOne = (make: () => Node): { classes: string[]; off: () => void } => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const off = mount(make, root);
    const el = root.firstElementChild;
    if (el === null) throw new Error("nothing rendered");
    return { classes: [...el.classList], off };
  };

  for (const [name, El] of [
    ["Box", Box],
    ["Text", Text],
  ] as const) {
    it(`two ${name} elements with identical style props have identical non-empty rendered class lists, and every class has exactly one CSS rule`, () => {
      fc.assert(
        fc.property(styleProps, (g) => {
          const props = toProps(g);
          const a = mountOne(() => El({ id: "a", ...props }));
          const props2 = toProps(g);
          const b = mountOne(() => El({ id: "b", ...props2 }));
          expect(a.classes.length).toBeGreaterThan(0);
          expect(a.classes).toEqual(b.classes);
          const usages = toUsages(g);
          const { css } = compileStyles({ tokens, usages: [...usages, ...usages] });
          const rules = norm(css)
            .split("}")
            .filter((r) => r !== "");
          expect(new Set(rules).size).toBe(rules.length);
          for (const c of new Set(a.classes)) expect(countRules(css, c)).toBe(1);
          a.off();
          b.off();
          document.body.innerHTML = "";
        }),
        { seed: SEED, numRuns: 100 },
      );
    });
  }
});

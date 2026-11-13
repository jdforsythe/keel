// Spec: k.a11y, Conformance "A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804; at `fontSize` 18.66px and `weight` 700, or under `states.disabled`, it is not."
// Seed: 1337.
// Assumed: tokens are passed as `artifacts: { tokens }` (as ui-e1804 does); `weight` tokens are strings such as "700".
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, one } from "./support.ts";

const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
const lum = (n: number): number => {
  const c = n / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const ratioOf = (a: number, b: number): number => {
  const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
  return (hi + 0.05) / (lo + 0.05);
};
// the gray against white whose ratio is nearest to `target`
const grayAt = (target: number): number => {
  let best = 0;
  for (let n = 0; n < 256; n++) {
    if (Math.abs(ratioOf(n, 255) - target) < Math.abs(ratioOf(best, 255) - target)) best = n;
  }
  return best;
};
const LOW = grayAt(4.4);

const tokens = defineTokens({
  color: { low: hex(LOW), ok: "#111111", bg: "#ffffff" },
  fontSize: { big: "18.66px", sm: "14px" },
  weight: { bold: "700", normal: "400" },
});
const e1804 = (jsx: string, t: unknown = tokens) =>
  check(one(`import { Box, Text } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`), {
    artifacts: { tokens: t },
    types: false,
  }).diagnostics.filter((d) => d.code === "E1804");

describe("k.a11y: E1804 inherits bg from the nearest ancestor in the same component", () => {
  it.skip("fixture gray is 4.4:1 against white", () => {
    expect(ratioOf(LOW, 255)).toBeGreaterThan(4.35);
    expect(ratioOf(LOW, 255)).toBeLessThan(4.45);
  });

  it.skip("A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804", () => {
    const d = e1804('<Box bg="bg"><Box><Text fg="low">x</Text></Box></Box>');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: "E1804", path: "C.tsx" });
  });

  it.skip("the nearest ancestor's bg wins over a farther one", () => {
    const t = defineTokens({ color: { low: hex(LOW), bg: "#ffffff", dark: "#000000" } });
    expect(e1804('<Box bg="dark"><Box bg="bg"><Text fg="low">x</Text></Box></Box>', t)).toHaveLength(1);
    expect(e1804('<Box bg="bg"><Box bg="dark"><Text fg="low">x</Text></Box></Box>', t)).toEqual([]);
  });

  it.skip("at `fontSize` 18.66px and `weight` 700 it is not E1804", () => {
    expect(e1804('<Box bg="bg"><Text fg="low" fontSize="big" weight="bold">x</Text></Box>')).toEqual([]);
  });

  it.skip("at `fontSize` 18.66px and a weight below 700, or 700 at a smaller size, it is E1804", () => {
    expect(e1804('<Box bg="bg"><Text fg="low" fontSize="big" weight="normal">x</Text></Box>')).toHaveLength(1);
    expect(e1804('<Box bg="bg"><Text fg="low" fontSize="sm" weight="bold">x</Text></Box>')).toHaveLength(1);
  });

  it.skip("text without a `fontSize` token is normal size", () => {
    expect(e1804('<Box bg="bg"><Text fg="low" weight="bold">x</Text></Box>')).toHaveLength(1);
  });

  it.skip("under `states.disabled` it is not E1804", () => {
    const jsx = '<Box bg="bg"><Text fg="ok" states={{ disabled: { fg: "low" } }}>x</Text></Box>';
    expect(e1804(jsx)).toEqual([]);
  });

  it.skip("with no `bg` on the element or an ancestor in the component, E1804 does not fire statically (checked at render)", () => {
    expect(e1804('<Box><Text fg="low">x</Text></Box>')).toEqual([]);
  });

  it.skip("for any gray pair, E1804 on an inherited bg fires exactly when the ratio is below 4.5", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        const r = ratioOf(a, b);
        fc.pre(Math.abs(r - 4.5) > 0.01);
        const t = defineTokens({ color: { fg: hex(a), bg: hex(b) } });
        expect(e1804('<Box bg="bg"><Text fg="fg">x</Text></Box>', t).length).toBe(r < 4.5 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

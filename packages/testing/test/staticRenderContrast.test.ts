// @vitest-environment happy-dom
// k.a11y-static: static E1804 agrees with the render check on every nesting of literal style props it judges, and
// reports nothing the render passes.
import { check } from "@keel/check";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const tokens = defineTokens({
  color: { ink: "#111111", ok: "#767676", mid: "#949494", low: "#aaaaaa", paper: "#ffffff", night: "#1a191e" },
  fontSize: { md: "16px", lg: "24px", big: "18.66px" },
  weight: { regular: "400", bold: "700" },
});
type Level = {
  fg?: string | undefined;
  bg?: string | undefined;
  fontSize?: string | undefined;
  weight?: string | undefined;
};
const pick = <T>(xs: readonly T[]) => fc.option(fc.constantFrom(...xs), { nil: undefined });
const level = fc.record(
  {
    fg: pick(["ink", "ok", "mid", "low", "paper", "night"]),
    bg: pick(["paper", "night", "mid"]),
    fontSize: pick(["md", "lg", "big"]),
    weight: pick(["regular", "bold"]),
  },
  { requiredKeys: [] },
);
const defined = (l: Level): Record<string, string> =>
  Object.fromEntries(Object.entries(l).filter((e): e is [string, string] => e[1] !== undefined));
const attrs = (l: Level): string =>
  Object.entries(defined(l))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");

/** Static E1804 count of `<Box ...><Box ...><Text ...>x</Text></Box></Box>`. */
function statics(boxes: readonly Level[], text: Level): number {
  let jsx = `<Text${attrs(text)}>x</Text>`;
  for (const b of [...boxes].reverse()) jsx = `<Box${attrs(b)}>${jsx}</Box>`;
  const source = `import { Box, Text } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`;
  return check([{ path: "modules/m/C.tsx", source }], { artifacts: { tokens }, types: false }).diagnostics.filter(
    (d) => d.code === "E1804" && !/^(?:base|look)\./.test(d.message),
  ).length;
}

/** Whether the same tree fails the render contrast check. */
function renders(boxes: readonly Level[], text: Level): boolean {
  let view = (): Node => Text({ id: "t", ...defined(text), children: "x" });
  boxes.forEach((b, i) => {
    const inner = view;
    view = () => Box({ id: `b${i}`, ...defined(b), children: () => inner() });
  });
  const page = Object.assign(() => view(), { Props: s.object({}) });
  try {
    render(page, { props: {}, artifacts: { tokens } }).dispose();
    return false;
  } catch (e) {
    return Reflect.get(e instanceof Error ? e : {}, "code") === "E1804";
  }
}

describe("k.a11y-static: static E1804 and the render check agree", () => {
  it("for any nesting of literal props, static fires only where render fails, and exactly when a bg is found", () => {
    fc.assert(
      fc.property(fc.array(level, { minLength: 0, maxLength: 3 }), level, (boxes, text) => {
        // `renders` wraps from the innermost outward, so the outermost Box is last.
        const outward = [...boxes].reverse();
        const found = statics(boxes, text);
        const failed = renders(outward, text);
        expect(found).toBeLessThanOrEqual(1);
        if (found === 1) expect(failed).toBe(true);
        const bgFound = text.bg !== undefined || boxes.some((b) => b.bg !== undefined);
        if (bgFound) expect(found === 1).toBe(failed);
      }),
      { seed: 1337, numRuns: 150 },
    );
  });
});

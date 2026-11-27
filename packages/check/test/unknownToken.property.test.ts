// Spec: k.a11y-static Token names: each string literal given to a base element as a token prop, each responsive key
// but `base` and each literal `look` is judged against the project's tokens; with no `tokens.ts` each is E1801 with the
// suffix; with a `tokens.ts` that gives no tokens none is judged.
import { tokenGroups } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const PROPS = Object.keys(tokenGroups);
const GROUPS = [...new Set(Object.values(tokenGroups).flat())];
const NAMES = ["a", "b", "c", "d"] as const;
const tokens = Object.fromEntries([
  ...GROUPS.map((g) => [g, { a: "1px", b: "2px" }] as const),
  ["breakpoint", { md: "768px" }] as const,
  ["look", { a: {} }] as const,
]);
const use = fc.record({
  prop: fc.constantFrom(...PROPS),
  name: fc.constantFrom(...NAMES),
  at: fc.constantFrom("base", "md", "xl"),
  direct: fc.boolean(),
});
const source = (uses: readonly { prop: string; name: string; at: string; direct: boolean }[], look: string): string => {
  const attrs = uses.map((u) => (u.direct ? `${u.prop}="${u.name}"` : `${u.prop}={{ ${u.at}: '${u.name}' }}`));
  return `import { Box } from '@keel/ui'\nexport default function C() { return <Box ${attrs.join(" ")} look="${look}">x</Box> }\n`;
};
const e1801 = (files: { path: string; source: string }[], withTokens: boolean) =>
  check(files, withTokens ? { types: false, artifacts: { tokens } } : { types: false }).diagnostics.filter(
    (d) => d.code === "E1801",
  );

describe("unknownToken", () => {
  it("property: with tokens, one E1801 per literal its groups lack, per key no breakpoint names and per missing look", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(use, { selector: (u) => u.prop, maxLength: 6 }),
        fc.constantFrom(...NAMES),
        (uses, look) => {
          const expected =
            uses.filter((u) => u.name !== "a" && u.name !== "b").length +
            uses.filter((u) => !u.direct && u.at === "xl").length +
            (look === "a" ? 0 : 1);
          expect(e1801([{ path: "C.tsx", source: source(uses, look) }], true)).toHaveLength(expected);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("property: with no tokens.ts every literal, key but base and look is one E1801 ending with the suffix", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(use, { selector: (u) => u.prop, maxLength: 6 }),
        fc.constantFrom(...NAMES),
        (uses, look) => {
          const files = [{ path: "C.tsx", source: source(uses, look) }];
          const d = e1801(files, false);
          expect(d).toHaveLength(uses.length + uses.filter((u) => !u.direct && u.at !== "base").length + 1);
          for (const x of d) expect(x.message.endsWith(": the project has no tokens.ts")).toBe(true);
          expect(e1801([...files, { path: "tokens.ts", source: "throw new Error('x')\n" }], false)).toEqual([]);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});

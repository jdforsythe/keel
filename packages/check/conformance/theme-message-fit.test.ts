// Spec: k.themes, clause "With `color: { ...designTokens.color, text: '#222222' }` in `tokens.ts` and `designTokens.color.ink` `'red'`, the one E1807 is at that spread's `...` with message `color.ink: a named color; write hex or a function form`; a `tokens.ts` that throws `new Error('boom')` is one E1807 at line 1, column 1 with message `tokens.ts throws: boom`; with a color token named by 80 `x`s given a pair in a `print` theme `paper`, the message is at most 89 units and ends `: a print theme takes one value, not a pair`, in compact and in `--format=json`, and an E1817 for an overlay named by 80 `s`s ends `, not in its over`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// Only the E1817 half of the clause is asserted here, through `check()` (its message does not depend on evaluating `tokens.ts`); the E1807 halves are packages/cli/conformance/token-errors-e1807-cli.test.ts.
// Paragraph k.themes Token errors: "E1810's theme message, E1816 and E1817 fit alike: each name in them, the longest first, keeps its first units and `...` until the message is 89 units, so no fixed word is cut."
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, looseTokens, one } from "./support.ts";

const e1817 = (overlay: string) =>
  check(
    one(
      `import { Box, Text } from '@keel/ui'\nexport default function C() { return <Box bg="text"><Text fg="on" bg="${overlay}">x</Text></Box> }\n`,
    ),
    {
      artifacts: {
        tokens: looseTokens({
          color: { card: "#FFFFFF", on: "#FFFFFF", text: "#1a191e" },
          overlay: { [overlay]: { value: "rgb(26 25 30 / 0.6)", over: ["card"] } },
        }),
      },
      types: false,
    },
  ).diagnostics.filter((d) => d.code === "E1817");

describe("k.themes: a message fits 89 units without cutting its fixed words", () => {
  test(
    "an E1817 for an overlay named by 80 `s`s is at most 89 units and ends `, not in its over`",
    () => {
      const d = e1817("s".repeat(80));
      expect(d).toHaveLength(1);
      const m = d[0]?.message ?? "";
      expect(m.length).toBeLessThanOrEqual(89);
      expect(m.endsWith(", not in its over")).toBe(true);
      expect(m).toContain("...");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the length of the overlay's name, the E1817 message is at most 89 units, keeps `sits on` and ends `, not in its over`",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 120 }), (n) => {
          const d = e1817("s".repeat(n));
          expect(d).toHaveLength(1);
          const m = d[0]?.message ?? "";
          expect(m.length).toBeLessThanOrEqual(89);
          expect(m).toContain(" sits on ");
          expect(m.endsWith(", not in its over")).toBe(true);
        }),
        { seed: SEED, numRuns: 15 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

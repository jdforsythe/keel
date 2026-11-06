// Spec: k.ui Conformance 3. Property seed: 1337.
// Assumed: motion tokens are emitted as CSS custom properties whose names contain the token name.
import { compileStyles } from "@keel/ui/css";
import { defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, mediaBlocks, tokens, withoutMedia } from "./fixtures.ts";

describe("k.ui: Under prefers-reduced-motion: reduce every motion token resolves to 0ms", () => {
  it("Under prefers-reduced-motion: reduce every motion token resolves to 0ms", () => {
    const { css } = compileStyles({ tokens, usages: [] });
    const blocks = mediaBlocks(css, "(prefers-reduced-motion:reduce)");
    expect(blocks.length).toBeGreaterThan(0);
    const reduced = blocks.join("");
    expect(reduced).toMatch(/--[\w-]*fast[\w-]*:0ms/);
    expect(reduced).not.toContain("120ms");
    expect(withoutMedia(css)).toMatch(/--[\w-]*fast[\w-]*:120ms/);
  });

  it("holds for any set of motion tokens", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom("fast", "slow", "base", "instant"), { minLength: 1 }),
        fc.integer({ min: 1, max: 2000 }),
        (names, ms) => {
          const motion = Object.fromEntries(names.map((n) => [n, `${ms}ms`]));
          const t = defineTokens({ ...tokens, motion });
          const { css } = compileStyles({ tokens: t, usages: [] });
          const reduced = mediaBlocks(css, "(prefers-reduced-motion:reduce)").join("");
          for (const n of names) expect(reduced).toMatch(new RegExp(`--[\\w-]*${n}[\\w-]*:0ms`));
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});

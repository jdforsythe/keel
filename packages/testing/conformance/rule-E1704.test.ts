// @vitest-environment happy-dom
// Spec: k.testing, Rules "E1704 property failed"
// Seed: 1337.
import { properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SEED, addAny, addClamped, codeOf, messageOf, thrown } from "./fixtures.ts";

describe("k.testing: E1704 property failed", () => {
  it("E1704 a failing property reports E1704 with the seed", async () => {
    const e = await thrown(() => properties(addAny, { runs: 100, seed: SEED }));
    expect(codeOf(e)).toBe("E1704");
    expect(messageOf(e)).toMatch(/^E1704 /);
    expect(messageOf(e)).toContain(`seed ${SEED}`);
  });

  it("E1704 a passing property does not throw", async () => {
    expect(await thrown(() => properties(addClamped, { runs: 100, seed: SEED }))).toBeUndefined();
  });
});

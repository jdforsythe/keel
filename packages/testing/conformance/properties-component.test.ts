// @vitest-environment happy-dom
// k.testing, Properties "`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal."
// Seed: 1337.
import { properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { CartView, SEED } from "./fixtures.ts";

describe("k.testing: properties(component) renders for generated props without throwing", () => {
  it("properties(CartView) resolves for generated props and state", async () => {
    const r = await properties(CartView, { runs: 25, seed: SEED });
    expect(r.runs).toBe(25);
  });

  it("properties(CartView) with the default run count runs 100 renders", async () => {
    expect(await properties(CartView, { seed: SEED })).toMatchObject({ runs: 100, seed: SEED });
  });
});

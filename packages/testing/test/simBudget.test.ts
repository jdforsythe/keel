// Spec: k.drive (Stalls): the run's real-time budget: its default of 300,000 ms from the `simulate` call outside a test,
// the test's timeout less a tenth (at least 50 ms) from the test's start, its validation, and the `none` label list.
import { simulate } from "@keel/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { budgetDeadline } from "../src/internal/budgetDeadline.ts";

const bound = vi.hoisted(() => ({ value: undefined as { timeout: number; startedAt: number } | undefined }));
vi.mock("../unsafe/currentTestBound.ts", () => ({ currentTestBound: () => bound.value }));

const empty = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

afterEach(() => {
  bound.value = undefined;
});

describe("budgetDeadline", () => {
  it("is 300,000 ms from the call outside a test", () => {
    const before = performance.now();
    const at = budgetDeadline(undefined);
    expect(at - before).toBeGreaterThanOrEqual(300_000);
    expect(at - before).toBeLessThan(300_100);
  });

  it("is `budget` ms from the call", () => {
    const before = performance.now();
    expect(budgetDeadline(250) - before).toBeGreaterThanOrEqual(250);
    expect(budgetDeadline(250) - before).toBeLessThan(350);
  });

  it("is the test's timeout less a tenth from the test's start", () => {
    bound.value = { timeout: 10_000, startedAt: performance.timeOrigin + performance.now() - 1_000 };
    const before = performance.now();
    const left = budgetDeadline(undefined) - before;
    expect(left).toBeGreaterThan(7_900);
    expect(left).toBeLessThanOrEqual(8_000);
  });

  it("leaves out at least 50 ms of a short timeout", () => {
    bound.value = { timeout: 200, startedAt: performance.timeOrigin + performance.now() };
    const left = budgetDeadline(undefined) - performance.now();
    expect(left).toBeGreaterThan(100);
    expect(left).toBeLessThanOrEqual(150);
  });

  it("prefers `budget` to the test's timeout", () => {
    bound.value = { timeout: 10_000, startedAt: performance.timeOrigin + performance.now() };
    expect(budgetDeadline(100) - performance.now()).toBeLessThanOrEqual(100);
  });

  it("rejects a budget that is not a positive integer", () => {
    for (const bad of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => budgetDeadline(bad)).toThrow(/schema\.invalid .*positive integer/);
  });
});

describe("simulate budget", () => {
  it("names `none` when nothing is pending", async () => {
    const e = await simulate(
      async ({ ctx }) => {
        for (;;) await ctx.clock.after(1);
      },
      { replay: empty, budget: 80, horizon: 2 ** 40 },
    ).catch((error: unknown) => error);
    expect(String(e).split("\n")[0]).toContain("E1728 the budget ran out with work in flight: none");
  });

  it("rejects an invalid budget before any run", async () => {
    const scenario = vi.fn(async () => {});
    await expect(simulate(scenario, { replay: empty, budget: 0 })).rejects.toThrow("schema.invalid");
    expect(scenario).not.toHaveBeenCalled();
  });
});

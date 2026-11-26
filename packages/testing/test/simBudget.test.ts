// Spec: k.drive (Stalls): the run's real-time budget: its default of 300,000 ms from the `simulate` call outside a test,
// the test's timeout less a tenth (at least 50 ms) from the test's start, its validation, the `none` label list, and a
// budget spent while a failing run is shrunk.
import { setTimeout as wait } from "node:timers/promises";
import { simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { afterEach, describe, expect, it, vi } from "vitest";
import { budgetDeadline } from "../src/internal/budgetDeadline.ts";

const bound = vi.hoisted((): { value: { timeout: number; startedAt: number } | undefined } => ({ value: undefined }));
vi.mock("../src/internal/currentTestBound.ts", () => ({ currentTestBound: () => bound.value }));

const empty = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

afterEach(() => {
  bound.value = undefined;
});

describe("budgetDeadline", () => {
  it("is 300,000 ms from the call outside a test", () => {
    expect(budgetDeadline(undefined, 1_000, 5_000)).toBe(301_000);
  });

  it("is `budget` ms from the call", () => {
    expect(budgetDeadline(250, 1_000, 5_000)).toBe(1_250);
  });

  it("is the test's timeout less a tenth from the test's start", () => {
    bound.value = { timeout: fixedTime(10_000), startedAt: 4_000 };
    // The call is 1,000 ms after the test's start, which is at 0 on the clock of `called`.
    expect(budgetDeadline(undefined, 1_000, 5_000)).toBe(9_000);
  });

  it("leaves out at least 50 ms of a short timeout", () => {
    bound.value = { timeout: fixedTime(200), startedAt: 5_000 };
    expect(budgetDeadline(undefined, 1_000, 5_000)).toBe(1_150);
  });

  it("prefers `budget` to the test's timeout", () => {
    bound.value = { timeout: fixedTime(10_000), startedAt: 5_000 };
    expect(budgetDeadline(100, 1_000, 5_000)).toBe(1_100);
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

  it("throws the failure found before a shrink the budget stopped, not the budget's E1728", async () => {
    let calls = 0;
    const e = await simulate(
      async ({ schedule }) => {
        calls += 1;
        // Real time each run takes, so the shrinking outlasts the budget.
        await wait(fixedTime(150));
        if (schedule.net.length > 2) throw new Error("more than two net steps");
      },
      { runs: 50, seed: 3, budget: fixedTime(1_500), law: false },
    ).catch((error: unknown) => error);
    const [head = "", json = ""] = String(e).split("\n");
    expect(head).toContain("E1704 simulate: more than two net steps");
    expect(head).toContain("shrunk until the budget ran out");
    expect(head).not.toContain("E1728");
    const shrunk: unknown = JSON.parse(json);
    expect(shrunk).toMatchObject({ schedule: { net: expect.any(Array) } });
    const net: unknown = Reflect.get(Reflect.get(Object(shrunk), "schedule"), "net");
    expect(Array.isArray(net) && net.length > 2).toBe(true);
    // The runs after the spent budget are not run: fast-check's remaining candidates return at once.
    expect(calls).toBeLessThan(20);
  }, 20_000);

  it("rejects an invalid budget before any run", async () => {
    const scenario = vi.fn(async () => {});
    await expect(simulate(scenario, { replay: empty, budget: 0 })).rejects.toThrow("schema.invalid");
    expect(scenario).not.toHaveBeenCalled();
  });
});

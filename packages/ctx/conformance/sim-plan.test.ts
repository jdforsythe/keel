// Spec: k.sim, clause "A registered capability with a `plan` schema receives `plans[name]` in its sim factory; a plan step that fails its schema, or `schedule` on a real ctx, throws E1604."
// Seed: 1337.
import { createCtx, register } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
let counter = 0;
const fresh = (prefix: string) => `${prefix}.${counter++}`;

interface Probe {
  readonly plan: readonly number[];
  readonly seed: number;
}

// A capability whose sim factory reports what it received.
function probe(name: string) {
  return register<Probe>(name, {
    real: () => ({ plan: [], seed: 0 }),
    shell: () => ({ plan: [], seed: 0 }),
    sim: ({ seed, plan }) => ({ plan, seed }),
    plan: s.int(),
  });
}

const schedule = (plans: Record<string, number[] | string[]>) => ({ net: [], storage: [], offline: [], plans });

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);

// The failure may surface at createCtx or at first access of the capability; both count.
function thrownCode(make: () => void): unknown {
  try {
    make();
    return undefined;
  } catch (e) {
    return codeOf(e);
  }
}

describe("k.sim: plans", () => {
  test("a registered capability with a `plan` schema receives `plans[name]` in its sim factory", () => {
    const name = fresh("sim.plan.probe");
    const access = probe(name);
    const ctx = createCtx({ mode: "sim", seed: SEED, schedule: schedule({ [name]: [3, 1, 4] }) });
    expect(access(ctx).plan).toEqual([3, 1, 4]);
  });

  test("the plan defaults to `[]` when `plans` has no entry for the name", () => {
    const name = fresh("sim.plan.default");
    const access = probe(name);
    const ctx = createCtx({ mode: "sim", seed: SEED, schedule: schedule({}) });
    expect(access(ctx).plan).toEqual([]);
  });

  test("the plan defaults to `[]` when the ctx has no schedule", () => {
    const name = fresh("sim.plan.noschedule");
    const access = probe(name);
    expect(access(createCtx({ mode: "sim", seed: SEED })).plan).toEqual([]);
  });

  test("property: any plan of steps that parse reaches the sim factory unchanged", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1000, max: 1000 }), { maxLength: 10 }), (steps) => {
        const name = fresh("sim.plan.prop");
        const access = probe(name);
        const ctx = createCtx({ mode: "sim", seed: SEED, schedule: schedule({ [name]: steps }) });
        expect(access(ctx).plan).toEqual(steps);
      }),
      { seed: SEED },
    );
  });

  test("a plan step that fails its schema throws E1604", () => {
    const name = fresh("sim.plan.bad");
    const access = probe(name);
    const code = thrownCode(() => {
      const ctx = createCtx({ mode: "sim", seed: SEED, schedule: schedule({ [name]: ["not an int"] }) });
      access(ctx);
    });
    expect(code).toBe("E1604");
  });

  test("`schedule` on a real ctx throws E1604", () => {
    expect(thrownCode(() => createCtx({ mode: "real", seed: SEED, schedule: schedule({}) }))).toBe("E1604");
  });

  test("`schedule` on a shell ctx throws E1604", () => {
    expect(thrownCode(() => createCtx({ mode: "shell", seed: SEED, schedule: schedule({}) }))).toBe("E1604");
  });

  test("a `schedule` that fails `Schedule` throws E1604", () => {
    // JSON.parse returns the untyped value a caller would read from a file.
    const bad = JSON.parse('{"net":[{"delay":60001,"fault":"none"}],"storage":[],"offline":[],"plans":{}}');
    expect(thrownCode(() => createCtx({ mode: "sim", seed: SEED, schedule: bad }))).toBe("E1604");
    const badFault = JSON.parse('{"net":[{"delay":0,"fault":"slow"}],"storage":[],"offline":[],"plans":{}}');
    expect(thrownCode(() => createCtx({ mode: "sim", seed: SEED, schedule: badFault }))).toBe("E1604");
  });
});

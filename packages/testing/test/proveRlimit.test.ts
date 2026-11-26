// An `rlimit` above what Z3 accepts as a resource limit is refused with a code, as a non-positive one is (k.prove).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const LONG = fixedTime(120_000);

const counter = (() => {
  let out: Transaction<unknown, unknown> | undefined;
  scope(() => {
    const st = store(s.object({ n: s.int() }), { n: 0 }, { id: "rl1" });
    invariant(st, (state: { n: number }) => state.n >= 0);
    out = transaction(st, "rl1.reset", s.object({}), () => ({ n: 0 }));
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();

const outcome = async (rlimit: number): Promise<{ resolved?: unknown; message?: string; code?: unknown }> => {
  try {
    return { resolved: await prove([counter], { rlimit }) };
  } catch (e) {
    return e instanceof Error ? { message: e.message, code: Reflect.get(e, "code") } : { message: String(e) };
  }
};

describe("prove rlimit range", () => {
  it(
    "the largest Z3 resource limit, 2^32 - 1, is accepted",
    async () => {
      expect((await outcome(2 ** 32 - 1)).resolved).toEqual({ proven: ["rl1.reset"], z3: "5.3.3" });
    },
    LONG,
  );

  // Z3 takes `rlimit` as an unsigned 32-bit value, so a larger one is refused before the solver is asked.
  it(
    "an rlimit of 2^32 or more rejects E1710 before the solver is asked",
    async () => {
      for (const rlimit of [2 ** 32, 2 ** 53 - 1]) expect((await outcome(rlimit)).code).toBe("E1710");
    },
    LONG,
  );
});

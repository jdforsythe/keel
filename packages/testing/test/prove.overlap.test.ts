// Z3 evaluates the query prove built, whatever else enters Z3 on the main thread while its solver thread starts, and
// prove calls that overlap take turns (k.prove). The z3-solver module is wrapped so a test can run main-thread Z3 calls
// at the moment an evaluation has started and its thread has not yet read the query: the moment at which Z3's own
// bookkeeping for the previous evaluation, or another prove call opening a context, can run.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it, vi } from "vitest";

const LONG = fixedTime(120_000);

const z3 = vi.hoisted((): { afterStart: (() => void) | undefined; enter: () => void } => ({
  afterStart: undefined,
  enter: () => undefined,
}));

vi.mock("z3-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("z3-solver")>();
  return {
    ...actual,
    init: async (...args: Parameters<typeof actual.init>) => {
      const api = await actual.init(...args);
      const { Z3 } = api;
      // What a prove call does around each check: a config, a context, and their release, all on the main thread.
      z3.enter = () => {
        const config = Z3.mk_config();
        const context = Z3.mk_context(config);
        Z3.del_config(config);
        Z3.del_context(context);
      };
      const start: (run: () => void) => Promise<unknown> = api.em.async_call;
      api.em.async_call = (run: () => void) => {
        const pending = start(run);
        z3.afterStart?.();
        return pending;
      };
      return api;
    },
  };
});

const built = (() => {
  let out: { holds: Transaction<unknown, unknown>; breaks: Transaction<unknown, unknown> } | undefined;
  scope(
    () => {
      const st = store(
        s.object({ xs: s.array(s.int({ min: 0 })), n: s.int({ min: 0 }) }),
        { xs: [], n: 0 },
        { id: "po.list" },
      );
      invariant(st, (state) => state.n <= 14);
      const by = s.object({ id: s.int({ min: 1, max: 9 }) });
      out = {
        holds: transaction(st, "po.holds", by, (state) => ({ xs: state.xs, n: state.n < 14 ? state.n + 1 : 14 })),
        breaks: transaction(st, "po.breaks", by, (state, p) => ({ xs: state.xs, n: state.n + p.id })),
      };
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out;
})();

/** `proven`, or the code and message prove rejected with (an E1716 message carries its counterexample). */
const outcome = async (t: Transaction<unknown, unknown>): Promise<string> => {
  try {
    await prove([t]);
    return "proven";
  } catch (e) {
    return e instanceof Error ? `${String(Reflect.get(e, "code"))} ${e.message}` : String(e);
  }
};

/** What each transaction's proof returns with nothing else running. */
const alone = async (): Promise<{ holds: string; breaks: string }> => {
  z3.afterStart = undefined;
  const holds = await outcome(built.holds);
  const breaks = await outcome(built.breaks);
  expect(holds).toBe("proven");
  expect(breaks).toMatch(/^E1716 po\.breaks breaks the schema or an invariant from this state/);
  return { holds, breaks };
};

describe("prove: overlap", () => {
  it(
    "a main-thread Z3 call made as each query starts changes neither the verdict nor the counterexample",
    async () => {
      const expected = await alone();
      let entered = 0;
      z3.afterStart = () => {
        entered += 1;
        z3.enter();
      };
      try {
        expect(await outcome(built.breaks)).toBe(expected.breaks);
        expect(await outcome(built.holds)).toBe(expected.holds);
      } finally {
        z3.afterStart = undefined;
      }
      expect(entered).toBeGreaterThan(1);
    },
    LONG,
  );

  it(
    "calls started together each return what they return alone",
    async () => {
      const expected = await alone();
      const together = await Promise.all([outcome(built.breaks), outcome(built.holds), outcome(built.breaks)]);
      expect(together).toEqual([expected.breaks, expected.holds, expected.breaks]);
    },
    LONG,
  );

  it(
    "a call started while an abandoned one is mid-query returns what it returns alone, and so does the abandoned one",
    async () => {
      const expected = await alone();
      const abandoned = outcome(built.breaks);
      // The second call starts on the main thread the moment the first one's query has started in Z3.
      const second = await new Promise<string>((resolve) => {
        z3.afterStart = () => {
          z3.afterStart = undefined;
          resolve(outcome(built.holds));
        };
      });
      expect(second).toBe(expected.holds);
      expect(await abandoned).toBe(expected.breaks);
    },
    LONG,
  );
});

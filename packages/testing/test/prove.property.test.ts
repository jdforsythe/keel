// For generated stores in the fragment, prove's verdict agrees with explore on a bounded copy: when explore finds a
// broken state, prove does not pass, and when prove passes, explore finds none. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 300_000;
const MAX = 8;
type State = { n: number };

/** A function whose source holds the generated constants as literals, so `prove` reads them. */
const compiled = <F>(params: readonly string[], body: string, check: (f: unknown) => f is F): F => {
  const f: unknown = new Function(...params, body);
  if (!check(f)) throw new Error("fixture: not a function");
  return f;
};
const isCheck = (f: unknown): f is (state: State) => boolean => typeof f === "function";
const isStep = (f: unknown): f is (state: State) => State => typeof f === "function";

const op = fc.oneof(
  fc.record({ kind: fc.constant("add" as const), k: fc.integer({ min: -3, max: 3 }) }),
  fc.record({
    kind: fc.constant("ite" as const),
    k: fc.integer({ min: 0, max: MAX }),
    j: fc.integer({ min: 1, max: 3 }),
  }),
);
const inv = fc.record({ rel: fc.constantFrom(">=", "<=", "!=="), a: fc.integer({ min: 0, max: MAX }) });
const shape = fc.record({
  init: fc.integer({ min: 0, max: MAX }),
  inv,
  ops: fc.array(op, { minLength: 1, maxLength: 2 }),
});

let seq = 0;
const build = (c: fc.RecordValue<typeof shape extends fc.Arbitrary<infer R> ? R : never>) => {
  seq += 1;
  const id = `pp${seq}`;
  let out: Transaction<State, unknown>[] = [];
  scope(() => {
    const st = store(s.object({ n: s.int({ min: 0, max: MAX }) }), { n: c.init }, { id });
    const check = compiled<(state: State) => boolean>(["state"], `return state.n ${c.inv.rel} ${c.inv.a};`, isCheck);
    invariant(st, check);
    out = c.ops.map((o, i) => {
      const body =
        o.kind === "add"
          ? `return { n: state.n + ${o.k} };`
          : `return { n: state.n > ${o.k} ? state.n - ${o.j} : state.n + ${o.j} };`;
      const fn = compiled<(state: State) => State>(["state"], body, isStep);
      return transaction(st, `${id}.t${i}`, s.object({}), fn);
    });
  });
  return out;
};
const codeOf = async (run: () => unknown): Promise<string> => {
  try {
    await run();
    return "ok";
  } catch (e) {
    return e instanceof Error ? String(Reflect.get(e, "code")) : "thrown";
  }
};

describe("prove agrees with explore", () => {
  it(
    "explore's broken state means prove does not pass; prove passing means explore passes",
    async () => {
      await fc.assert(
        fc.asyncProperty(shape, async (c) => {
          const txs = build(c);
          const explored = await codeOf(() => explore(txs));
          const proved = await codeOf(() => prove(txs));
          expect(["ok", "E1708"]).toContain(explored);
          expect(["ok", "E1716"]).toContain(proved);
          if (explored === "E1708") expect(proved).toBe("E1716");
          if (proved === "ok") expect(explored).toBe("ok");
        }),
        { seed: SEED, numRuns: 40 },
      );
    },
    LONG,
  );
});

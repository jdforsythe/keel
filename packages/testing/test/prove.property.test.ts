// For generated stores in the fragment, prove's verdict agrees with explore on a bounded copy: when explore finds a
// broken state, prove does not pass, and when prove passes, explore finds none. The generated transactions read an
// index and a map key (past what they hold, against undefined) and sum past 2^53. Seed 1337.
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import { prove } from "@keel/testing/prove";
import { fixedTime } from "@keel/tooling/test-time";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = fixedTime(300_000);
const MAX = 8;
type State = { xs: boolean[]; m: Record<string, number>; on: boolean; n: number };
const State = s.object({
  xs: s.array(s.boolean()),
  m: s.record(s.int({ min: 0, max: 1 })),
  on: s.boolean(),
  n: s.int({ min: 0, max: MAX }),
});

/** A function whose source holds the generated constants as literals, so `prove` reads them. */
const compiled = <F>(params: readonly string[], body: string, check: (f: unknown) => f is F): F => {
  const f: unknown = new Function(...params, body);
  if (!check(f)) throw new Error("fixture: not a function");
  return f;
};
const isCheck = (f: unknown): f is (state: State) => boolean => typeof f === "function";
const isStep = (f: unknown): f is (state: State, p: unknown) => State => typeof f === "function";

const op = fc.oneof(
  fc.record({ kind: fc.constant("add" as const), k: fc.integer({ min: -3, max: 3 }) }),
  fc.record({
    kind: fc.constant("ite" as const),
    k: fc.integer({ min: 0, max: MAX }),
    j: fc.integer({ min: 1, max: 3 }),
  }),
  // An index read past the length into a required field (undefined at run time).
  fc.record({ kind: fc.constant("top" as const) }),
  // An index read and a map read compared with undefined.
  fc.record({ kind: fc.constant("idx" as const), k: fc.integer({ min: -3, max: 3 }) }),
  fc.record({ kind: fc.constant("key" as const), k: fc.integer({ min: -3, max: 3 }) }),
  // An intermediate past 2^53, where floating point rounds.
  fc.record({ kind: fc.constant("big" as const) }),
);
type Op = typeof op extends fc.Arbitrary<infer R> ? R : never;
const inv = fc.record({ rel: fc.constantFrom(">=", "<=", "!=="), a: fc.integer({ min: 0, max: MAX }) });
const shape = fc.record({
  init: fc.integer({ min: 0, max: MAX }),
  inv,
  ops: fc.array(op, { minLength: 1, maxLength: 2 }),
});

const BIG = Number.MAX_SAFE_INTEGER;
const I = s.object({ i: s.int() });
const K = s.object({ k: s.enum(["a", "b"]) });
/** Each generated op: its body, payload schema, and the payloads `explore` runs. */
const ofOp = (o: Op): { body: string; schema: Schema<unknown>; payloads: readonly unknown[] } => {
  const idx = [-1, 0, 1, 2].map((i) => ({ i }));
  switch (o.kind) {
    case "add":
      return { body: `return { ...state, n: state.n + ${o.k} };`, schema: s.object({}), payloads: [{}] };
    case "ite":
      return {
        body: `return { ...state, n: state.n > ${o.k} ? state.n - ${o.j} : state.n + ${o.j} };`,
        schema: s.object({}),
        payloads: [{}],
      };
    case "top":
      return { body: "return { ...state, on: state.xs[p.i] };", schema: I, payloads: idx };
    case "idx":
      return {
        body: `return { ...state, n: state.xs[p.i] === undefined ? state.n + ${o.k} : state.n };`,
        schema: I,
        payloads: idx,
      };
    case "key":
      return {
        body: `return { ...state, n: state.m[p.k] !== undefined ? state.n + ${o.k} : state.n };`,
        schema: K,
        payloads: [{ k: "a" }, { k: "b" }],
      };
    default:
      return {
        body: "return { ...state, n: state.n + p.x - p.x };",
        schema: s.object({ x: s.int({ min: 0 }) }),
        payloads: [{ x: 0 }, { x: BIG }],
      };
  }
};

let seq = 0;
const build = (c: fc.RecordValue<typeof shape extends fc.Arbitrary<infer R> ? R : never>) => {
  seq += 1;
  const id = `pp${seq}`;
  let txs: Transaction<State, unknown>[] = [];
  const payloads: Record<string, readonly unknown[]> = {};
  scope(
    () => {
      const st = store(State, { xs: [], m: {}, on: false, n: c.init }, { id });
      const check = compiled<(state: State) => boolean>(["state"], `return state.n ${c.inv.rel} ${c.inv.a};`, isCheck);
      invariant(st, check);
      // Two that fill the array and the map, so explore reaches reads inside them too.
      const push = transaction(st, `${id}.push`, s.object({ v: s.boolean() }), (state, p) => ({
        ...state,
        xs: state.xs.length < 2 ? [...state.xs, p.v] : state.xs,
      }));
      const put = transaction(
        st,
        `${id}.put`,
        s.object({ k: s.enum(["a", "b"]), v: s.int({ min: 0, max: 1 }) }),
        (state, p) => ({
          ...state,
          m: { ...state.m, [p.k]: p.v },
        }),
      );
      payloads[push.name] = [{ v: true }, { v: false }];
      payloads[put.name] = [
        { k: "a", v: 0 },
        { k: "a", v: 1 },
        { k: "b", v: 0 },
      ];
      txs = [push, put];
      for (const [i, o] of c.ops.entries()) {
        const { body, schema, payloads: ps } = ofOp(o);
        const t = transaction(st, `${id}.t${i}`, schema, compiled(["state", "p"], body, isStep));
        payloads[t.name] = ps;
        txs.push(t);
      }
    },
    { detached: true },
  );
  return { txs, payloads };
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
          const { txs, payloads } = build(c);
          const explored = await codeOf(() => explore(txs, { payloads }));
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

// The fragment's constructs one at a time (k.prove Fragment, Sorts): each store proves, or rejects with the code shown.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { describe, expect, it } from "vitest";

const LONG = 120_000;
let seq = 0;
const inScope = <R>(mk: (id: string) => R): R => {
  seq += 1;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(`pf${seq}`) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};
const outcome = async <T>(txs: readonly Transaction<T, unknown>[]): Promise<string> => {
  try {
    await prove(txs);
    return "proven";
  } catch (e) {
    return e instanceof Error ? `${String(Reflect.get(e, "code"))} ${e.message}` : String(e);
  }
};

describe("prove: fragment", () => {
  it(
    "if/else, const and return in a block body",
    async () => {
      const t = inScope((id) => {
        const st = store(s.object({ n: s.int({ min: 0, max: 10 }) }), { n: 0 }, { id });
        invariant(st, (state) => state.n <= 10);
        return transaction(st, `${id}.step`, s.object({ by: s.int({ min: 1, max: 3 }) }), (state, p) => {
          const next = state.n + p.by;
          if (next > 10) {
            return state;
            // biome-ignore lint/style/noUselessElse: the else branch is the construct under test
          } else return { n: next };
        });
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "find returns the first match, or undefined",
    async () => {
      const t = inScope((id) => {
        const Item = s.object({ id: s.string(), n: s.int({ min: 0 }) });
        const st = store(s.object({ items: s.array(Item), last: s.int({ min: 0 }) }), { items: [], last: 0 }, { id });
        invariant(st, (state) => state.last >= 0);
        return transaction(st, `${id}.pick`, s.object({ id: s.string() }), (state, p) => {
          const hit = state.items.find((x) => x.id === p.id);
          return hit === undefined ? state : { ...state, last: hit.n };
        });
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "an s.record map read as m[k] and written as { ...m, [k]: v }",
    async () => {
      const t = inScope((id) => {
        const st = store(s.object({ counts: s.record(s.int({ min: 0 })) }), { counts: {} }, { id });
        invariant(st, () => true);
        return transaction(st, `${id}.set`, s.object({ k: s.enum(["a", "b"]), v: s.int({ min: 0 }) }), (state, p) => {
          const c = state.counts[p.k];
          return c === undefined ? { counts: { ...state.counts, [p.k]: p.v } } : state;
        });
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "optional and nullable fields, enums and literals compare by value",
    async () => {
      const t = inScope((id) => {
        const st = store(
          s.object({ mode: s.enum(["a", "b"]), note: s.string().optional(), owner: s.string().nullable() }),
          { mode: "a", owner: null },
          { id },
        );
        invariant(st, (state) => state.mode === "a" || state.owner !== null || state.note !== undefined);
        return transaction(st, `${id}.claim`, s.object({ who: s.string(), mode: s.enum(["b"]) }), (state, p) =>
          state.note === undefined ? { ...state, mode: p.mode, owner: p.who } : { ...state, owner: null },
        );
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "a non-integer s.number is compared and copied; * by a literal on integers",
    async () => {
      const t = inScope((id) => {
        const st = store(s.object({ x: s.number({ min: 0 }), n: s.int({ min: 0, max: 99 }) }), { x: 0, n: 0 }, { id });
        invariant(st, (state) => state.x >= 0 && state.n >= 0);
        return transaction(st, `${id}.put`, s.object({ x: s.number() }), (state, p) =>
          p.x >= 0 ? { x: p.x, n: state.n < 50 ? state.n * 2 : state.n } : state,
        );
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "concatenating two spreads keeps every item",
    async () => {
      const t = inScope((id) => {
        const st = store(
          s.object({ a: s.array(s.int({ min: 0 })), b: s.array(s.int({ min: 0 })) }),
          { a: [], b: [] },
          { id },
        );
        invariant(st, (state) => state.a.every((x) => x >= 0) && state.b.every((x) => x >= 0));
        return transaction(st, `${id}.merge`, s.object({}), (state) => ({ a: [...state.a, ...state.b], b: [] }));
      });
      expect(await outcome([t])).toBe("proven");
    },
    LONG,
  );

  it(
    "a counterexample names the transaction, the state and the payload",
    async () => {
      const t = inScope((id) => {
        const st = store(s.object({ on: s.boolean(), n: s.int({ min: 0, max: 3 }) }), { on: false, n: 0 }, { id });
        invariant(st, (state) => !state.on || state.n > 0);
        return transaction(st, `${id}.flip`, s.object({}), (state) => ({ ...state, on: !state.on }));
      });
      expect(await outcome([t])).toBe(
        `E1716 ${t.name} breaks the schema or an invariant from this state; it may be unreachable\n{"transaction":"${t.name}","state":{"on":false,"n":0},"payload":{}}`,
      );
    },
    LONG,
  );

  it(
    "let, a loop, a free identifier, a Set used otherwise, string + and a union are E1715",
    async () => {
      const txs = inScope((id) => {
        const st = store(
          s.object({ n: s.int(), name: s.string(), ids: s.array(s.string()) }),
          { n: 0, name: "", ids: [] },
          { id },
        );
        invariant(st, () => true);
        const LIMIT = 3;
        const none = s.object({});
        const wide = store(
          s.object({ v: s.union("k", [s.object({ k: s.literal("a") })]) }),
          { v: { k: "a" } },
          { id: `${id}.w` },
        );
        const all = [
          transaction(st, `${id}.let`, none, (state) => {
            let n = state.n;
            n = n + 1;
            return { ...state, n };
          }),
          transaction(st, `${id}.loop`, none, (state) => {
            for (const x of state.ids) if (x === "") return state;
            return state;
          }),
          transaction(st, `${id}.free`, none, (state) => ({ ...state, n: LIMIT })),
          transaction(st, `${id}.size`, none, (state) => ({ ...state, n: new Set(state.ids).size })),
          transaction(st, `${id}.concat`, none, (state) => ({ ...state, name: `${state.name}!` })),
        ];
        const w = transaction(wide, `${id}.wide`, none, (state) => state);
        return [...all.map((t) => () => outcome([t])), () => outcome([w])];
      });
      const got = [];
      for (const run of txs) got.push((await run()).split(" ")[0]);
      expect(got).toEqual(["E1715", "E1715", "E1715", "E1715", "E1715", "E1715"]);
    },
    LONG,
  );
});

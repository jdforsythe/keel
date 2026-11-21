// Spec: k.prove, Conformance "A store `{ n: s.int({ min: 0, max: 9 }) }` with invariant `n >= 0`, `inc` (`n < 9 ? n + 1 : n`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`."
// Spec: k.prove, Sorts "`s.int` as integers within its bounds, state and payload values also within ±(2^53 − 1)"
// Spec: k.prove, Sorts "A post-state integer is held within ±(2^53 − 1) too, as `s.int` parses it: `n + 1` with no bound and no guard is a counterexample at 2^53 − 1."
// Spec: k.prove, Conformance "With no `max`, `inc` as `n + 1` rejects E1716 with state `{ n: 9007199254740991 }` and the safe-range line, and `n: a.length + 1` over a state array `a` proves."
// Spec: k.prove, Sorts "a state or payload array holding at most 2^32 − 1 items"
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;

let seq = 0;
/** Build a fixture inside a scope (E1203) under ids unique to this call. */
const build = <R>(mk: (id: string) => R): R => {
  seq += 1;
  const id = `pv${seq}`;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(id) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));
/** What the promise rejected with, or undefined when it resolved. */
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};
/** The JSON on the line after the first line of the message. */
const jsonLine = (e: unknown): unknown => {
  const line = messageOf(e).split("\n")[1];
  if (line === undefined) throw new Error("fixture: no line after the first line of the message");
  return JSON.parse(line);
};
/** Every value stored under `key` anywhere in `value`. */
const valuesAt = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((v) => valuesAt(v, key));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === key ? [v, ...valuesAt(v, key)] : valuesAt(v, key)));
};

const counter = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  const inc = transaction(st, `${id}.inc`, none, (state) => ({ n: state.n < 9 ? state.n + 1 : state.n }));
  const dec = transaction(st, `${id}.dec`, none, (state) => ({ n: state.n > 0 ? state.n - 1 : state.n }));
  const bad = transaction(st, `${id}.bad`, none, (state) => ({ n: state.n - 1 }));
  return { inc, dec, bad };
};
// `n - by` for by = 1..4, each on its own store
const lower = (id: string) => {
  const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.count` });
  invariant(st, (state) => state.n >= 0);
  const none = s.object({});
  return [
    transaction(st, `${id}.by1`, none, (state) => ({ n: state.n - 1 })),
    transaction(st, `${id}.by2`, none, (state) => ({ n: state.n - 2 })),
    transaction(st, `${id}.by3`, none, (state) => ({ n: state.n - 3 })),
    transaction(st, `${id}.by4`, none, (state) => ({ n: state.n - 4 })),
  ];
};

describe("k.prove: counter", () => {
  it(
    "a store { n: s.int({ min: 0, max: 9 }) } with invariant n >= 0, inc (n < 9 ? n + 1 : n) and dec proves",
    async () => {
      const { inc, dec } = build(counter);
      expect(await rejection(() => prove([inc, dec]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "with dec as n - 1 the proof rejects E1716 with state { n: 0 }",
    async () => {
      const { inc, bad } = build(counter);
      const e = await rejection(() => prove([inc, bad]));
      expect(codeOf(e)).toBe("E1716");
      expect(valuesAt(jsonLine(e), "n")).toContain(0);
    },
    LONG,
  );

  it(
    "n - by rejects E1716 for every by in 1..4, and the state's n is below by",
    async () => {
      const txs = build(lower);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (i) => {
          const t = txs[i];
          if (t === undefined) throw new Error("fixture: no transaction");
          const e = await rejection(() => prove([t]));
          expect(codeOf(e)).toBe("E1716");
          const ns = valuesAt(jsonLine(e), "n").filter((v): v is number => typeof v === "number");
          expect(ns.length).toBeGreaterThan(0);
          expect(ns.some((n) => n >= 0 && n < i + 1)).toBe(true);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );
});

const MAX = 9007199254740991;
const safeLine = (tx: string) => `${tx} leaves the safe integer range from this state; bound the schema or guard it`;
const firstLine = (e: unknown): string => messageOf(e).split("\n")[0] ?? "";

const bounded = (id: string) => {
  const none = s.object({ n: s.int() });
  const up = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.up` });
  invariant(up, (state) => state.n <= 9007199254740991);
  const upSet = transaction(up, `${id}.upSet`, none, (_state, p) => ({ n: p.n }));
  const upTight = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.upTight` });
  invariant(upTight, (state) => state.n <= 9007199254740990);
  const upTightSet = transaction(upTight, `${id}.upTightSet`, none, (_state, p) => ({ n: p.n }));
  const down = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.down` });
  invariant(down, (state) => state.n >= -9007199254740991);
  const downSet = transaction(down, `${id}.downSet`, none, (_state, p) => ({ n: p.n }));
  const downTight = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.downTight` });
  invariant(downTight, (state) => state.n >= -9007199254740990);
  const downTightSet = transaction(downTight, `${id}.downTightSet`, none, (_state, p) => ({ n: p.n }));
  const st = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.state` });
  invariant(st, (state) => state.n <= 9007199254740992);
  const jump = transaction(st, `${id}.jump`, s.object({}), (state) => ({
    n: state.n === 9007199254740992 ? 18014398509481984 : state.n,
  }));
  return { upSet, upTightSet, downSet, downTightSet, jump };
};

describe("k.prove: int sort bound", () => {
  it(
    "payload values of s.int are within ±(2^53 − 1): the bound proves and one inside it rejects with the extreme value",
    async () => {
      const f = build(bounded);
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (positive) => {
          const [ok, tight] = positive ? [f.upSet, f.upTightSet] : [f.downSet, f.downTightSet];
          expect(await rejection(() => prove([ok]))).toBeUndefined();
          const e = await rejection(() => prove([tight]));
          expect(codeOf(e)).toBe("E1716");
          const ns = valuesAt(jsonLine(e), "n");
          expect(ns).toContain(positive ? MAX : -MAX);
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    LONG,
  );

  it(
    "state values of s.int are also within ±(2^53 − 1): a state at 2^53 is not considered",
    async () => {
      const { jump } = build(bounded);
      expect(await rejection(() => prove([jump]))).toBeUndefined();
    },
    LONG,
  );
});

const none = s.object({});
/** A run of `prove` over one transaction, the transaction built once. */
const proofOf = (t: Parameters<typeof prove>[0][number]) => () => prove([t]);

describe("k.prove: post-state integers within the safe range", () => {
  it(
    "n + 1 on { n: s.int({ min: 0 }) } rejects E1716 with state { n: 9007199254740991 } and the safe-range line",
    async () => {
      const t = build((id) => {
        const st = store(s.object({ n: s.int({ min: 0 }) }), { n: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, none, (state) => ({ n: state.n + 1 }));
      });
      const e = await rejection(() => prove([t]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(isRecord(json) ? json.state : undefined).toEqual({ n: MAX });
      expect(firstLine(e)).toBe(safeLine(isRecord(json) ? String(json.transaction) : ""));
    },
    LONG,
  );

  it(
    "n - 1 on { n: s.int({ max: 0 }) } rejects E1716 with n at -9007199254740991",
    async () => {
      const t = build((id) => {
        const st = store(s.object({ n: s.int({ max: 0 }) }), { n: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, none, (state) => ({ n: state.n - 1 }));
      });
      const e = await rejection(() => prove([t]));
      expect(codeOf(e)).toBe("E1716");
      expect(valuesAt(jsonLine(e), "n")).toContain(-MAX);
    },
    LONG,
  );

  it(
    "an integer at the edge in an object field, an optional, a nullable, an array item or an array's objects rejects E1716 with 9007199254740991 in the state",
    async () => {
      const fixtures = build((id) => {
        const a = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.sa` });
        const b = store(s.object({ n: s.int().optional() }), {}, { id: `${id}.sb` });
        const c = store(s.object({ n: s.int().nullable() }), { n: null }, { id: `${id}.sc` });
        const d = store(s.object({ a: s.array(s.int({ min: 0 })) }), { a: [] }, { id: `${id}.sd` });
        const e = store(s.object({ a: s.array(s.object({ n: s.int({ min: 0 }) })) }), { a: [] }, { id: `${id}.se` });
        return [
          proofOf(transaction(a, `${id}.ta`, none, (state) => ({ n: state.n + 1 }))),
          proofOf(transaction(b, `${id}.tb`, none, (state) => ({ n: state.n === undefined ? 0 : state.n + 1 }))),
          proofOf(transaction(c, `${id}.tc`, none, (state) => ({ n: state.n === null ? 0 : state.n + 1 }))),
          proofOf(transaction(d, `${id}.td`, none, (state) => ({ a: state.a.map((v) => v + 1) }))),
          proofOf(transaction(e, `${id}.te`, none, (state) => ({ a: state.a.map((x) => ({ n: x.n + 1 })) }))),
        ];
      });
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 4 }), async (i) => {
          const run = fixtures[i];
          if (run === undefined) throw new Error("fixture: no transaction");
          const e = await rejection(run);
          expect(codeOf(e)).toBe("E1716");
          const state = isRecord(jsonLine(e)) ? jsonLine(e) : {};
          expect(JSON.stringify(state)).toContain(String(MAX));
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    LONG,
  );

  it(
    "v + 1 on a record value under an enum key rejects E1716 with the safe-range line",
    async () => {
      const t = build((id) => {
        const st = store(s.object({ c: s.record(s.int({ min: 0 })) }), { c: {} }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, s.object({ k: s.enum(["a", "b"]) }), (state, p) => {
          const cur = state.c[p.k];
          return cur === undefined ? state : { c: { ...state.c, [p.k]: cur + 1 } };
        });
      });
      const e = await rejection(() => prove([t]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(firstLine(e)).toBe(safeLine(isRecord(json) ? String(json.transaction) : ""));
    },
    LONG,
  );

  it(
    "{ n: 9007199254740992 } on { n: s.int() } rejects E1716 with the safe-range line",
    async () => {
      const t = build((id) => {
        const st = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, none, () => ({ n: 9007199254740992 }));
      });
      const e = await rejection(() => prove([t]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(firstLine(e)).toBe(safeLine(isRecord(json) ? String(json.transaction) : ""));
    },
    LONG,
  );

  it(
    "a guard against 9007199254740991, n + 1 <= 9 under max 9, a sum of bounded payload integers, a sum into an s.number, n + 1 - 1 and n + 1 > 5 ? 0 : n all prove",
    async () => {
      const proving = build((id) => {
        const a = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.sa` });
        const b = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: `${id}.sb` });
        const c = store(s.object({ total: s.int() }), { total: 0 }, { id: `${id}.sc` });
        const d = store(s.object({ n: s.int(), r: s.number() }), { n: 0, r: 0 }, { id: `${id}.sd` });
        const e = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.se` });
        const f = store(s.object({ n: s.int() }), { n: 0 }, { id: `${id}.sf` });
        const pair = s.object({ a: s.int({ min: 0, max: 1000 }), b: s.int({ min: 0, max: 1000 }) });
        return [
          proofOf(
            transaction(a, `${id}.ta`, none, (state) => ({ n: state.n < 9007199254740991 ? state.n + 1 : state.n })),
          ),
          proofOf(transaction(b, `${id}.tb`, none, (state) => ({ n: state.n + 1 <= 9 ? state.n + 1 : state.n }))),
          proofOf(transaction(c, `${id}.tc`, pair, (_state, p) => ({ total: p.a + p.b }))),
          proofOf(transaction(d, `${id}.td`, none, (state) => ({ n: state.n, r: state.n + 1 }))),
          proofOf(transaction(e, `${id}.te`, none, (state) => ({ n: state.n + 1 - 1 }))),
          proofOf(transaction(f, `${id}.tf`, none, (state) => ({ n: state.n + 1 > 5 ? 0 : state.n }))),
        ];
      });
      // seed 1337
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (i) => {
          const run = proving[i];
          if (run === undefined) throw new Error("fixture: no transaction");
          expect(await rejection(run)).toBeUndefined();
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    LONG,
  );

  it(
    "n + 1 unguarded on { n: s.int({ min: 0, max: 9 }) } rejects E1716 with state { n: 9 } and not the safe-range line",
    async () => {
      const t = build((id) => {
        const st = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, none, (state) => ({ n: state.n + 1 }));
      });
      const e = await rejection(() => prove([t]));
      expect(codeOf(e)).toBe("E1716");
      const json = jsonLine(e);
      expect(isRecord(json) ? json.state : undefined).toEqual({ n: 9 });
      expect(firstLine(e)).not.toBe(safeLine(isRecord(json) ? String(json.transaction) : ""));
    },
    LONG,
  );

  it(
    "a length written to an integer field proves: count: items.length, and count: items.length + 1 with an append",
    async () => {
      const schema = s.object({ items: s.array(s.string()), count: s.int({ min: 0 }) });
      const same = build((id) => {
        const st = store(schema, { items: [], count: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, none, (state) => ({ ...state, count: state.items.length }));
      });
      const append = build((id) => {
        const st = store(schema, { items: [], count: 0 }, { id: `${id}.st` });
        return transaction(st, `${id}.t`, s.object({ v: s.string() }), (state, p) => ({
          items: [...state.items, p.v],
          count: state.items.length + 1,
        }));
      });
      expect(await rejection(() => prove([same]))).toBeUndefined();
      expect(await rejection(() => prove([append]))).toBeUndefined();
    },
    LONG,
  );
});

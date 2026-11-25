// k.prove, Obligations "The goal also holds what each function needs to run as written: an option it reads through is present, each `+`, `-` and `*` result is within ±2^53, a map key it reads is present or no `Object.prototype` name, a key it writes is not `__proto__`, `constructor` or `prototype`; a string under a length rule takes only a value of that rule, else E1715."
// k.prove, Fragment "index reads (`undefined` past the length; `m[k]` likewise for a missing key)"
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
  const id = `po${seq}`;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(id) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
/** What the promise rejected with, or undefined when it resolved. */
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};

/** A function whose source is `body`: these reads go past what the types allow, so the type checker refuses them as written. */
const compiled = <F>(body: string, check: (f: unknown) => f is F): F => {
  const f: unknown = new Function("state", "p", body);
  if (!check(f)) throw new Error("fixture: not a function");
  return f;
};
type Top = { items: boolean[]; top: boolean };
const isTop = (f: unknown): f is (state: Top, p: { i: number }) => Top => typeof f === "function";
type Look = { items: { id: string; done: boolean }[]; flag: boolean };
const isLook = (f: unknown): f is (state: Look, p: { id: string }) => Look => typeof f === "function";

const indexRead = (id: string, bound: number) => {
  const st = store(
    s.object({ items: s.array(s.boolean()), top: s.boolean() }),
    { items: [], top: false },
    { id: `${id}.ix` },
  );
  const read = transaction(
    st,
    `${id}.read`,
    s.object({ i: s.int({ min: 0, max: bound }) }),
    compiled("return { ...state, top: state.items[p.i] };", isTop),
  );
  return { read };
};

const guardedIndexRead = (id: string) => {
  const st = store(
    s.object({ items: s.array(s.boolean()), top: s.boolean() }),
    { items: [], top: false },
    { id: `${id}.gix` },
  );
  const read = transaction(
    st,
    `${id}.read`,
    s.object({ i: s.int({ min: 0 }) }),
    compiled("return p.i < state.items.length ? { ...state, top: state.items[p.i] } : state;", isTop),
  );
  return { read };
};

const recordRead = (id: string) => {
  const st = store(
    s.object({ users: s.record(s.boolean()), count: s.int({ min: 0 }) }),
    { users: {}, count: 0 },
    { id: `${id}.rr` },
  );
  invariant(st, (v) => v.count === 0);
  const touch = transaction(st, `${id}.touch`, s.object({ id: s.string() }), (v, p) =>
    v.users[p.id] === undefined ? { ...v, count: v.count + 1 } : v,
  );
  return { touch };
};

const guardedRecordRead = (id: string) => {
  const st = store(
    s.object({ users: s.record(s.boolean()), count: s.int({ min: 0 }) }),
    { users: {}, count: 0 },
    { id: `${id}.grr` },
  );
  invariant(st, (v) => v.count === 0);
  const touch = transaction(st, `${id}.touch`, s.object({ id: s.enum(["ada", "bob"]) }), (v, p) =>
    v.users[p.id] === undefined ? v : { ...v, count: v.count },
  );
  return { touch };
};

const arrayAbsent = (id: string) => {
  const st = store(s.object({ xs: s.array(s.boolean()), n: s.int({ min: 0 }) }), { xs: [], n: 0 }, { id: `${id}.xs` });
  invariant(st, (v) => v.n >= 0);
  const mark = transaction(st, `${id}.mark`, s.object({ i: s.int({ min: 0 }) }), (v, p) =>
    v.xs[p.i] !== undefined ? v : { ...v, n: -1 },
  );
  return { mark };
};

const wideSum = (id: string) => {
  const st = store(s.object({ a: s.int({ min: 0 }), b: s.int({ min: 0 }) }), { a: 0, b: 0 }, { id: `${id}.sum` });
  invariant(st, (v) => v.a === v.b);
  const add = transaction(st, `${id}.add`, s.object({ x: s.int({ min: 0 }) }), (v, p) => ({
    a: v.a + p.x - p.x,
    b: v.b,
  }));
  return { add };
};

const optionField = (id: string) => {
  const Item = s.object({ id: s.string(), done: s.boolean() });
  const st = store(
    s.object({ items: s.array(Item), flag: s.boolean() }),
    { items: [], flag: false },
    { id: `${id}.opt` },
  );
  const look = transaction(
    st,
    `${id}.look`,
    s.object({ id: s.string() }),
    compiled("return { ...state, flag: state.items.find((x) => x.id === p.id).done };", isLook),
  );
  return { look };
};

const lengthRule = (id: string) => {
  const st = store(s.object({ name: s.string({ min: 1 }) }), { name: "a" }, { id: `${id}.name` });
  const set = transaction(st, `${id}.set`, s.object({ name: s.string() }), (_v, p) => ({ name: p.name }));
  return { set };
};

const protoWrite = (id: string) => {
  const st = store(s.object({ m: s.record(s.boolean()) }), { m: {} }, { id: `${id}.m` });
  const put = transaction(st, `${id}.put`, s.object({ k: s.string() }), (v, p) => ({ m: { ...v.m, [p.k]: true } }));
  return { put };
};

describe("k.prove: Obligations", () => {
  it(
    "an index read outside the array, assigned to a boolean field, rejects E1716",
    async () => {
      const { read } = build((id) => indexRead(id, 1_000_000));
      expect(codeOf(await rejection(() => prove([read])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "for generated small payload bounds, the unguarded index read never resolves",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 20 }), async (bound) => {
          const { read } = build((id) => indexRead(id, bound));
          const e = await rejection(() => prove([read]));
          expect(codeOf(e)).toBe("E1716");
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    LONG,
  );

  it(
    "the index read guarded by p.i < state.items.length proves",
    async () => {
      const { read } = build(guardedIndexRead);
      expect(await rejection(() => prove([read]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "a record read of a possibly missing key used as present rejects E1716",
    async () => {
      const { touch } = build(recordRead);
      expect(codeOf(await rejection(() => prove([touch])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "the record read of a key that is no Object.prototype name, checked for presence before use, proves",
    async () => {
      const { touch } = build(guardedRecordRead);
      expect(await rejection(() => prove([touch]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "v.xs[p.i] !== undefined ? v : { ...v, n: -1 } with invariant n >= 0 rejects E1716",
    async () => {
      const { mark } = build(arrayAbsent);
      expect(codeOf(await rejection(() => prove([mark])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "arithmetic leaving ±2^53 rejects E1716",
    async () => {
      const { add } = build(wideSum);
      expect(codeOf(await rejection(() => prove([add])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a field read through an absent option rejects E1716",
    async () => {
      const { look } = build(optionField);
      expect(codeOf(await rejection(() => prove([look])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a string under a length rule assigned from a looser string rejects E1715",
    async () => {
      const { set } = build(lengthRule);
      expect(codeOf(await rejection(() => prove([set])))).toBe("E1715");
    },
    LONG,
  );

  it(
    "a map write whose key may be __proto__ rejects",
    async () => {
      // Assumption: the spec text leaves the code open between E1715 and E1716 for this write.
      const { put } = build(protoWrite);
      const e = await rejection(() => prove([put]));
      expect(["E1715", "E1716"]).toContain(codeOf(e));
    },
    LONG,
  );
});

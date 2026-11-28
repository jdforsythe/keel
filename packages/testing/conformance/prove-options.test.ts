// k.prove, Fragment "Options both `undefined`, or both `null`, are `===` whatever their sorts."
// k.prove, Fragment "A spread's absent optional field leaves the value before it."
// k.prove, Fragment "A `Set` of objects or arrays is E1715."
// k.prove, Obligations "A key an object literal writes holds no `undefined`."
// k.prove, Sorts "`optional` outside an object field as its inner sort"
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;

let seq = 0;
/** Build a fixture inside a scope (E1203) under ids unique to this call. */
const build = <R>(mk: (id: string) => R): R => {
  seq += 1;
  const id = `pp${seq}`;
  let out: { value: R } | undefined;
  scope(
    () => {
      out = { value: mk(id) };
    },
    { detached: true },
  );
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

/** A function whose source is `body`: the type checker would refuse it as written. */
const compiled = <F>(body: string, check: (f: unknown) => f is F): F => {
  const f: unknown = new Function("state", "p", body);
  if (!check(f)) throw new Error("fixture: not a function");
  return f;
};
type Xs = { xs: (number | undefined)[] };
const isXs = (f: unknown): f is (state: Xs, p: Record<string, never>) => Xs => typeof f === "function";

type XsSchema = Parameters<typeof store<Xs>>[0];
const isXsSchema = (x: unknown): x is XsSchema => isRecord(x) && typeof x.parse === "function";

const optEq = (id: string, bad: boolean) => {
  const st = store(s.object({ o: s.int().optional(), ok: s.boolean() }), { ok: true }, { id: `${id}.oe` });
  invariant(st, (v) => v.ok);
  const schema = s.object({ o: s.number().optional() });
  const go = bad
    ? transaction(st, `${id}.go`, schema, (v, p) => (v.o === p.o && v.o === undefined ? { ...v, ok: false } : v))
    : transaction(st, `${id}.go`, schema, (v, p) => (v.o === p.o && v.o === undefined ? v : v));
  return { go };
};

const optEqString = (id: string, bad: boolean) => {
  const st = store(s.object({ o: s.string({ min: 1 }).optional(), ok: s.boolean() }), { ok: true }, { id: `${id}.os` });
  invariant(st, (v) => v.ok);
  const schema = s.object({ o: s.string().optional() });
  const go = bad
    ? transaction(st, `${id}.go`, schema, (v, p) => (v.o === p.o && v.o === undefined ? { ...v, ok: false } : v))
    : transaction(st, `${id}.go`, schema, (v, p) => (v.o === p.o && v.o === undefined ? v : v));
  return { go };
};

const spreadAbsent = (id: string, absentInvariant: boolean) => {
  const st = store(s.object({ o: s.int().optional(), lock: s.boolean() }), { o: 5, lock: true }, { id: `${id}.sp` });
  if (absentInvariant) invariant(st, (v) => v.lock || v.o === undefined);
  else invariant(st, (v) => v.lock || v.o !== undefined);
  const go = transaction(st, `${id}.go`, s.object({ o: s.int().optional() }), (v, p) =>
    p.o === undefined ? { ...v, ...p, lock: false } : v,
  );
  return { go };
};

const setOfObjects = (id: string) => {
  const st = store(
    s.object({ items: s.array(s.object({ a: s.int() })), ok: s.boolean() }),
    { items: [], ok: true },
    { id: `${id}.so` },
  );
  invariant(st, (v) => new Set(v.items).size === v.items.length);
  const keep = transaction(st, `${id}.keep`, s.object({}), (v) => v);
  return { keep };
};

const setOfScalars = (id: string) => {
  const st = store(
    s.object({ items: s.array(s.object({ a: s.int() })), ok: s.boolean() }),
    { items: [], ok: true },
    { id: `${id}.ss` },
  );
  invariant(st, (v) => new Set(v.items.map((x) => x.a)).size === v.items.length);
  const keep = transaction(st, `${id}.keep`, s.object({}), (v) => ({ ...v, items: v.items }));
  return { keep };
};

type Write = { o?: number; n: number };
const isWrite = (f: unknown): f is (state: Write, p: { o?: number }) => Write => typeof f === "function";

const objectWrite = (id: string, guarded: boolean) => {
  const st = store(s.object({ o: s.int().optional(), n: s.int() }), { n: 0 }, { id: `${id}.ow` });
  const schema = s.object({ o: s.int().optional() });
  const set = guarded
    ? transaction(st, `${id}.set`, schema, (v, p) => (p.o === undefined ? v : { ...v, o: p.o }))
    : transaction(st, `${id}.set`, schema, compiled("return { ...state, o: p.o };", isWrite));
  return { st, set };
};

describe("k.prove: Options and optional fields", () => {
  it(
    "options both undefined are === whatever their sorts: int against number rejects E1716 when the equal-undefined branch breaks the invariant",
    async () => {
      const { go } = build((id) => optEq(id, true));
      expect(codeOf(await rejection(() => prove([go])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "options both undefined are === whatever their sorts: the twin returning state in both branches proves",
    async () => {
      const { go } = build((id) => optEq(id, false));
      expect(await rejection(() => prove([go]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "options both undefined are === whatever their sorts: string with a length rule against string rejects E1716, and its twin proves",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (bad) => {
          const { go } = build((id) => optEqString(id, bad));
          const e = await rejection(() => prove([go]));
          if (bad) expect(codeOf(e)).toBe("E1716");
          else expect(e).toBeUndefined();
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    LONG,
  );

  it(
    "a spread's absent optional field leaves the value before it: { ...state, ...p } keeps o: 5, so invariant lock || o === undefined rejects E1716",
    async () => {
      const { go } = build((id) => spreadAbsent(id, true));
      expect(codeOf(await rejection(() => prove([go])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a spread's absent optional field leaves the value before it: invariant lock || o !== undefined is not inductive and rejects E1716 from a state with o absent",
    async () => {
      // Assumption: the spread keeps a present `o` when `p.o` is absent, but a state with `lock` true and `o` absent satisfies the invariant and the same branch clears `lock`, so the invariant is true of `initial` yet not inductive.
      const { go } = build((id) => spreadAbsent(id, false));
      const e = await rejection(() => prove([go]));
      expect(codeOf(e)).toBe("E1716");
      const data = isRecord(e) ? e.data : undefined;
      const state = isRecord(data) ? data.state : undefined;
      expect(isRecord(state) && state.o === undefined && state.lock === true).toBe(true);
    },
    LONG,
  );

  it(
    "a Set of objects is E1715",
    async () => {
      const { keep } = build(setOfObjects);
      expect(codeOf(await rejection(() => prove([keep])))).toBe("E1715");
    },
    LONG,
  );

  it(
    "a Set over mapped scalars with a transaction keeping items does not reject E1715 and proves",
    async () => {
      const { keep } = build(setOfScalars);
      expect(await rejection(() => prove([keep]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "a key an object literal writes holds no undefined: { ...state, o: p.o } with o optional rejects E1716",
    async () => {
      const { set } = build((id) => objectWrite(id, false));
      expect(codeOf(await rejection(() => prove([set])))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a key an object literal writes holds no undefined: the guarded twin proves",
    async () => {
      const { set } = build((id) => objectWrite(id, true));
      expect(await rejection(() => prove([set]))).toBeUndefined();
    },
    LONG,
  );

  it(
    "running the unguarded write at run time does not leave a state with o present as undefined",
    async () => {
      const { st, set } = build((id) => objectWrite(id, false));
      try {
        await tx(set, {});
      } catch {
        // A throw is one way the write does not succeed.
      }
      const state: Record<string, unknown> = st.snapshot().state;
      expect("o" in state && state.o === undefined).toBe(false);
    },
    LONG,
  );

  it(
    "optional outside an object field is its inner sort: an array of optional ints with undefined appended rejects E1715",
    async () => {
      // Assumption: the spec names the sort but not the code for appending undefined; E1715 is the code given for a value outside the fragment.
      const { go } = build((id) => {
        const inner: unknown = s.int().optional();
        const built: unknown = Reflect.apply(s.array, undefined, [inner]);
        const wrapped: unknown = Reflect.apply(s.object, undefined, [{ xs: built }]);
        if (!isXsSchema(wrapped)) throw new Error("fixture: not a schema");
        const st = store(wrapped, { xs: [] }, { id: `${id}.oa` });
        return {
          go: transaction(
            st,
            `${id}.go`,
            s.object({}),
            compiled("return { ...state, xs: [...state.xs, undefined] };", isXs),
          ),
        };
      });
      expect(codeOf(await rejection(() => prove([go])))).toBe("E1715");
    },
    LONG,
  );
});

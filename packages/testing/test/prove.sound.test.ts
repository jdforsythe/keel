// `prove` never passes where the transaction, run, breaks the schema, throws or reads past what the terms hold
// (k.prove): an index past the length and a key a map lacks are undefined, a key Object.prototype holds is no value,
// integers stay exact, strings keep their length rules, and a block's bindings stay in the block.
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { type Transaction, invariant, store, transaction, tx } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { describe, expect, it } from "vitest";

const LONG = 120_000;
let seq = 0;
const none = s.object({});
/** One transaction `fn` with payload schema `pay` on a store of `schema` from `initial`, invariant `inv`. */
const one = <T extends object, P>(
  schema: Schema<T>,
  initial: T,
  inv: (state: T) => boolean,
  pay: Schema<P>,
  fn: (state: T, p: P) => T,
): Transaction<T, P> => {
  seq += 1;
  let out: { value: Transaction<T, P> } | undefined;
  scope(() => {
    const st = store(schema, initial, { id: `ps${seq}` });
    invariant(st, inv);
    out = { value: transaction(st, `ps${seq}.t`, pay, fn) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};
/** `proven`, or the code and the JSON line of the rejection (the construct for E1715). */
const verdict = async <T, P>(t: Transaction<T, P>): Promise<string> => {
  try {
    await prove([t]);
    return "proven";
  } catch (e) {
    if (!(e instanceof Error)) return String(e);
    const code = String(Reflect.get(e, "code"));
    const line = e.message.split("\n")[1];
    if (line !== undefined) return `${code} ${line}`;
    const data: unknown = Reflect.get(e, "data");
    return `${code} ${String(typeof data === "object" && data !== null ? Reflect.get(data, "construct") : "")}`;
  }
};
/** A function whose source is `body`, for code the type checker refuses (it reads past what the types allow). */
const compiled = <F>(body: string, check: (f: unknown) => f is F): F => {
  const f: unknown = new Function("state", "p", body);
  if (!check(f)) throw new Error("fixture: not a function");
  return f;
};
type Last = { items: { id: string; n: number }[]; last: number };
const isLast = (f: unknown): f is (state: Last, p: { id: string }) => Last => typeof f === "function";
type Top = { items: boolean[]; top: boolean };
const isTop = (f: unknown): f is (state: Top, p: { i: number }) => Top => typeof f === "function";
type N = { n: number };
const isN = (f: unknown): f is (state: N) => N => typeof f === "function";
/** The payload of an E1716 verdict. */
const payloadOf = (got: string): unknown => {
  const data: unknown = JSON.parse(got.slice("E1716 ".length));
  return typeof data === "object" && data !== null ? Reflect.get(data, "payload") : undefined;
};
/** What the store does with `payload` from its initial state: `ok`, or the error code (a throw too). */
const run = <T, P>(t: Transaction<T, P>, payload: P): string => {
  try {
    const r = tx(t, payload);
    return r.ok ? "ok" : r.error.code;
  } catch (e) {
    return e instanceof TypeError ? "throw" : "invalid";
  }
};

describe("prove: what the terms hold is what the code does", () => {
  it(
    "an index read past the length is undefined, which a required field refuses",
    async () => {
      const t = one(
        s.object({ items: s.array(s.boolean()), top: s.boolean() }),
        { items: [], top: false },
        () => true,
        s.object({ i: s.int({ min: 0 }) }),
        compiled("return { ...state, top: state.items[p.i] };", isTop),
      );
      expect(run(t, { i: 0 })).not.toBe("ok");
      expect(await verdict(t)).toMatch(/^E1716 \{"transaction":"ps\d+\.t","state":\{"items":\[\],/);
    },
    LONG,
  );

  it(
    "an index read compares with undefined as the code does; a guarded read proves",
    async () => {
      const Xs = s.object({ xs: s.array(s.int()), n: s.int() });
      const pay = s.object({ i: s.int() });
      const unguarded = one(
        Xs,
        { xs: [], n: 0 },
        (v) => v.n >= 0,
        pay,
        (v, p) => (v.xs[p.i] !== undefined ? v : { ...v, n: -1 }),
      );
      expect(run(unguarded, { i: 5 })).toBe("store.invariant");
      expect((await verdict(unguarded)).split(" ")[0]).toBe("E1716");
      const guarded = one(
        Xs,
        { xs: [], n: 0 },
        (v) => v.n >= 0,
        pay,
        (v, p) => {
          const x = v.xs[p.i];
          return x === undefined || x < 0 || x > 9 ? v : { ...v, n: x };
        },
      );
      expect(await verdict(guarded)).toBe("proven");
    },
    LONG,
  );

  it(
    "a map read of a key it lacks is undefined",
    async () => {
      const t = one(
        s.object({ users: s.record(s.string()), count: s.int({ min: 0, max: 1 }) }),
        { users: {}, count: 0 },
        (v) => v.count === 0,
        s.object({ id: s.enum(["u1", "u2"]), name: s.string() }),
        (v, p) => (v.users[p.id] === undefined ? { users: { ...v.users, [p.id]: p.name }, count: v.count + 1 } : v),
      );
      expect(run(t, { id: "u1", name: "a" })).toBe("store.invariant");
      expect((await verdict(t)).split(" ")[0]).toBe("E1716");
    },
    LONG,
  );

  it(
    "a map read of a key Object.prototype holds is no value; a write of a key the schema refuses breaks it",
    async () => {
      const M = s.object({ counts: s.record(s.int({ min: 0, max: 9 })) });
      const bump = one(
        M,
        { counts: {} },
        () => true,
        s.object({ k: s.string() }),
        (state, p) => {
          const c = state.counts[p.k];
          return c === undefined || c > 8 ? state : { counts: { ...state.counts, [p.k]: c + 1 } };
        },
      );
      expect(run(bump, { k: "toString" })).not.toBe("ok");
      const got = await verdict(bump);
      expect(got.split(" ")[0]).toBe("E1716");
      const k: unknown = Reflect.get(Object(payloadOf(got)), "k");
      expect(Object.getOwnPropertyNames(Object.prototype)).toContain(k);
      const put = one(
        M,
        { counts: {} },
        () => true,
        s.object({ k: s.string(), v: s.int({ min: 0, max: 9 }) }),
        (state, p) => ({
          counts: { ...state.counts, [p.k]: p.v },
        }),
      );
      expect(run(put, { k: "__proto__", v: 1 })).not.toBe("ok");
      expect((await verdict(put)).split(" ")[0]).toBe("E1716");
    },
    LONG,
  );

  it(
    "a sum past 2^53 is not exact, so it does not prove",
    async () => {
      const t = one(
        s.object({ a: s.int(), b: s.int() }),
        { a: 2, b: 2 },
        (v) => v.a === v.b,
        s.object({ x: s.int() }),
        (v, p) => ({ a: v.a + p.x - p.x, b: v.b }),
      );
      expect(run(t, { x: Number.MAX_SAFE_INTEGER })).toBe("store.invariant");
      expect((await verdict(t)).split(" ")[0]).toBe("E1716");
    },
    LONG,
  );

  it(
    "a property of a find that matched nothing throws, so an unguarded read does not prove",
    async () => {
      const Item = s.object({ id: s.string(), n: s.int({ min: 0 }) });
      const t = one(
        s.object({ items: s.array(Item), last: s.int({ min: 0 }) }),
        { items: [], last: 0 },
        () => true,
        s.object({ id: s.string() }),
        compiled("return { ...state, last: state.items.find((x) => x.id === p.id).n };", isLast),
      );
      expect(run(t, { id: "a" })).toBe("throw");
      expect(await verdict(t)).toMatch(/^E1716 \{"transaction":"ps\d+\.t","state":\{"items":\[\],/);
    },
    LONG,
  );

  it(
    "a string keeps its length rule: a copy under the same rule proves; a looser schema, a literal or an array of them is E1715",
    async () => {
      const Named = s.object({ name: s.string({ min: 1, max: 9 }) });
      const loose = one(
        Named,
        { name: "x" },
        () => true,
        s.object({ n: s.string() }),
        (_, p) => ({ name: p.n }),
      );
      expect(run(loose, { n: "" })).not.toBe("ok");
      expect(await verdict(loose)).toBe("E1715 a string rule");
      const same = one(
        Named,
        { name: "x" },
        () => true,
        s.object({ n: s.string({ min: 1, max: 9 }) }),
        (_, p) => ({
          name: p.n,
        }),
      );
      expect(await verdict(same)).toBe("proven");
      const lit = one(
        Named,
        { name: "x" },
        () => true,
        s.object({ on: s.boolean() }),
        (state, p) => ({
          name: p.on ? "untitled" : state.name,
        }),
      );
      expect(await verdict(lit)).toBe("E1715 a string rule");
      const list = one(
        s.object({ names: s.array(s.string({ min: 1 })) }),
        { names: [] },
        () => true,
        s.object({ names: s.array(s.string()) }),
        (_, p) => ({ names: p.names }),
      );
      expect(run(list, { names: [""] })).not.toBe("ok");
      expect((await verdict(list)).split(" ")[0]).toBe("E1715");
      const blank = one(
        Named,
        { name: "x" },
        () => true,
        none,
        () => ({ name: " " }),
      );
      expect(await verdict(blank)).toBe("E1715 a string rule");
    },
    LONG,
  );

  it(
    "a binding stays in its block, a shadowing one and a key the schema lacks are E1715",
    async () => {
      const N = s.object({ n: s.int({ min: 0, max: 9 }) });
      const leak = one(N, { n: 0 }, () => true, none, compiled("{ const x = 1; } return { n: x };", isN));
      expect(run(leak, {})).toBe("invalid");
      expect(await verdict(leak)).toBe("E1715 the identifier x");
      const shadow = one(
        N,
        { n: 0 },
        () => true,
        none,
        (state) => {
          const n = state.n > 0 ? 0 : 1;
          {
            const n = 2;
            if (n > 9) return state;
          }
          return { n };
        },
      );
      expect(await verdict(shadow)).toBe("E1715 VariableDeclarator");
      const extra = one(N, { n: 0 }, () => true, none, compiled("return { ...state, bogus: 1 };", isN));
      expect(await verdict(extra)).toBe("E1715 .bogus");
    },
    LONG,
  );
});

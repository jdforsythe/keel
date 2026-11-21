// `prove` never passes where the transaction, run, breaks the schema, throws or reads past what the terms hold
// (k.prove): an index past the length and a key a map lacks are undefined, a key Object.prototype holds is no value,
// integers stay exact, strings keep their length rules, a block's bindings stay in the block, `undefined` under a key
// is no value, a spread copies the keys its object holds, absent options are equal, objects compare by reference, and
// an integer `s.int` refuses is a counterexample the store throws from.
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
const isStep = <T, P>(f: unknown): f is (state: T, p: P) => T => typeof f === "function";
const isCheck = <T>(f: unknown): f is (state: T) => boolean => typeof f === "function";
/** `one` with the invariant and the function compiled from the text shown (over `state`, and `p`). */
const text = <T extends object, P>(
  schema: Schema<T>,
  initial: T,
  inv: string,
  pay: Schema<P>,
  body: string,
): Transaction<T, P> => {
  const check: unknown = new Function("state", inv);
  const step: unknown = new Function("state", "p", body);
  if (!isCheck<T>(check) || !isStep<T, P>(step)) throw new Error("fixture: not a function");
  return one(schema, initial, check, pay, step);
};
/** An optional schema as an item or a map value, which the type checker refuses and untyped code builds. */
const isItem = (x: unknown): x is Schema<number> => typeof x === "object";
/** The code of a verdict, without its counterexample or construct. */
const code = async <T, P>(t: Transaction<T, P>): Promise<string> => (await verdict(t)).split(" ")[0] ?? "";
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

describe("prove: undefined under a key is no value", () => {
  const St = s.object({ o: s.int().optional(), n: s.int() });
  const pay = s.object({ o: s.int().optional(), f: s.boolean() });
  const write = (body: string) => text(St, { n: 0 }, "return true;", pay, body);

  it(
    "an optional field written with undefined is refused by the schema: E1716; guarded, or left out, it proves",
    async () => {
      const refused = [
        { value: "p.o", never: { o: expect.any(Number) } },
        { value: "undefined", never: { o: "none" } },
        { value: "p.f ? 1 : undefined", never: { f: true } },
      ];
      for (const { value, never } of refused) {
        const t = write(`return { ...state, o: ${value} };`);
        expect(run(t, { f: false })).toBe("invalid");
        const got = await verdict(t);
        expect(got.split(" ")[0]).toBe("E1716");
        expect(payloadOf(got)).not.toMatchObject(never);
      }
      const bound = write("const o = p.o; return { ...state, o };");
      expect(run(bound, { f: false })).toBe("invalid");
      expect(await code(bound)).toBe("E1716");
      const guarded = write("return p.o === undefined ? state : { ...state, o: p.o };");
      expect(run(guarded, { f: false })).toBe("ok");
      expect(await verdict(guarded)).toBe("proven");
      expect(await verdict(write("return { ...state, o: p.f ? 1 : 2 };"))).toBe("proven");
      expect(await verdict(write("return { n: state.n };"))).toBe("proven");
      expect(await verdict(write("return state.n === undefined ? { ...state, o: undefined } : state;"))).toBe("proven");
    },
    LONG,
  );

  it(
    "a nullable optional field takes null and refuses undefined; a nullable field and null in an optional one are E1715",
    async () => {
      const W = s.object({ w: s.int().nullable().optional(), z: s.int().nullable(), o: s.int().optional() });
      const payW = s.object({ w: s.int().nullable().optional() });
      const put = (body: string) => text(W, { z: null }, "return true;", payW, body);
      const copy = put("return { ...state, w: p.w };");
      expect(run(copy, {})).toBe("invalid");
      expect(payloadOf(await verdict(copy))).toStrictEqual({});
      const guarded = put("return p.w === undefined ? { ...state, w: null } : { ...state, w: p.w };");
      expect(run(guarded, {})).toBe("ok");
      expect(await verdict(guarded)).toBe("proven");
      const gone = put("return { ...state, z: undefined };");
      expect(run(gone, {})).toBe("invalid");
      expect(await verdict(gone)).toBe("E1715 undefined or null");
      const nul = put("return { ...state, o: null };");
      expect(run(nul, {})).toBe("invalid");
      expect(await verdict(nul)).toBe("E1715 undefined or null");
    },
    LONG,
  );

  it(
    "optional in an array or a map allows no undefined: an item or a value written with it does not prove",
    async () => {
      const item: unknown = s.int().optional();
      if (!isItem(item)) throw new Error("fixture: not a schema");
      const Xs = s.object({ xs: s.array(item), m: s.record(item) });
      const start = { xs: [], m: {} };
      const payO = s.object({ o: s.int().optional() });
      const put = (body: string) => text(Xs, start, "return true;", payO, body);
      for (const body of [
        "return { ...state, xs: [...state.xs, undefined] };",
        "return { ...state, m: { a: undefined } };",
      ]) {
        const t = put(body);
        expect(run(t, {})).toBe("invalid");
        expect(await verdict(t)).toBe("E1715 undefined or null");
      }
      for (const body of [
        "return { ...state, xs: [...state.xs, p.o] };",
        "return { ...state, m: { ...state.m, a: p.o } };",
      ]) {
        const t = put(body);
        expect(run(t, {})).toBe("invalid");
        expect(payloadOf(await verdict(t))).toStrictEqual({});
      }
      const guarded = put("return p.o === undefined ? state : { xs: [...state.xs, p.o], m: { ...state.m, a: p.o } };");
      expect(run(guarded, { o: 1 })).toBe("ok");
      expect(await verdict(guarded)).toBe("proven");
    },
    LONG,
  );
});

describe("prove: a spread copies the keys its object holds", () => {
  it(
    "an absent optional in a later spread keeps the earlier value; a present one replaces it",
    async () => {
      const St = s.object({ o: s.int().optional(), lock: s.boolean() });
      const pay = s.object({ o: s.int().optional() });
      const body = "return p.o === undefined ? { ...state, ...p, lock: false } : state;";
      const kept = text(St, { o: 5, lock: true }, "return state.lock || state.o === undefined;", pay, body);
      expect(run(kept, {})).toBe("store.invariant");
      expect(payloadOf(await verdict(kept))).toStrictEqual({});
      const present = "return state.o !== undefined && state.o >= 0;";
      const merge = text(
        St,
        { o: 5, lock: true },
        present,
        s.object({ o: s.int({ min: 0 }).optional() }),
        "return { ...state, ...p };",
      );
      expect(run(merge, {})).toBe("ok");
      expect(await verdict(merge)).toBe("proven");
      const written = text(St, { o: 5, lock: true }, present, pay, "return { lock: state.lock, o: 1, ...p };");
      expect(run(written, {})).toBe("ok");
      expect(payloadOf(await verdict(written))).toStrictEqual({ o: expect.any(Number) });
      const replaced = text(St, { o: 5, lock: true }, present, pay, "return { ...state, ...p };");
      expect(run(replaced, { o: -1 })).toBe("store.invariant");
      expect(payloadOf(await verdict(replaced))).toStrictEqual({ o: expect.any(Number) });
    },
    LONG,
  );

  it(
    "a nullable key is always held, so null replaces; a nullable optional one is kept when absent",
    async () => {
      const St = s.object({ z: s.int().nullable(), w: s.int().nullable().optional() });
      const pay = s.object({ z: s.int().nullable(), w: s.int().nullable().optional() });
      const merge = (inv: string) => text(St, { z: 1, w: 1 }, inv, pay, "return { ...state, ...p };");
      const z = merge("return state.z !== null;");
      expect(run(z, { z: null })).toBe("store.invariant");
      expect(payloadOf(await verdict(z))).toMatchObject({ z: null });
      const w = merge("return state.w !== null;");
      expect(run(w, { z: 1, w: null })).toBe("store.invariant");
      expect(payloadOf(await verdict(w))).toMatchObject({ w: null });
      const held = merge("return state.w !== undefined;");
      expect(run(held, { z: 1 })).toBe("ok");
      expect(await verdict(held)).toBe("proven");
    },
    LONG,
  );

  it(
    "Object.assign is outside the fragment",
    async () => {
      const N = s.object({ n: s.int() });
      const t = text(N, { n: 0 }, "return true;", none, "return Object.assign({}, state);");
      expect(await verdict(t)).toBe("E1715 call to Object.assign");
    },
    LONG,
  );
});

describe("prove: === between options", () => {
  const flip = (test: string): string => `return ${test} ? { ...state, ok: false } : state;`;

  it(
    "two absent options are equal whatever their sorts, with === and !==; a present and an absent one are not",
    async () => {
      const St = s.object({ o: s.int().optional(), t: s.string({ min: 1 }).optional(), ok: s.boolean() });
      const pay = s.object({ o: s.number().optional(), t: s.string().optional() });
      const on = (test: string) => text(St, { ok: true }, "return state.ok;", pay, flip(test));
      for (const { test, key } of [
        { test: "state.o === p.o && state.o === undefined", key: "o" },
        { test: "state.t === p.t && p.t === undefined", key: "t" },
        { test: "!(state.o !== p.o) && p.o === undefined", key: "o" },
      ]) {
        const t = on(test);
        expect(run(t, {})).toBe("store.invariant");
        const got = await verdict(t);
        expect(got.split(" ")[0]).toBe("E1716");
        expect(payloadOf(got)).not.toHaveProperty(key);
      }
      const apart = on(
        "(state.o === p.o || state.t === p.t) && (state.o === undefined) !== (p.o === undefined) && (state.t === undefined) !== (p.t === undefined)",
      );
      expect(run(apart, { o: 1, t: "a" })).toBe("ok");
      expect(await verdict(apart)).toBe("proven");
      expect(await code(on("state.o === p.o && state.o !== undefined"))).toBe("E1716");
    },
    LONG,
  );

  it(
    "two nulls are equal whatever their sorts; undefined and null are not",
    async () => {
      const St = s.object({ z: s.int().nullable(), o: s.int().optional(), ok: s.boolean() });
      const pay = s.object({ z: s.number().nullable() });
      const on = (test: string) => text(St, { z: null, ok: true }, "return state.ok;", pay, flip(test));
      const both = on("state.z === p.z && state.z === null");
      expect(run(both, { z: null })).toBe("store.invariant");
      expect(payloadOf(await verdict(both))).toStrictEqual({ z: null });
      const mixed = on("(state.o === p.z || p.z === state.o) && (state.o === undefined || p.z === null)");
      expect(run(mixed, { z: null })).toBe("ok");
      expect(await verdict(mixed)).toBe("proven");
    },
    LONG,
  );

  it(
    "a Set holds an absent value of another sort; == and != are outside the fragment",
    async () => {
      const St = s.object({ xs: s.array(s.object({ o: s.int().optional() })), ok: s.boolean() });
      const pay = s.object({ o: s.number().optional() });
      const on = (test: string) => text(St, { xs: [{}], ok: true }, "return state.ok;", pay, flip(test));
      const has = on("new Set(state.xs.map((x) => x.o)).has(p.o) && p.o === undefined");
      expect(run(has, {})).toBe("store.invariant");
      expect(payloadOf(await verdict(has))).toStrictEqual({});
      const held = on(
        "new Set(state.xs.map((x) => x.o)).has(p.o) && p.o === undefined && state.xs.every((x) => x.o !== undefined)",
      );
      expect(await verdict(held)).toBe("proven");
      expect(await code(on("state.xs.length == 1"))).toBe("E1715");
      expect(await code(on("state.xs.length != 1"))).toBe("E1715");
    },
    LONG,
  );

  it(
    "an item that is undefined reads as undefined, from an index and from find",
    async () => {
      const St = s.object({ xs: s.array(s.object({ o: s.int().optional() })), ok: s.boolean() });
      const on = (test: string) => text(St, { xs: [{}], ok: true }, "return state.ok;", none, flip(test));
      const reads = ["state.xs.map((x) => x.o)[0]", "state.xs.map((x) => x.o).find((o) => o === undefined)"];
      for (const read of reads) {
        const t = on(`state.xs.length > 0 && ${read} === undefined`);
        expect(run(t, {})).toBe("store.invariant");
        expect(await code(t)).toBe("E1716");
      }
      const all = "state.xs.length > 0 && state.xs.every((x) => x.o !== undefined)";
      expect(await verdict(on(`${all} && ${reads[0]} === undefined`))).toBe("proven");
      expect(await verdict(on(`${reads[1]} !== undefined`))).toBe("proven");
      const Zs = s.object({ zs: s.array(s.int().nullable()), ok: s.boolean() });
      const past = (value: string) =>
        text(
          Zs,
          { zs: [], ok: true },
          "return state.ok;",
          none,
          flip(`state.zs.length === 0 && state.zs[0] === ${value}`),
        );
      expect(run(past("undefined"), {})).toBe("store.invariant");
      expect(await code(past("undefined"))).toBe("E1716");
      expect(run(past("null"), {})).toBe("ok");
      expect(await verdict(past("null"))).toBe("proven");
    },
    LONG,
  );
});

describe("prove: objects compare by reference", () => {
  const Items = s.object({ items: s.array(s.object({ a: s.int() })), ok: s.boolean() });
  const body =
    "return state.items.length > 1 && state.items.every((x) => x.a === 1) ? { ...state, ok: false } : state;";

  it(
    "a Set of objects holds equal objects apart, so it is E1715; a Set of their values proves",
    async () => {
      const twice = { items: [{ a: 1 }, { a: 1 }], ok: true };
      const refs = text(
        Items,
        twice,
        "return new Set(state.items).size === state.items.length && state.ok;",
        none,
        body,
      );
      expect(run(refs, {})).toBe("store.invariant");
      expect(await verdict(refs)).toBe("E1715 a Set of objects");
      const values = "return new Set(state.items.map((x) => x.a)).size === state.items.length && state.ok;";
      const byValue = text(Items, { items: [], ok: true }, values, none, body);
      expect(await verdict(byValue)).toBe("proven");
    },
    LONG,
  );

  it(
    "a Set of arrays or of optional objects, includes, indexOf and a Map are E1715",
    async () => {
      const St = s.object({
        rows: s.array(s.array(s.int())),
        subs: s.array(s.object({ sub: s.object({ a: s.int() }).optional() })),
        ok: s.boolean(),
      });
      const on = (test: string) =>
        text(St, { rows: [], subs: [], ok: true }, "return state.ok;", none, `return ${test} ? state : state;`);
      expect(await verdict(on("new Set(state.rows).size === state.rows.length"))).toBe("E1715 a Set of objects");
      expect(await verdict(on("new Set(state.subs.map((x) => x.sub)).size === state.subs.length"))).toBe(
        "E1715 a Set of objects",
      );
      expect(await verdict(on("state.rows.includes(state.rows[0])"))).toBe("E1715 call to state.rows.includes");
      expect(await verdict(on("state.rows.indexOf(state.rows[0]) === 0"))).toBe("E1715 call to state.rows.indexOf");
      expect(await verdict(on("new Map(state.rows.map((r) => [r, 1])).size === 0"))).toBe("E1715 new Map");
      expect(await verdict(on("state.rows[0] === state.rows[0]"))).toBe("E1715 === on objects");
    },
    LONG,
  );
});

describe("prove: an integer the store refuses is a counterexample", () => {
  const MAX = Number.MAX_SAFE_INTEGER;
  const up = s.int({ min: 0 });
  /**
   * The state of the counterexample of `fn` (`proven` when it has none), and what the store does from that state with
   * the counterexample's payload: `ok`, an error code, or `refused` when it throws on a state that does not parse.
   */
  const both = async <T extends object, P>(
    schema: Schema<T>,
    initial: T,
    pay: Schema<P>,
    fn: (state: T, p: P) => T,
  ): Promise<readonly [unknown, string]> => {
    const got = await verdict(one(schema, initial, () => true, pay, fn));
    if (!got.startsWith("E1716 ")) return [got, ""];
    const data: unknown = JSON.parse(got.slice("E1716 ".length));
    const state = schema.parse(Reflect.get(Object(data), "state"));
    const payload = pay.parse(Reflect.get(Object(data), "payload"));
    if (!state.ok || !payload.ok) throw new Error("fixture: the counterexample does not parse");
    return [state.value, from(schema, state.value, pay, fn, payload.value)];
  };
  /** What the store does with `payload` from `state`. */
  const from = <T extends object, P>(
    schema: Schema<T>,
    state: T,
    pay: Schema<P>,
    fn: (state: T, p: P) => T,
    payload: P,
  ): string => {
    const t = one(schema, state, () => true, pay, fn);
    try {
      const r = tx(t, payload);
      return r.ok ? "ok" : r.error.code;
    } catch (e) {
      return e instanceof Error && e.message.startsWith(`transaction ${t.name} returned invalid state: int at `)
        ? "refused"
        : String(e);
    }
  };

  it(
    "a sum written past the safe range rejects at the edge, where the store throws: a field, both ways",
    async () => {
      const N = s.object({ n: up });
      expect(await both(N, { n: 0 }, none, (v) => ({ n: v.n + 1 }))).toStrictEqual([{ n: MAX }, "refused"]);
      const Down = s.object({ n: s.int({ max: 0 }) });
      expect(await both(Down, { n: 0 }, none, (v) => ({ n: v.n - 1 }))).toStrictEqual([{ n: -MAX }, "refused"]);
      const Any = s.object({ n: s.int() });
      expect(await both(Any, { n: 0 }, none, () => ({ n: 9007199254740992 }))).toStrictEqual([{ n: 0 }, "refused"]);
    },
    LONG,
  );

  it(
    "an optional and a nullable field, an item, a field of an item and a map value reject at the edge too",
    async () => {
      const Opt = s.object({ n: up.optional() });
      expect(await both(Opt, {}, none, (v) => (v.n === undefined ? { n: 0 } : { n: v.n + 1 }))).toStrictEqual([
        { n: MAX },
        "refused",
      ]);
      const Nul = s.object({ n: up.nullable() });
      expect(await both(Nul, { n: null }, none, (v) => (v.n === null ? v : { n: v.n + 1 }))).toStrictEqual([
        { n: MAX },
        "refused",
      ]);
      const Items = s.object({ a: s.array(up) });
      expect(await both(Items, { a: [] }, none, (v) => ({ a: v.a.map((x) => x + 1) }))).toStrictEqual([
        { a: [MAX] },
        "refused",
      ]);
      const Rows = s.object({ a: s.array(s.object({ n: up })) });
      expect(await both(Rows, { a: [] }, none, (v) => ({ a: v.a.map((x) => ({ n: x.n + 1 })) }))).toStrictEqual([
        { a: [{ n: MAX }] },
        "refused",
      ]);
      // A map prints as `{}`, so the store runs from the state the counterexample stands for.
      const Counts = s.object({ c: s.record(up) });
      const key = s.object({ k: s.enum(["a", "b"]) });
      const bump = (v: { c: Record<string, number> }, p: { k: "a" | "b" }) => {
        const cur = v.c[p.k];
        return cur === undefined ? v : { c: { ...v.c, [p.k]: cur + 1 } };
      };
      expect(await code(one(Counts, { c: {} }, () => true, key, bump))).toBe("E1716");
      expect(from(Counts, { c: { a: MAX } }, key, bump, { k: "a" })).toBe("refused");
    },
    LONG,
  );

  it(
    "a product and a sum with the payload reject where the store throws",
    async () => {
      const N = s.object({ n: up });
      expect(await both(N, { n: 0 }, none, (v) => ({ n: v.n * 2 }))).toStrictEqual([
        { n: 4503599627370497 },
        "refused",
      ]);
      const [state, ran] = await both(N, { n: 0 }, s.object({ by: up }), (v, p) => ({ n: v.n + p.by }));
      expect(state).not.toBe("proven");
      expect(ran).toBe("refused");
    },
    LONG,
  );

  it(
    "a guarded write proves and the store takes it at the edge; a sum into a number field does too",
    async () => {
      const N = s.object({ n: up });
      const guarded = (v: { n: number }) => ({ n: v.n < 9007199254740991 ? v.n + 1 : v.n });
      expect(await both(N, { n: 0 }, none, guarded)).toStrictEqual(["proven", ""]);
      expect(from(N, { n: MAX }, none, guarded, {})).toBe("ok");
      expect(from(N, { n: MAX - 1 }, none, guarded, {})).toBe("ok");
      const Real = s.object({ n: s.int(), r: s.number() });
      const sum = (v: { n: number; r: number }) => ({ ...v, r: v.n + 1 });
      expect(await both(Real, { n: 0, r: 0 }, none, sum)).toStrictEqual(["proven", ""]);
      expect(from(Real, { n: MAX, r: 0 }, none, sum, {})).toBe("ok");
    },
    LONG,
  );
});

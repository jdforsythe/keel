// Each construct of the fragment as a pair (k.prove Fragment, Obligations): a transaction that keeps its schema and
// invariant proves, and its twin, the same code with the one construct changed so that it breaks them, rejects E1716.
// The functions are compiled from text, so each source is the text shown.
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { describe, expect, it } from "vitest";

const LONG = 120_000;
let seq = 0;
const isStep = <T, P>(f: unknown): f is (state: T, p: P) => T => typeof f === "function";
const isCheck = <T>(f: unknown): f is (state: T) => boolean => typeof f === "function";
/** One transaction whose body is `body` (over `state` and `p`), on a store of `schema` under the invariant bodies. */
const one = <T extends object, P>(
  schema: Schema<T>,
  initial: T,
  invariants: readonly string[],
  pay: Schema<P>,
  body: string,
): Transaction<T, P> => {
  seq += 1;
  let out: { value: Transaction<T, P> } | undefined;
  scope(
    () => {
      const st = store(schema, initial, { id: `pq${seq}` });
      for (const text of invariants) {
        const check: unknown = new Function("state", text);
        if (!isCheck<T>(check)) throw new Error("fixture: not a function");
        invariant(st, check);
      }
      const step: unknown = new Function("state", "p", body);
      if (!isStep<T, P>(step)) throw new Error("fixture: not a function");
      out = { value: transaction(st, `pq${seq}.t`, pay, step) };
    },
    { detached: true },
  );
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};
/** `proven`, or the rejection's code (its message when it has none) with its data. */
const outcome = async <T, P>(t: Transaction<T, P>): Promise<{ code: string; data: unknown }> => {
  try {
    await prove([t]);
    return { code: "proven", data: undefined };
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    return { code: String(Reflect.get(e, "code") ?? e.message), data: Reflect.get(e, "data") };
  }
};
const code = async <T, P>(t: Transaction<T, P>): Promise<string> => (await outcome(t)).code;
const none = s.object({});
const TRUE = ["return true;"];

describe("prove: arithmetic, comparison and negation", () => {
  it(
    "a sum inside a callback is held for every item: within the safe range proves, one past it is E1716",
    async () => {
      const Xs = s.object({ xs: s.array(s.int()) });
      const xs = (item: string) => one(Xs, { xs: [] }, TRUE, none, `return { xs: state.xs.map((x) => ${item}) };`);
      const edge = { code: "E1716", data: { state: { xs: [Number.MAX_SAFE_INTEGER] } } };
      expect(await code(xs("(x > 0 && x < 100 ? x : 0) + 1"))).toBe("proven");
      expect(await outcome(xs("(x > 0 ? x : 0) + 1"))).toMatchObject(edge);
      // A sum that is compared and not written may reach 2^53, which is exact, and no further.
      expect(await code(xs("(x > 0 ? x : 0) + 1 > 5 ? 0 : x"))).toBe("proven");
      expect(await outcome(xs("(x > 0 ? x : 0) + 2 > 5 ? 0 : x"))).toMatchObject(edge);
    },
    LONG,
  );

  it(
    "* takes a literal on either side, negative too; a larger factor breaks the bound",
    async () => {
      const N = s.object({ n: s.int({ min: 0, max: 100 }) });
      const pay = s.object({
        k: s.int({ min: 0, max: 50 }),
        j: s.int({ min: -100, max: 0 }),
        f: s.boolean(),
        g: s.boolean(),
        h: s.boolean(),
      });
      const body = (left: string): string => `return { n: p.f ? p.k * 2 : p.g ? ${left} : p.h ? p.j * -1 : -1 * p.j };`;
      expect(await code(one(N, { n: 0 }, TRUE, pay, body("2 * p.k")))).toBe("proven");
      expect(await outcome(one(N, { n: 0 }, TRUE, pay, body("3 * p.k")))).toMatchObject({
        code: "E1716",
        data: { payload: { f: false, g: true } },
      });
    },
    LONG,
  );

  it(
    "unary minus negates an integer and a number literal",
    async () => {
      const St = s.object({ n: s.int({ min: 0 }), r: s.number({ min: -1, max: 1 }) });
      const pay = s.object({ k: s.int({ max: 0 }), f: s.boolean() });
      expect(await code(one(St, { n: 0, r: 0 }, TRUE, pay, "return { n: -p.k, r: p.f ? 0.5 : -0.5 };"))).toBe("proven");
      expect(
        await outcome(one(St, { n: 0, r: 0 }, TRUE, pay, "return { n: -p.k, r: p.f ? 0.5 : -1.5 };")),
      ).toMatchObject({ code: "E1716", data: { payload: { f: false } } });
      const wide = s.object({ k: s.int({ max: 1 }), f: s.boolean() });
      expect(
        await outcome(one(St, { n: 0, r: 0 }, TRUE, wide, "return { n: -p.k, r: p.f ? 0.5 : -0.5 };")),
      ).toMatchObject({ code: "E1716", data: { payload: { k: 1 } } });
    },
    LONG,
  );

  it(
    "an integer and a number compare by value, with === and with an order; an integer goes into a number field",
    async () => {
      const N = s.object({ n: s.int({ min: 0 }) });
      const pay = s.object({ k: s.int(), x: s.number({ min: 0 }) });
      const inv = ["return state.n >= 0;"];
      const guarded = one(
        N,
        { n: 0 },
        inv,
        pay,
        "return p.k === p.x || p.x === p.k || p.k >= p.x ? { n: p.k } : state;",
      );
      expect(await code(guarded)).toBe("proven");
      const equal = one(N, { n: 0 }, inv, pay, "return p.k === p.x && p.x === p.k ? { n: p.k - 1 } : state;");
      expect(await outcome(equal)).toMatchObject({ code: "E1716", data: { payload: { k: 0, x: 0 } } });
      const below = one(N, { n: 0 }, inv, pay, "return p.k <= p.x ? { n: p.k } : state;");
      expect(await code(below)).toBe("E1716");
      const unequal = one(N, { n: 0 }, inv, pay, "return p.k !== p.x ? { n: p.k } : state;");
      expect(await code(unequal)).toBe("E1716");
      const St = s.object({ r: s.number({ min: 0 }), n: s.int({ min: 0 }) });
      expect(await code(one(St, { r: 0, n: 0 }, TRUE, none, "return { ...state, r: state.n };"))).toBe("proven");
      const any = s.object({ k: s.int() });
      expect(await code(one(St, { r: 0, n: 0 }, TRUE, any, "return { ...state, r: p.k };"))).toBe("E1716");
    },
    LONG,
  );
});

describe("prove: undefined and null", () => {
  const St = s.object({
    o: s.int().optional(),
    z: s.int().nullable(),
    w: s.int().nullable().optional(),
    n: s.int({ min: 0 }),
  });
  const inv = ["return state.n >= 0;"];
  const when = (test: string) => one(St, { z: null, n: 0 }, inv, none, `return ${test} ? { ...state, n: -1 } : state;`);

  it(
    "a comparison that never holds leaves its branch unreached",
    async () => {
      const never = [
        "undefined === null",
        "null === undefined",
        "undefined !== undefined",
        "null !== null",
        "state.n === undefined",
        "state.n === null",
        "undefined === state.n",
        "state.o === null",
        "null === state.o",
        "state.z === undefined",
        "undefined === state.z",
        "(state.w === null && state.w === undefined)",
      ];
      expect(await code(when(never.join(" || ")))).toBe("proven");
    },
    LONG,
  );

  it(
    "a comparison that holds reaches its branch, with the absent and the null value in the counterexample",
    async () => {
      const always = "undefined === undefined && null === null && state.n !== undefined && state.n !== null";
      expect(await code(when(always))).toBe("E1716");
      const absent = "state.o === undefined && undefined === state.o && state.z === null && null === state.z";
      const got = await outcome(when(`${absent} && state.w === null`));
      expect(got.code).toBe("E1716");
      expect(Reflect.get(Object(got.data), "state")).toStrictEqual({ z: null, w: null, n: expect.any(Number) });
      const gone = await outcome(when("state.w === undefined && state.z !== null && state.o !== undefined"));
      expect(gone.code).toBe("E1716");
      expect(Reflect.get(Object(gone.data), "state")).toStrictEqual({
        o: expect.any(Number),
        z: expect.any(Number),
        n: expect.any(Number),
      });
    },
    LONG,
  );

  it(
    "an optional equals a value only when present, on either side",
    async () => {
      const Hit = s.object({ o: s.int().optional(), hit: s.boolean() });
      const pay = s.object({ n: s.int() });
      const present = ["return !state.hit || state.o !== undefined;"];
      const mark = (test: string) =>
        one(Hit, { hit: false }, present, pay, `return ${test} ? { ...state, hit: true } : { ...state, hit: false };`);
      expect(await code(mark("state.o === p.n || p.n === state.o"))).toBe("proven");
      expect(await outcome(mark("state.o !== p.n"))).toMatchObject({ code: "E1716", data: { state: { hit: false } } });
      expect(await code(mark("p.n !== state.o"))).toBe("E1716");
      const off = ["return !state.hit;"];
      const both = one(
        Hit,
        { hit: false },
        off,
        pay,
        "return state.o === p.n && p.n === state.o ? { ...state, hit: true } : state;",
      );
      expect(await code(both)).toBe("E1716");
    },
    LONG,
  );

  it(
    "a conditional with undefined on one side is an option of the other side",
    async () => {
      const St2 = s.object({ o: s.int({ min: 0 }).optional(), n: s.int({ min: 0 }) });
      const pay = s.object({ f: s.boolean() });
      const body = (x: string, y: string): string =>
        `const x = p.f ? state.o : undefined; const y = p.f ? undefined : state.o; return x === undefined ? (y === undefined ? state : { ...state, n: ${y} }) : { ...state, n: ${x} };`;
      expect(await code(one(St2, { n: 0 }, TRUE, pay, body("x", "y")))).toBe("proven");
      expect(await outcome(one(St2, { n: 0 }, TRUE, pay, body("x - 1", "y")))).toMatchObject({
        code: "E1716",
        data: { state: { o: 0 }, payload: { f: true } },
      });
      expect(await outcome(one(St2, { n: 0 }, TRUE, pay, body("x", "y - 1")))).toMatchObject({
        code: "E1716",
        data: { state: { o: 0 }, payload: { f: false } },
      });
    },
    LONG,
  );
});

describe("prove: statements", () => {
  const N = s.object({ n: s.int({ min: 0 }) });
  const pay = s.object({ d: s.int({ min: 0 }) });
  const inv = ["return state.n >= 0;"];

  it(
    "an if without an else, and a nested if that does not return, fall to the statements after, past a directive",
    async () => {
      const guarded = one(
        N,
        { n: 0 },
        inv,
        pay,
        '"use strict"; if (p.d > state.n) return state; return { n: state.n - p.d };',
      );
      expect(await code(guarded)).toBe("proven");
      const late = one(N, { n: 0 }, inv, pay, "if (p.d > state.n + 1) return state; return { n: state.n - p.d };");
      expect(await code(late)).toBe("E1716");
      const body = (inner: string): string =>
        `if (p.d > 0) { if (${inner}) return state; } else { return state; } return { n: state.n - p.d };`;
      expect(await code(one(N, { n: 0 }, inv, pay, body("p.d > state.n")))).toBe("proven");
      expect(await code(one(N, { n: 0 }, inv, pay, body("p.d > state.n + 1")))).toBe("E1716");
    },
    LONG,
  );
});

describe("prove: objects and maps", () => {
  it(
    "an object literal fills an optional object field; a field left out is absent; an empty object is a value; a quoted key names its field",
    async () => {
      const St = s.object({
        o: s.object({ n: s.int({ min: 0 }) }).optional(),
        e: s.object({}),
        w: s.int().optional(),
        k: s.int(),
      });
      const pay = s.object({ k: s.int({ min: 0 }) });
      const inv = ["return state.w === undefined;"];
      const start = { e: {}, k: 0 };
      expect(await code(one(St, start, inv, pay, "return { o: { n: p.k }, e: {}, k: 0 };"))).toBe("proven");
      expect(await code(one(St, start, inv, pay, "return { o: { n: p.k - 1 }, e: {}, k: 0 };"))).toBe("E1716");
      expect(await code(one(St, start, inv, pay, "return { o: { n: p.k }, e: {}, k: 0, w: p.k };"))).toBe("E1716");
      const N = s.object({ n: s.int({ min: 0 }) });
      expect(await code(one(N, { n: 0 }, TRUE, none, 'return { "n": state.n > 0 ? state.n - 1 : 0 };'))).toBe("proven");
      expect(await code(one(N, { n: 0 }, TRUE, none, 'return { "n": state.n - 1 };'))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a map literal holds the keys written, by name, in quotes, as a number or computed, and no other",
    async () => {
      const M = s.object({ m: s.record(s.int({ min: 0, max: 9 })) });
      const pay = s.object({ k: s.enum(["b", "c"]), x: s.int({ min: 0, max: 9 }) });
      const inv = ['return state.m["a"] === undefined;'];
      expect(await code(one(M, { m: {} }, inv, pay, "return { m: {} };"))).toBe("proven");
      expect(await code(one(M, { m: {} }, inv, pay, 'return { m: { [p.k]: p.x, b: 1, "c": 2, 7: 3 } };'))).toBe(
        "proven",
      );
      expect(await outcome(one(M, { m: {} }, inv, pay, "return { m: { [p.k]: p.x, a: 1 } };"))).toMatchObject({
        code: "E1716",
        data: { state: { m: {} } },
      });
      expect(await code(one(M, { m: {} }, inv, pay, 'return { m: { "a": p.x } };'))).toBe("E1716");
      expect(await code(one(M, { m: {} }, inv, pay, "return { m: { b: p.x + 1 } };"))).toBe("E1716");
      const wide = s.object({ k: s.enum(["a", "b"]), x: s.int({ min: 0, max: 9 }) });
      expect(await outcome(one(M, { m: {} }, inv, wide, "return { m: { [p.k]: p.x } };"))).toMatchObject({
        code: "E1716",
        data: { payload: { k: "a" } },
      });
    },
    LONG,
  );

  it(
    "a map key written is none of __proto__, constructor and prototype: each one left unguarded is the counterexample",
    async () => {
      const M = s.object({ m: s.record(s.int({ min: 0, max: 9 })) });
      const pay = s.object({ k: s.string(), x: s.int({ min: 0, max: 9 }) });
      const names = ["__proto__", "constructor", "prototype"];
      const body = (guarded: readonly string[]): string =>
        `return ${["false", ...guarded.map((n) => `p.k === "${n}"`)].join(" || ")} ? state : { m: { ...state.m, [p.k]: p.x } };`;
      expect(await code(one(M, { m: {} }, TRUE, pay, body(names)))).toBe("proven");
      for (const name of names) {
        const t = one(M, { m: {} }, TRUE, pay, body(names.filter((n) => n !== name)));
        expect(await outcome(t)).toMatchObject({ code: "E1716", data: { payload: { k: name } } });
      }
    },
    LONG,
  );

  it(
    "a map read of a key the schema names proves; of any string, a name of Object.prototype is the counterexample",
    async () => {
      const M = s.object({ m: s.record(s.int({ min: 0, max: 9 })), n: s.int({ min: 0, max: 9 }) });
      const body = "const c = state.m[p.k]; return c === undefined ? state : { ...state, n: c };";
      expect(await code(one(M, { m: {}, n: 0 }, TRUE, s.object({ k: s.enum(["a", "b"]) }), body))).toBe("proven");
      const got = await outcome(one(M, { m: {}, n: 0 }, TRUE, s.object({ k: s.string() }), body));
      expect(got.code).toBe("E1716");
      const k: unknown = Reflect.get(Object(Reflect.get(Object(got.data), "payload")), "k");
      expect(Object.getOwnPropertyNames(Object.prototype)).toContain(k);
    },
    LONG,
  );
});

describe("prove: arrays and sets", () => {
  it(
    "an array literal fills an optional array field, item by item",
    async () => {
      const Xs = s.object({ xs: s.array(s.int({ min: 0 })).optional() });
      const pay = s.object({ k: s.int({ min: 0 }), j: s.int() });
      expect(await code(one(Xs, {}, TRUE, pay, "return { xs: [p.k, 0] };"))).toBe("proven");
      expect(await code(one(Xs, {}, TRUE, pay, "return { xs: [p.k, p.j] };"))).toBe("E1716");
    },
    LONG,
  );

  it(
    "a spread after items or another spread keeps both, in order",
    async () => {
      const St = s.object({ xs: s.array(s.int({ min: 0 })), n: s.int({ min: 5 }) });
      const pay = s.object({ ys: s.array(s.int({ min: 5 })), k: s.int() });
      const start = { xs: [], n: 5 };
      const at = (i: string): string =>
        `const all = [...state.xs, ...p.ys]; const x = all[${i}]; return x === undefined ? state : { ...state, n: x };`;
      expect(await code(one(St, start, TRUE, pay, at("state.xs.length")))).toBe("proven");
      expect(await code(one(St, start, TRUE, pay, at("0")))).toBe("E1716");
      expect(await code(one(St, start, TRUE, pay, at("state.xs.length - 1")))).toBe("E1716");
      const pre = "return p.k < 0 ? state : { ...state, xs: [p.k, ...state.xs] };";
      expect(await code(one(St, start, TRUE, pay, pre))).toBe("proven");
      expect(await outcome(one(St, start, TRUE, pay, "return { ...state, xs: [p.k, ...state.xs] };"))).toMatchObject({
        code: "E1716",
        data: { state: { xs: [] } },
      });
    },
    LONG,
  );

  it(
    "an array literal bound to a name takes the sort of its first item or spread",
    async () => {
      const N = s.object({ n: s.int({ min: 0 }) });
      const pay = s.object({ a: s.int(), b: s.int() });
      const pair = (method: string): string =>
        `const pair = [p.a, p.b]; return pair.${method}((x) => x >= 0) ? { n: p.a } : state;`;
      expect(await code(one(N, { n: 0 }, TRUE, pay, pair("every")))).toBe("proven");
      expect(await code(one(N, { n: 0 }, TRUE, pay, pair("some")))).toBe("E1716");
      const Xs = s.object({ xs: s.array(s.int({ min: 0 })) });
      const more = (method: string): string =>
        `const all = [...state.xs, p.a]; return all.${method}((x) => x >= 0) ? { xs: all } : state;`;
      expect(await code(one(Xs, { xs: [] }, TRUE, pay, more("every")))).toBe("proven");
      expect(await code(one(Xs, { xs: [] }, TRUE, pay, more("some")))).toBe("E1716");
    },
    LONG,
  );

  it(
    "map fills an optional array field of objects",
    async () => {
      const Xs = s.object({ xs: s.array(s.object({ n: s.int({ min: 0 }) })).optional() });
      const pay = s.object({ ys: s.array(s.int({ min: 0 })) });
      expect(await code(one(Xs, {}, TRUE, pay, "return { xs: p.ys.map((y) => ({ n: y })) };"))).toBe("proven");
      expect(await code(one(Xs, {}, TRUE, pay, "return { xs: p.ys.map((y) => ({ n: y - 1 })) };"))).toBe("E1716");
    },
    LONG,
  );

  it(
    "find inside a callback, and inside two, picks its item for each item of the outer arrays",
    async () => {
      const St = s.object({
        lists: s.array(s.object({ id: s.string(), n: s.int({ min: 0 }) })),
        todos: s.array(s.object({ list: s.string(), n: s.int({ min: 0 }) })),
      });
      const body = (n: string): string =>
        `return { ...state, todos: state.todos.map((t) => { const l = state.lists.find((x) => x.id === t.list); return l === undefined ? t : { ...t, n: ${n} }; }) };`;
      expect(await code(one(St, { lists: [], todos: [] }, TRUE, none, body("l.n")))).toBe("proven");
      expect(await code(one(St, { lists: [], todos: [] }, TRUE, none, body("l.n - 1")))).toBe("E1716");
      const worse = '{ ...state, todos: [...state.todos, { list: "", n: -1 }] }';
      const twice = (hit: string, miss: string): string =>
        `return state.todos.every((t) => state.lists.every((l) => { const hit = state.lists.find((x) => x.id === t.list && x.n >= l.n); return hit === undefined || hit.n >= 0; })) ? ${hit} : ${miss};`;
      expect(await code(one(St, { lists: [], todos: [] }, TRUE, none, twice("state", worse)))).toBe("proven");
      expect(await outcome(one(St, { lists: [], todos: [] }, TRUE, none, twice(worse, "state")))).toMatchObject({
        code: "E1716",
        data: { state: { todos: [] } },
      });
    },
    LONG,
  );

  it(
    "find in two invariants and twice in the transaction",
    async () => {
      const Xs = s.object({ xs: s.array(s.int()) });
      const pay = s.object({ k: s.int() });
      const inv = [
        "return state.xs.find((x) => x < 0) === undefined;",
        "return state.xs.find((x) => x > 9) === undefined;",
      ];
      const body = (item: string): string =>
        `const hit = state.xs.find((x) => x === p.k); const low = state.xs.find((x) => x < 5); return hit === undefined || low === undefined ? state : { xs: [...state.xs, ${item}, low] };`;
      expect(await code(one(Xs, { xs: [] }, inv, pay, body("hit")))).toBe("proven");
      expect(await code(one(Xs, { xs: [] }, inv, pay, body("hit + 1")))).toBe("E1716");
    },
    LONG,
  );

  it(
    "distinct values hold with the length on the left and with !==",
    async () => {
      const Xs = s.object({ xs: s.array(s.string()) });
      const pay = s.object({ x: s.string() });
      const inv = [
        "return state.xs.length === new Set(state.xs).size;",
        "return !(new Set(state.xs).size !== state.xs.length);",
      ];
      const guarded = "return new Set(state.xs).has(p.x) ? state : { xs: [...state.xs, p.x] };";
      expect(await code(one(Xs, { xs: [] }, inv, pay, guarded))).toBe("proven");
      expect(await code(one(Xs, { xs: [] }, inv, pay, "return { xs: [...state.xs, p.x] };"))).toBe("E1716");
      expect(await code(one(Xs, { xs: [] }, [inv[0] ?? ""], pay, "return { xs: [...state.xs, p.x] };"))).toBe("E1716");
      expect(await code(one(Xs, { xs: [] }, [inv[1] ?? ""], pay, "return { xs: [...state.xs, p.x] };"))).toBe("E1716");
    },
    LONG,
  );
});

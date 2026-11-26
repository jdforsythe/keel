// The sorts `prove` gives the schemas (k.prove Sorts) and the values a counterexample shows: literals, bounds inside an
// option, a number past the safe integers, an integer of the post-state held within the safe range wherever the schema
// puts it, an array's greatest length, strings under a length rule inside a container, and the JSON of a model.
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
  initial: NoInfer<T>,
  invariants: readonly string[],
  pay: Schema<P>,
  body: string,
): Transaction<T, P> => {
  seq += 1;
  let out: { value: Transaction<T, P> } | undefined;
  scope(
    () => {
      const st = store(schema, initial, { id: `pt${seq}` });
      for (const text of invariants) {
        const check: unknown = new Function("state", text);
        if (!isCheck<T>(check)) throw new Error("fixture: not a function");
        invariant(st, check);
      }
      const step: unknown = new Function("state", "p", body);
      if (!isStep<T, P>(step)) throw new Error("fixture: not a function");
      out = { value: transaction(st, `pt${seq}.t`, pay, step) };
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
/** The first line of the rejection's message without the transaction's name, or `proven`. */
const line = async <T, P>(t: Transaction<T, P>): Promise<string> => {
  try {
    await prove([t]);
    return "proven";
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    return (e.message.split("\n")[0] ?? "").slice(t.name.length + 1);
  }
};
const SAFE_LINE = "leaves the safe integer range from this state; bound the schema or guard it";
const SCHEMA_LINE = "breaks the schema or an invariant from this state; it may be unreachable";
/** The payload of a counterexample. */
const payloadOf = (got: { data: unknown }): unknown => Reflect.get(Object(got.data), "payload");
const none = s.object({});
const TRUE = ["return true;"];

describe("prove: sorts", () => {
  it(
    "a literal is its one value, before and after: a string, true, false, an integer and a number",
    async () => {
      const Lit = s.object({
        on: s.literal("on"),
        yes: s.literal(true),
        no: s.literal(false),
        three: s.literal(3),
        half: s.literal(0.5),
        n: s.int({ min: 4, max: 4 }),
      });
      const pay = s.object({ s: s.enum(["on", "off"]), b: s.boolean(), k: s.int(), x: s.number() });
      const lit = (body: string) =>
        one(Lit, { on: "on", yes: true, no: false, three: 3, half: 0.5, n: 4 }, TRUE, pay, body);
      const known =
        'return state.half < 1 && state.half > 0 && state.three === 3 && state.yes && !state.no && state.on === "on" ? { ...state, n: state.three + 1 } : { ...state, n: 0 };';
      expect(await code(lit(known))).toBe("proven");
      const kept =
        'return p.s === "on" && p.b && p.k === 3 && p.x === 0.5 ? { ...state, on: p.s, yes: p.b, no: !p.b, three: p.k, half: p.x } : state;';
      expect(await code(lit(kept))).toBe("proven");
      const put = (field: string) => outcome(lit(`return { ...state, ${field} };`));
      expect(payloadOf(await put("on: p.s"))).toMatchObject({ s: "off" });
      expect(payloadOf(await put("yes: p.b"))).toMatchObject({ b: false });
      expect(payloadOf(await put("no: p.b"))).toMatchObject({ b: true });
      expect((await put("three: p.k")).code).toBe("E1716");
      expect((await put("half: p.x")).code).toBe("E1716");
    },
    LONG,
  );

  it(
    "the bounds of an optional and of a nullable integer hold when it is present",
    async () => {
      const Opt = s.object({ o: s.int({ min: 0 }).optional(), z: s.int({ max: 9 }).nullable() });
      const any = s.object({ k: s.int() });
      const start = { z: null };
      expect(
        await code(one(Opt, start, TRUE, s.object({ k: s.int({ min: 0 }) }), "return { ...state, o: p.k };")),
      ).toBe("proven");
      expect(await code(one(Opt, start, TRUE, any, "return { ...state, o: p.k };"))).toBe("E1716");
      expect(
        await code(one(Opt, start, TRUE, s.object({ k: s.int({ max: 9 }) }), "return { ...state, z: p.k };")),
      ).toBe("proven");
      expect(await code(one(Opt, start, TRUE, any, "return { ...state, z: p.k };"))).toBe("E1716");
    },
    LONG,
  );

  it(
    "an integer of the state is within the safe range; a number is not",
    async () => {
      const big = "9007199254740991";
      const inv = ["return state.ok;"];
      const Int = s.object({ v: s.int(), ok: s.boolean() });
      const body = `return state.v > ${big} ? { ...state, ok: false } : state;`;
      expect(await code(one(Int, { v: 0, ok: true }, inv, none, body))).toBe("proven");
      const Real = s.object({ v: s.number(), ok: s.boolean() });
      expect(await code(one(Real, { v: 0, ok: true }, inv, none, body))).toBe("E1716");
      const Capped = s.object({ v: s.number({ max: 100 }), ok: s.boolean() });
      expect(await code(one(Capped, { v: 0, ok: true }, inv, none, body))).toBe("proven");
    },
    LONG,
  );

  it(
    "an integer of the post-state is within the safe range at every depth: a sum past it is E1716 at the edge",
    async () => {
      const MAX = Number.MAX_SAFE_INTEGER;
      const up = s.int({ min: 0 });
      /** The state of the counterexample of `body`, which must leave the safe range and nothing else. */
      const edge = async <T extends object>(schema: Schema<T>, initial: NoInfer<T>, body: string): Promise<unknown> => {
        expect(await line(one(schema, initial, TRUE, none, body))).toBe(SAFE_LINE);
        const got = await outcome(one(schema, initial, TRUE, none, body));
        expect(got.code).toBe("E1716");
        return Reflect.get(Object(got.data), "state");
      };
      const field = s.object({ n: up });
      expect(await edge(field, { n: 0 }, "return { n: state.n + 1 };")).toStrictEqual({ n: MAX });
      const down = s.object({ n: s.int({ max: 0 }) });
      expect(await edge(down, { n: 0 }, "return { n: state.n - 1 };")).toStrictEqual({ n: -MAX });
      const inner = s.object({ o: s.object({ p: s.object({ n: up }) }) });
      expect(await edge(inner, { o: { p: { n: 0 } } }, "return { o: { p: { n: state.o.p.n + 1 } } };")).toStrictEqual({
        o: { p: { n: MAX } },
      });
      const optional = s.object({ n: up.optional() });
      const absent = "return state.n === undefined ? { n: 0 } : { n: state.n + 1 };";
      expect(await edge(optional, {}, absent)).toStrictEqual({ n: MAX });
      const nullable = s.object({ n: up.nullable() });
      const nul = "return state.n === null ? state : { n: state.n + 1 };";
      expect(await edge(nullable, { n: null }, nul)).toStrictEqual({ n: MAX });
      const items = s.object({ a: s.array(up) });
      expect(await edge(items, { a: [] }, "return { a: state.a.map((v) => v + 1) };")).toStrictEqual({ a: [MAX] });
      const rows = s.object({ a: s.array(s.object({ n: up })) });
      expect(await edge(rows, { a: [] }, "return { a: state.a.map((x) => ({ n: x.n + 1 })) };")).toStrictEqual({
        a: [{ n: MAX }],
      });
      // The search bounds the state's own arrays, so an array inside one may hold the edge past the items shown.
      const nested = s.object({ a: s.array(s.array(up)) });
      const each = "return { a: state.a.map((xs) => xs.map((v) => v + 1)) };";
      expect(await line(one(nested, { a: [] }, TRUE, none, each))).toBe(SAFE_LINE);
      // A map prints as `{}`, so its counterexample shows the key in the payload and no value.
      const map = one(
        s.object({ c: s.record(up) }),
        { c: {} },
        TRUE,
        s.object({ k: s.enum(["a", "b"]) }),
        "const cur = state.c[p.k]; return cur === undefined ? state : { c: { ...state.c, [p.k]: cur + 1 } };",
      );
      expect(await line(map)).toBe(SAFE_LINE);
    },
    LONG,
  );

  it(
    "a guard at the edge proves at every depth; a literal is held too, and a number takes a sum",
    async () => {
      const up = s.int({ min: 0 });
      const proven = <T extends object>(schema: Schema<T>, initial: NoInfer<T>, body: string): Promise<string> =>
        line(one(schema, initial, TRUE, none, body));
      const next = (v: string): string => `(${v} < 9007199254740991 ? ${v} + 1 : ${v})`;
      expect(await proven(s.object({ n: up }), { n: 0 }, `return { n: ${next("state.n")} };`)).toBe("proven");
      expect(
        await proven(s.object({ n: up }), { n: 0 }, "return { n: state.n < 9007199254740992 ? state.n + 1 : 0 };"),
      ).toBe(SAFE_LINE);
      const optional = s.object({ n: up.optional() });
      const absent = `return state.n === undefined ? { n: 0 } : { n: ${next("state.n")} };`;
      expect(await proven(optional, {}, absent)).toBe("proven");
      const nullable = s.object({ n: up.nullable() });
      expect(await proven(nullable, { n: null }, `return state.n === null ? state : { n: ${next("state.n")} };`)).toBe(
        "proven",
      );
      const items = s.object({ a: s.array(up) });
      expect(await proven(items, { a: [] }, `return { a: state.a.map((v) => ${next("v")}) };`)).toBe("proven");
      const rows = s.object({ a: s.array(s.object({ n: up })) });
      expect(await proven(rows, { a: [] }, `return { a: state.a.map((x) => ({ n: ${next("x.n")} })) };`)).toBe(
        "proven",
      );
      const any = s.object({ n: s.int() });
      expect(await proven(any, { n: 0 }, "return { n: 9007199254740991 };")).toBe("proven");
      expect(await proven(any, { n: 0 }, "return { n: 9007199254740992 };")).toBe(SAFE_LINE);
      expect(await proven(any, { n: 0 }, "return { n: -9007199254740991 };")).toBe("proven");
      expect(await proven(any, { n: 0 }, "return { n: -9007199254740992 };")).toBe(SAFE_LINE);
      // A sum that reaches 2^53 is exact; the state takes it back inside the range, or holds it as a number.
      expect(await proven(any, { n: 0 }, "return { n: state.n + 1 - 1 };")).toBe("proven");
      const real = s.object({ n: s.int(), r: s.number() });
      expect(await proven(real, { n: 0, r: 0 }, "return { ...state, r: state.n + 1 };")).toBe("proven");
      expect(await proven(real, { n: 0, r: 0 }, "return { ...state, r: state.n + 1 + 1 };")).toBe(SAFE_LINE);
    },
    LONG,
  );

  it(
    "a bound of the schema or an invariant that breaks is reported under its own line, before an integer range",
    async () => {
      const Capped = s.object({ n: s.int({ min: 0, max: 9 }), m: s.int() });
      const start = { n: 0, m: 0 };
      const got = await outcome(one(Capped, start, TRUE, none, "return { n: state.n + 1, m: state.m + 1 };"));
      expect(got).toMatchObject({ code: "E1716", data: { state: { n: 9 } } });
      expect(await line(one(Capped, start, TRUE, none, "return { n: state.n + 1, m: state.m + 1 };"))).toBe(
        SCHEMA_LINE,
      );
      const guarded = "return { n: state.n < 9 ? state.n + 1 : state.n, m: state.m + 1 };";
      const held = one(Capped, start, ["return state.n <= 5;"], none, guarded);
      expect(await outcome(held)).toMatchObject({ code: "E1716", data: { state: { n: 5 } } });
      expect(await line(one(Capped, start, ["return state.n <= 5;"], none, guarded))).toBe(SCHEMA_LINE);
      expect(await line(one(Capped, start, ["return state.n <= 9;"], none, guarded))).toBe(SAFE_LINE);
      // An obligation that is no integer range keeps the schema line: an index read past the length.
      const Xs = s.object({ xs: s.array(s.int()), m: s.int() });
      const read = one(Xs, { xs: [], m: 0 }, TRUE, none, "return { ...state, m: state.xs[0] + 1 };");
      expect(await line(read)).toBe(SCHEMA_LINE);
    },
    LONG,
  );

  it(
    "an array of the state or the payload holds at most 2^32 - 1 items, so a length is a safe integer",
    async () => {
      const Count = s.object({ items: s.array(s.string()), count: s.int({ min: 0 }), ok: s.boolean() });
      const start = { items: [], count: 0, ok: true };
      const pay = s.object({ v: s.string(), vs: s.array(s.string()) });
      const count = (body: string) => one(Count, start, ["return state.ok;"], pay, body);
      expect(await line(count("return { ...state, count: state.items.length };"))).toBe("proven");
      expect(
        await line(count("return { ...state, items: [...state.items, p.v], count: state.items.length + 1 };")),
      ).toBe("proven");
      expect(await line(count("return { ...state, count: state.items.length + p.vs.length };"))).toBe("proven");
      const over = (length: string, most: string): string =>
        `return ${length} > ${most} ? { ...state, ok: false } : state;`;
      expect(await line(count(over("state.items.length", "4294967295")))).toBe("proven");
      expect(await line(count(over("state.items.length", "4294967294")))).toBe(SCHEMA_LINE);
      expect(await line(count(over("p.vs.length", "4294967295")))).toBe("proven");
      expect(await line(count(over("p.vs.length", "4294967294")))).toBe(SCHEMA_LINE);
      // The post-state's own arrays take one more item than the state's.
      expect(await line(count("return { ...state, items: [...state.items, p.v, ...p.vs] };"))).toBe("proven");
    },
    LONG,
  );

  it(
    "arrays, options and maps of different items are different sorts",
    async () => {
      const Mixed = s.object({
        a: s.array(s.int()),
        b: s.array(s.boolean()),
        c: s.int().optional(),
        d: s.boolean().optional(),
        e: s.record(s.int()),
        f: s.record(s.boolean()),
        g: s.object({ v: s.int() }),
        h: s.object({ v: s.boolean() }),
      });
      const start = { a: [], b: [], e: {}, f: {}, g: { v: 0 }, h: { v: false } };
      const body =
        "return { a: [...state.a, 1], b: [...state.b, true], c: 1, d: true, e: { ...state.e, k: 1 }, f: { ...state.f, k: true }, g: { v: 1 }, h: { v: true } };";
      expect(await code(one(Mixed, start, TRUE, none, body))).toBe("proven");
    },
    LONG,
  );

  it(
    "a string takes a literal, a string without a rule and a string under one; a container keeps its items' rule",
    async () => {
      const Label = s.object({ label: s.string(), tag: s.string({ min: 1 }) });
      const pay = s.object({ free: s.string(), f: s.boolean(), g: s.boolean() });
      const body = 'return { ...state, label: p.f ? state.tag : p.g ? p.free : "x" };';
      expect(await code(one(Label, { label: "", tag: "t" }, TRUE, pay, body))).toBe("proven");
      const refused = async <T extends object, P>(schema: Schema<T>, initial: T, from: Schema<P>, text: string) => {
        const got = await outcome(one(schema, initial, TRUE, from, text));
        return `${got.code} ${String(Reflect.get(Object(got.data), "construct"))}`;
      };
      const Short = s.object({ name: s.string({ max: 3 }) });
      expect(await refused(Short, { name: "" }, s.object({ n: s.string() }), "return { name: p.n };")).toBe(
        "E1715 a string rule",
      );
      const Tags = s.object({ tags: s.array(s.string({ min: 2 })) });
      const looser = s.object({ tags: s.array(s.string({ min: 1 })) });
      expect(await refused(Tags, { tags: [] }, looser, "return { tags: p.tags };")).toBe("E1715 a arr for a arr");
      const Note = s.object({ note: s.string({ min: 2 }).optional(), by: s.record(s.string({ min: 2 })) });
      const loose = s.object({ note: s.string({ min: 1 }).optional(), by: s.record(s.string({ min: 1 })) });
      expect(await refused(Note, { by: {} }, loose, "return { ...state, note: p.note };")).toBe("E1715 a string rule");
      expect(await refused(Note, { by: {} }, loose, "return { ...state, by: p.by };")).toBe("E1715 a rec for a rec");
    },
    LONG,
  );
});

describe("prove: the values of a counterexample", () => {
  const N = s.object({ n: s.int({ min: 0 }) });
  const broken = <P>(pay: Schema<P>, test: string) =>
    outcome(one(N, { n: 0 }, TRUE, pay, `return ${test} ? { n: -1 } : state;`));

  it(
    "a string that is no literal is named a, b, ... in order of appearance, past the names literals hold",
    async () => {
      const pay = s.object({ s: s.string(), t: s.string() });
      const got = await broken(pay, '!(p.s === "a" || p.t === "a" || p.s === p.t)');
      expect(got).toStrictEqual({
        code: "E1716",
        data: { transaction: expect.any(String), state: { n: expect.any(Number) }, payload: { s: "b", t: "c" } },
      });
      const lit = await broken(pay, 'p.s === "a" && p.t === "a"');
      expect(payloadOf(lit)).toStrictEqual({ s: "a", t: "a" });
    },
    LONG,
  );

  it(
    "a number that is no integer, a negative one, a negative integer, true, false, an array's items and a map are shown",
    async () => {
      const pay = s.object({ x: s.number(), y: s.number(), k: s.int() });
      const got = await broken(pay, "p.x > 0.25 && p.x < 0.75 && p.y < -0.25 && p.y > -0.75 && p.k < -5 && p.k > -7");
      expect(got.code).toBe("E1716");
      const x: unknown = Reflect.get(Object(payloadOf(got)), "x");
      const y: unknown = Reflect.get(Object(payloadOf(got)), "y");
      expect(typeof x === "number" && x > 0.25 && x < 0.75).toBe(true);
      expect(typeof y === "number" && y < -0.25 && y > -0.75).toBe(true);
      expect(Reflect.get(Object(payloadOf(got)), "k")).toBe(-6);
      const more = s.object({ b: s.boolean(), c: s.boolean(), xs: s.array(s.int()), m: s.record(s.int()) });
      const shown = await broken(more, "p.b && !p.c && p.xs.length === 2 && p.xs.every((x) => x === 7)");
      expect(payloadOf(shown)).toStrictEqual({ b: true, c: false, xs: [7, 7], m: {} });
    },
    LONG,
  );
});

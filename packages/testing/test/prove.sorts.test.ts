// The sorts `prove` gives the schemas (k.prove Sorts) and the values a counterexample shows: literals, bounds inside an
// option, a number past the safe integers, strings under a length rule inside a container, and the JSON of a model.
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
  scope(() => {
    const st = store(schema, initial, { id: `pt${seq}` });
    for (const text of invariants) {
      const check: unknown = new Function("state", text);
      if (!isCheck<T>(check)) throw new Error("fixture: not a function");
      invariant(st, check);
    }
    const step: unknown = new Function("state", "p", body);
    if (!isStep<T, P>(step)) throw new Error("fixture: not a function");
    out = { value: transaction(st, `pt${seq}.t`, pay, step) };
  });
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

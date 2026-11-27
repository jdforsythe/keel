// What `prove` refuses (k.prove Fragment): each source below is outside the fragment and rejects E1715 naming the
// construct shown, so none of them is translated as something it is not. Then the messages and data of E1710, E1715
// and E1717. The functions are compiled from text, so each source is the text shown.
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { type Transaction, invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const LONG = fixedTime(120_000);
let seq = 0;
const isStep = <T, P>(f: unknown): f is (state: T, p: P) => T => typeof f === "function";
const isCheck = <T>(f: unknown): f is (state: T) => boolean => typeof f === "function";
/** One transaction `step` on a store of `schema` under the invariant `check`. */
const declared = <T extends object, P>(
  schema: Schema<T>,
  initial: T,
  check: unknown,
  pay: Schema<P>,
  step: unknown,
): Transaction<T, P> => {
  seq += 1;
  let out: { value: Transaction<T, P> } | undefined;
  scope(() => {
    const st = store(schema, initial, { id: `pr${seq}` });
    if (!isCheck<T>(check) || !isStep<T, P>(step)) throw new Error("fixture: not a function");
    invariant(st, check);
    out = { value: transaction(st, `pr${seq}.t`, pay, step) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};
const Item = s.object({ n: s.int() });
const State = s.object({
  n: s.int(),
  x: s.number(),
  name: s.string(),
  flag: s.boolean(),
  xs: s.array(s.int()),
  m: s.record(s.int()),
  a: Item,
  o: Item.optional(),
  z: s.int().nullable(),
});
const Payload = s.object({
  k: s.int(),
  x: s.number(),
  s: s.string(),
  f: s.boolean(),
  xs: s.array(s.int()),
  m: s.record(s.int()),
  a: Item,
  o: Item.optional(),
});
const START = { n: 0, x: 0, name: "", flag: false, xs: [], m: {}, a: { n: 0 }, z: null };
/** A transaction whose body is `body`, over `state` (of `State`) and `p` (of `Payload`). */
const one = (body: string, check = "return true;") =>
  declared(State, START, new Function("state", check), Payload, new Function("state", "p", body));
/** What `prove` rejects with: its code, message and data. */
const refusal = async (run: () => Promise<unknown>): Promise<{ code: unknown; message: string; data: unknown }> => {
  try {
    await run();
    return { code: "proven", message: "", data: undefined };
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    return { code: Reflect.get(e, "code"), message: e.message, data: Reflect.get(e, "data") };
  }
};
/** `E1715 <construct>` for each body, or what `prove` did instead. */
const constructs = async (bodies: readonly string[]): Promise<string[]> => {
  const got: string[] = [];
  for (const body of bodies) {
    const r = await refusal(() => prove([one(body)]));
    got.push(
      r.code === "E1715" ? `E1715 ${String(Reflect.get(Object(r.data), "construct"))}` : `${r.code} ${r.message}`,
    );
  }
  return got;
};
/** Each `[body, construct]` row rejects E1715 naming its construct. */
const refuses = async (rows: readonly (readonly [string, string])[]): Promise<void> => {
  expect(await constructs(rows.map(([body]) => body))).toEqual(rows.map(([, construct]) => `E1715 ${construct}`));
};
const same = (test: string): string => `return ${test} ? state : state;`;

describe("prove: values the fragment refuses", () => {
  it(
    "a value of another sort for a field",
    () =>
      refuses([
        ["return { ...state, n: undefined };", "undefined or null"],
        ["return { ...state, n: null };", "undefined or null"],
        ["return { ...state, o: null };", "undefined or null"],
        ["return { ...state, z: undefined };", "undefined or null"],
        ["return { ...state, n: true };", "a bool for a int"],
        ["return { ...state, name: state.n };", "a int for a str"],
        ["return { ...state, n: state.x };", "a real for a int"],
        ["return { ...state, n: 1.5 };", "a real for a int"],
        ["return { ...state, x: state.flag };", "a bool for a real"],
        ["return { ...state, flag: new Set(state.xs) };", "a Set as a value"],
        ["return { ...state, n: {} };", "ObjectExpression"],
        ["return { ...state, n: [1] };", "a arr for a int"],
        ["return { ...state, xs: [1, , 2] };", "ArrayExpression"],
        ["return { ...state, name: `a` };", "TemplateLiteral"],
      ]),
    LONG,
  );

  it(
    "=== on objects, arrays, maps, options of them and Sets; an order or a condition on what is no number or boolean",
    () =>
      refuses([
        [same("state.a === p.a"), "=== on objects"],
        [same("state.xs !== p.xs"), "=== on objects"],
        [same("state.m === p.m"), "=== on objects"],
        [same("state.o === p.o"), "=== on objects"],
        [same("state.a === p.s"), "=== on objects"],
        [same("p.s === state.a"), "=== on objects"],
        [same("new Set(state.xs) === new Set(state.xs)"), "BinaryExpression"],
        [same("p.k === new Set(state.xs)"), "BinaryExpression"],
        [same("p.s === p.k"), "BinaryExpression"],
        [same("p.f === p.k"), "BinaryExpression"],
        [same("p.s < state.name"), "MemberExpression"],
        [same("state.n"), "MemberExpression"],
        [same("!p.s"), "MemberExpression"],
        [same("p.s && p.f"), "MemberExpression"],
        [same("p.f ?? true"), "LogicalExpression"],
        [same("state.n === 1n"), "Literal"],
        [same("/a/ === state.name"), "Literal"],
        ["const x = p.f ? undefined : undefined; return state;", "ConditionalExpression"],
      ]),
    LONG,
  );

  it(
    "arithmetic other than +, - and * by a literal on integers",
    () =>
      refuses([
        ["return { ...state, n: state.n / 2 };", "/ here"],
        ["return { ...state, n: state.n % 2 };", "% here"],
        ["return { ...state, n: state.n ** 2 };", "** here"],
        ["return { ...state, n: p.k * state.n };", "* here"],
        ["return { ...state, x: state.x + 1 };", "+ here"],
        ["return { ...state, x: 1 - state.x };", "- here"],
        ["return { ...state, x: state.x * 2 };", "* here"],
        ["return { ...state, x: -state.x };", "UnaryExpression"],
        ["return { ...state, n: +state.n };", "UnaryExpression"],
      ]),
    LONG,
  );
});

describe("prove: statements, bindings and functions the fragment refuses", () => {
  it(
    "let, var, a destructuring binding, an assignment and a function that returns nothing",
    () =>
      refuses([
        ["let x = state.n; return { ...state, n: x };", "a let binding"],
        ["var x = state.n; return { ...state, n: x };", "a var binding"],
        ["const { n } = state; return { ...state, n };", "VariableDeclarator"],
        ["state.n = 1; return state;", "AssignmentExpression"],
        ["state.xs.push(1); return state;", "CallExpression"],
        ["const x = 1;", "undefined or null"],
        ["if (p.f) return; return state;", "undefined or null"],
        ["if (p.f) return state;", "undefined or null"],
      ]),
    LONG,
  );

  it(
    "calls other than map, some, every and find with one arrow of one parameter, and has on a Set",
    () =>
      refuses([
        ["return { ...state, n: Math.abs(state.n) };", "call to Math.abs"],
        ["return { ...state, n: (Math.abs)(state.n) };", "call to Math.abs"],
        ["return { ...state, n: (0, Math.abs)(state.n) };", "call to Math.abs"],
        ["return { ...state, n: __vite_ssr_import_0__.helper(state.n) };", "call to helper"],
        ["return { ...state, name: p.a.n.toFixed(state.n) };", "call to p.a.n.toFixed"],
        [same('state.xs["some"]((x) => x > 0)'), "call to MemberExpression"],
        [same("state.xs.map((x) => x)() === undefined"), "call to CallExpression"],
        [same("state.xs.some()"), "call to state.xs.some"],
        [same("state.xs.every((x) => x > 0, state)"), "call to state.xs.every"],
        [same("state.xs.some(...state.xs)"), "call to state.xs.some"],
        ["const seen = new Set(state.xs); return seen.delete(p.k) ? state : state;", "call to seen.delete"],
        ["return { ...state, xs: state.xs.filter((x) => x > 0) };", "call to state.xs.filter"],
        [same("state.xs.includes(p.k)"), "call to state.xs.includes"],
        [same("state.xs.findLast((x) => x > 0) === undefined"), "call to state.xs.findLast"],
        [same('p.s.startsWith("a")'), "call to p.s.startsWith"],
        [same("state.xs.some(function (x) { return x > 0; })"), "FunctionExpression"],
        [same("state.xs.some((x, i) => x > 0)"), "ArrowFunctionExpression"],
        [same("state.xs.some(() => true)"), "ArrowFunctionExpression"],
        [same("state.xs.some(p.f)"), "MemberExpression"],
        [same("state.xs.some((x) => x)"), "ArrowFunctionExpression"],
        [same("state.xs.some(async (x) => x < 0)"), "ArrowFunctionExpression"],
        [same("state.xs.every(({ n }) => true)"), "ObjectPattern"],
        [same("state.xs.every((x = 1) => true)"), "AssignmentPattern"],
      ]),
    LONG,
  );

  it(
    "a Set from anything but one array, read by anything but has and size === length of that array",
    () =>
      refuses([
        [same("new Map(state.xs) === undefined"), "new Map"],
        [same("new Set() === undefined"), "new Set"],
        [same("new Set(state.xs, 1) === undefined"), "new Set"],
        [same("new Set(...state.xs) === undefined"), "new Set"],
        [same('new Set(p.s).has("a")'), "MemberExpression"],
        [same("new Set(state.xs).size === p.k"), "Set.size"],
        [same("3 === new Set(state.xs).size"), "Set.size"],
        [same("new Set(state.xs).size === p.xs.length"), "Set.size"],
        [same("new Set(state.xs).length === state.xs.length"), "NewExpression"],
      ]),
    LONG,
  );

  it(
    "property reads and object and array literals outside the fragment",
    () =>
      refuses([
        [same("state[p.s] === undefined"), "MemberExpression"],
        [same("p.s.length === 0"), ".length"],
        [same("state.xs.size === 0"), ".size"],
        [same("state.nope === undefined"), ".nope"],
        [same("state.o?.n === undefined"), "ChainExpression"],
        ["const x = { n: 1 }; return state;", "ObjectExpression"],
        ["const e = []; return state;", "ArrayExpression"],
        ["const e = [, 1]; return state;", "ArrayExpression"],
        ["const e = [...p.s]; return state;", "ArrayExpression"],
        ["return { n: 1 };", "no x"],
        ["return { ...state, [p.s]: 1 };", "Property"],
        ["const n = p.s; return { ...state, [n]: -1 };", "Property"],
        ["return { ...state, get n() { return 1; } };", "Property"],
        ["return { ...state, n() { return 1; } };", "Property"],
        ["return { ...state.m, n: 1 };", "SpreadElement"],
        ["return { ...state, m: { [p.s]: 1, ...state.m } };", "SpreadElement"],
        ["return { ...state, m: { ...state.m, ...p.m } };", "SpreadElement"],
        ["return { ...state, m: { a: 1, ...state } };", "SpreadElement"],
      ]),
    LONG,
  );

  it(
    "an async function, a generator, a class, a method and a bound function",
    async () => {
      const made = (text: string): unknown => new Function(`return ${text};`)();
      const of = (step: unknown) => declared(State, START, () => true, Payload, step);
      const name = async (step: unknown): Promise<unknown> => {
        const t = of(step);
        const r = await refusal(() => prove([t]));
        expect(r.message).toBe(
          `${t.name}: ${String(Reflect.get(Object(r.data), "construct"))} at offset 0 is outside the fragment; explore remains`,
        );
        expect(r.data).toStrictEqual({ in: t.name, construct: Reflect.get(Object(r.data), "construct"), at: 0 });
        return r.code === "E1715" ? Reflect.get(Object(r.data), "construct") : r.code;
      };
      expect(await name(made("async (state) => state"))).toBe("ArrowFunctionExpression");
      expect(await name(made("async function (state) { return state; }"))).toBe("FunctionExpression");
      expect(await name(made("function* (state) { return state; }"))).toBe("FunctionExpression");
      expect(await name(made("class { }"))).toBe("ClassExpression");
      expect(await name(made("({ step(state) { return state; } }).step"))).toBe("source that does not parse");
      expect(await name(made("((state) => state).bind(undefined)"))).toBe("source that does not parse");
    },
    LONG,
  );
});

describe("prove: messages and data", () => {
  it(
    "E1715 names the transaction, the construct and its offset in the function's source",
    async () => {
      const t = one("return { ...state, n: Math.abs(state.n) };");
      const source = String(new Function("state", "p", "return { ...state, n: Math.abs(state.n) };"));
      const at = source.indexOf("Math.abs");
      const r = await refusal(() => prove([t]));
      expect(at).toBeGreaterThan(0);
      expect(r.code).toBe("E1715");
      expect(r.message).toBe(`${t.name}: call to Math.abs at offset ${at} is outside the fragment; explore remains`);
      expect(r.data).toStrictEqual({ in: t.name, construct: "call to Math.abs", at });
    },
    LONG,
  );

  it(
    "E1715 for an invariant names the store and the invariant; a result that is no boolean is refused",
    async () => {
      const t = one("return state;", "return state.xs;");
      const r = await refusal(() => prove([t]));
      expect(r.code).toBe("E1715");
      expect(r.message).toBe(
        `${t.store.id} invariant 1: a arr for a bool at offset 0 is outside the fragment; explore remains`,
      );
      expect(r.data).toStrictEqual({ in: `${t.store.id} invariant 1`, construct: "a arr for a bool", at: 0 });
    },
    LONG,
  );

  it(
    "E1715 for a schema without a sort names its path, in an array and in a map, and holds no offset",
    async () => {
      const inState = declared(
        s.object({ xs: s.array(s.json()) }),
        { xs: [] },
        () => true,
        s.object({}),
        new Function("state", "return state;"),
      );
      const a = await refusal(() => prove([inState]));
      expect(a.code).toBe("E1715");
      expect(a.message).toBe(`${inState.name}: no sort for json at state.xs[]; explore remains`);
      expect(a.data).toStrictEqual({ in: inState.name, construct: "no sort for json at state.xs[]" });
      const inPayload = declared(
        s.object({ n: s.int() }),
        { n: 0 },
        () => true,
        s.object({ by: s.object({ m: s.record(s.json()) }) }),
        new Function("state", "return state;"),
      );
      const b = await refusal(() => prove([inPayload]));
      expect(b.message).toBe(`${inPayload.name}: no sort for json at payload.by.m[]; explore remains`);
      expect(b.data).toStrictEqual({ in: inPayload.name, construct: "no sort for json at payload.by.m[]" });
    },
    LONG,
  );

  it(
    "E1710 for no transaction, a copy of one and an rlimit that is no positive integer",
    async () => {
      const t = one("return state;");
      const empty = await refusal(() => prove([]));
      expect(empty.code).toBe("E1710");
      expect(empty.message).toContain("prove: give one or more transactions of one store, each once");
      expect(empty.data).toMatchObject({ names: [] });
      const twice = await refusal(() => prove([t, t]));
      expect(twice.data).toMatchObject({ names: [t.name, t.name] });
      const copy = await refusal(() => prove([{ ...t }]));
      expect(copy.code).toBe("E1710");
      expect(copy.message).toContain(`prove: ${t.name} is not a transaction`);
      expect(copy.data).toMatchObject({ name: t.name });
      for (const rlimit of [0, 1.5, -1]) {
        const bad = await refusal(() => prove([t], { rlimit }));
        expect(bad.code).toBe("E1710");
        expect(bad.message).toContain(`prove: rlimit ${rlimit} is not an integer from 1 to 4294967295`);
        expect(bad.data).toMatchObject({ rlimit });
      }
    },
    LONG,
  );

  it(
    "E1717 names the transaction and the rlimit",
    async () => {
      const t = one(
        "return { ...state, xs: state.xs.map((x) => (x > 0 ? x - 1 : x)) };",
        "return state.xs.every((x) => x >= 0);",
      );
      expect((await refusal(() => prove([t]))).code).toBe("proven");
      const r = await refusal(() => prove([t], { rlimit: 1 }));
      expect(r.code).toBe("E1717");
      expect(r.message).toBe(`${t.name}: no verdict within rlimit 1`);
      expect(r.data).toStrictEqual({ transaction: t.name, rlimit: 1 });
    },
    LONG,
  );
});

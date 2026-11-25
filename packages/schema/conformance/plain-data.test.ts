// Spec: k.schema, clause "With L the values `new Map([['k', 'v']])`, `new Set(['v'])`, `new Date(0)`, `new (class {})()`, `() => 1`, `1n`, `undefined`, `NaN`, `Infinity`, `[1, , 2]`, `Object.assign([1], { e: 1 })`, `{ [Symbol('k')]: 'v' }`, `Object.defineProperty({}, 'k', { value: 'v', enumerable: false })`, `{ get k() { return 'v' } }` and `Object.create({ k: 'v' })`: for each `w` in L, `s.object({}).parse({ x: w })` fails with an issue of rule `type` at `['x']`, `s.object({}).parse({ x: { y: [w] } })` with one at `['x', 'y', 0]`, and `s.json().parse({ x: w })` with one at `[]`."
// Spec: k.schema, clause "`s.object({}).parse({ x: { a: ['v', 1, null, true] } })`, `s.object({}).parse(Object.create(null))` and `s.json().parse({ a: [1, 'b', null, true, { c: -0 }] })` are each `ok`."
// Spec: k.schema, clause "With `S = s.object({ a: s.object({}), r: s.record(s.string()), l: s.array(s.string()) })` and the valid value `{ a: {}, r: {}, l: [] }`: `S.parse` fails with an issue of rule `type` at `['a']`, and with one at `['r']`, when `a`, or `r`, is each of `new Map()`, `new Date(0)`, `new (class {})()`, `{ [Symbol('k')]: 'v' }`, `Object.defineProperty({}, 'k', { value: 'v', enumerable: false })` and `{ get k() { return 'v' } }`; with one at `['l']` when `l` is `Object.assign(['v'], { e: 'w' })` or an array holding `'v'` with an own symbol key; and with one at `[]` when the value itself has an own symbol key."
// Spec: k.schema, clause "For every generated open-object schema and every value it accepts, adding an undeclared key to an open object in the value, holding a value of L inside 0 to 3 plain arrays and objects, makes `parse` fail with an issue of rule `type` at that value of L's path."
// Spec: k.schema, clause "For every generated schema and every generated value it accepts, `parse` returns `ok` of a value in which every value reached through own properties of any key (`Reflect.ownKeys`), not entering a `Secret`, is reached through own enumerable string keys and array indices and is `null`, a boolean, a string, a finite number, a plain array, a plain object, or a `Secret` standing at a `secret` node."
// Seed 1337. Readings, where the spec text is silent or only implies:
// - `toJSON` is not named by the spec: an own enumerable `toJSON` method is a function value, so it is not plain data and fails at `[..., 'toJSON']`; a `toJSON` on a class prototype makes the instance a class instance.
// - `{ __proto__: x }` as an object literal sets the prototype (no own key): it is plain only when `x` is `null` or `Object.prototype`. Only an own `__proto__` key (JSON.parse, defineProperty) is refused as a key.
// - A typed array and `Buffer` are not in the spec's list L; the Plain data paragraph excludes them (not a plain array or plain object), so they are asserted beside L.
// - A plain array's index that is non-enumerable is left unasserted: the definition asks only that each index hold a value.
// - "nothing under it is read": a Proxy held by a non-plain value records every trap; no trap runs.
import { type Schema, type Secret, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
type Path = (string | number)[];
type Issue = { readonly path: readonly (string | number)[]; readonly rule: string };
type Parsed =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly data: { readonly issues: readonly Issue[] } } };
const issuesOf = (r: Parsed): readonly Issue[] => (r.ok ? [] : r.error.data.issues);
const typeAt = (path: Path): Issue => ({ path, rule: "type" });

const secretOf = (raw: string): Secret<string> => {
  const r = s.secret(s.string()).parse(raw);
  if (!r.ok) throw new Error("a raw value parses as a secret");
  return r.value;
};

// ---- L, as the spec lists it (a fresh value per call: some are stateful)
const L: readonly (readonly [string, () => unknown])[] = [
  ["Map", () => new Map([["k", "v"]])],
  ["Set", () => new Set(["v"])],
  ["Date", () => new Date(0)],
  ["class instance", () => new (class {})()],
  ["function", () => () => 1],
  ["bigint", () => 1n],
  ["undefined", () => undefined],
  ["NaN", () => Number.NaN],
  ["Infinity", () => Number.POSITIVE_INFINITY],
  ["sparse array", () => [1, , 2]],
  ["array with an own extra key", () => Object.assign([1], { e: 1 })],
  ["symbol key", () => ({ [Symbol("k")]: "v" })],
  ["non-enumerable key", () => Object.defineProperty({}, "k", { value: "v", enumerable: false })],
  [
    "getter",
    () => ({
      get k() {
        return "v";
      },
    }),
  ],
  ["prototype carries the key", () => Object.create({ k: "v" })],
];
// Beyond L: the typed array of the RFC, the other container shapes the Plain data paragraph names.
const MORE: readonly (readonly [string, () => unknown])[] = [
  ["Uint8Array", () => new Uint8Array(2)],
  ["Float64Array", () => new Float64Array(1)],
  ["Buffer", () => Buffer.from("v")],
  ["symbol value", () => Symbol("v")],
  ["-Infinity", () => Number.NEGATIVE_INFINITY],
  ["array subclass", () => new (class extends Array {})()],
  ["array with an accessor index", () => Object.defineProperty([0], "0", { get: () => 1, enumerable: true })],
  ["array with a symbol key", () => Object.assign([1], { [Symbol("k")]: 1 })],
  ["object with a setter only", () => Object.defineProperty({}, "k", { set: () => undefined, enumerable: true })],
  ["null prototype with a symbol key", () => Object.assign(Object.create(null), { [Symbol("k")]: 1 })],
  ["own __proto__ key", () => JSON.parse('{"__proto__":1}')],
  ["own constructor key", () => JSON.parse('{"constructor":1}')],
  ["own prototype key", () => JSON.parse('{"prototype":1}')],
  ["literal __proto__ to a non-plain prototype", () => ({ __proto__: { k: "v" } })],
  [
    "toJSON on a class prototype",
    () =>
      new (class {
        toJSON() {
          return {};
        }
      })(),
  ],
  ["boxed string", () => Object("v")],
];

describe("k.schema plain data", () => {
  it("every value of L, at an undeclared key, nested in plain data, or under a json node, fails with rule type at its own path", () => {
    for (const [name, make] of [...L, ...MORE]) {
      const O = s.object({});
      expect(issuesOf(O.parse({ x: make() })), name).toContainEqual(typeAt(["x"]));
      expect(issuesOf(O.parse({ x: { y: [make()] } })), name).toContainEqual(typeAt(["x", "y", 0]));
      expect(issuesOf(s.json().parse({ x: make() })), name).toContainEqual(typeAt([]));
      expect(s.object({}).parse({ x: make() }).ok, name).toBe(false);
      expect(s.json().parse({ x: make() }).ok, name).toBe(false);
    }
  });

  it("the fixed L cases give exactly one issue, at the path the spec names", () => {
    for (const [name, make] of L) {
      expect(issuesOf(s.object({}).parse({ x: make() })), name).toEqual([typeAt(["x"])]);
      expect(issuesOf(s.object({}).parse({ x: { y: [make()] } })), name).toEqual([typeAt(["x", "y", 0])]);
      expect(issuesOf(s.json().parse({ x: make() })), name).toEqual([typeAt([])]);
    }
  });

  it("plain data parses: nested arrays, objects with a null prototype, -0, and literals with an Object.prototype or null prototype", () => {
    expect(s.object({}).parse({ x: { a: ["v", 1, null, true] } }).ok).toBe(true);
    expect(s.object({}).parse(Object.create(null)).ok).toBe(true);
    expect(s.json().parse({ a: [1, "b", null, true, { c: -0 }] }).ok).toBe(true);
    expect(s.object({}).parse({ x: Object.create(null) }).ok).toBe(true);
    expect(s.object({}).parse({ x: { __proto__: null, k: [1] } }).ok).toBe(true);
    expect(s.object({}).parse({ x: { __proto__: Object.prototype, k: 1 } }).ok).toBe(true);
    expect(s.json().parse(Object.assign(Object.create(null), { k: [null] })).ok).toBe(true);
  });

  it("an own __proto__, constructor or prototype key makes its object not plain data: it fails with rule type at that object's path, wherever it sits", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("__proto__", "constructor", "prototype"),
        fc.integer({ min: 0, max: 3 }),
        (key, depth) => {
          const bad = (): unknown => JSON.parse(`{${JSON.stringify(key)}:{"p":1}}`);
          const nested = (v: unknown): unknown =>
            Array.from({ length: depth }).reduce<unknown>((inner) => ({ k: inner }), v);
          const at: Path = ["x", ...Array.from({ length: depth }, () => "k")];
          expect(issuesOf(s.object({}).parse({ x: nested(bad()) }))).toEqual([typeAt(at)]);
          expect(issuesOf(s.json().parse({ x: nested(bad()) }))).toEqual([typeAt([])]);
        },
      ),
      opts,
    );
  });

  it("a toJSON method is a function value: it fails with rule type at its own key and is never called", () => {
    let calls = 0;
    const make = () => ({
      toJSON() {
        calls++;
        return { safe: 1 };
      },
    });
    expect(issuesOf(s.object({}).parse({ x: make() }))).toEqual([typeAt(["x", "toJSON"])]);
    expect(issuesOf(s.json().parse(make()))).toEqual([typeAt([])]);
    expect(calls).toBe(0);
  });

  it("a prototype that carries a key does not make an object plain, and a plain object whose prototype is Object.prototype or null is not changed by one that does", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}$/), fc.string(), (key, v) => {
        const withProto = (): unknown => Object.create({ [key]: v });
        expect(issuesOf(s.object({}).parse({ x: withProto() }))).toEqual([typeAt(["x"])]);
        expect(issuesOf(s.object({}).parse({ x: [withProto()] }))).toEqual([typeAt(["x", 0])]);
        expect(s.object({}).parse({ x: { [key]: v } }).ok).toBe(true);
      }),
      opts,
    );
  });
});

describe("k.schema plain data at declared positions", () => {
  const S = s.object({ a: s.object({}), r: s.record(s.string()), l: s.array(s.string()) });
  const valid = (): Record<string, unknown> => ({ a: {}, r: {}, l: [] });
  const objectLike: readonly (readonly [string, () => unknown])[] = [
    ["Map", () => new Map()],
    ["Date", () => new Date(0)],
    ["class instance", () => new (class {})()],
    ["symbol key", () => ({ [Symbol("k")]: "v" })],
    ["non-enumerable key", () => Object.defineProperty({}, "k", { value: "v", enumerable: false })],
    [
      "getter",
      () => ({
        get k() {
          return "v";
        },
      }),
    ],
    ["Set", () => new Set()],
    ["array", () => []],
    ["Uint8Array", () => new Uint8Array(1)],
    ["prototype carries a key", () => Object.create({ k: "v" })],
  ];

  it("the valid value parses", () => expect(S.parse(valid()).ok).toBe(true));

  it("an object or record node fails with rule type at its path when the value is not a plain object", () => {
    for (const [name, make] of objectLike) {
      expect(issuesOf(S.parse({ ...valid(), a: make() })), `a: ${name}`).toContainEqual(typeAt(["a"]));
      expect(issuesOf(S.parse({ ...valid(), r: make() })), `r: ${name}`).toContainEqual(typeAt(["r"]));
    }
  });

  it("an array node fails with rule type at its path when the value is not a plain array", () => {
    const bad: readonly (readonly [string, () => unknown])[] = [
      ["extra own key", () => Object.assign(["v"], { e: "w" })],
      ["symbol key", () => Object.assign(["v"], { [Symbol("k")]: 1 })],
      ["sparse", () => ["v", , "w"]],
      ["typed array", () => new Uint8Array(1)],
      ["array-like object", () => ({ 0: "v", length: 1 })],
      ["accessor index", () => Object.defineProperty(["v"], "0", { get: () => "v", enumerable: true })],
      ["subclass", () => new (class extends Array {})()],
    ];
    for (const [name, make] of bad)
      expect(issuesOf(S.parse({ ...valid(), l: make() })), name).toContainEqual(typeAt(["l"]));
  });

  it("a value with an own symbol key fails with rule type at the root, however it is judged below", () => {
    const v = Object.assign(valid(), { [Symbol("k")]: "v" });
    expect(issuesOf(S.parse(v))).toContainEqual(typeAt([]));
    expect(issuesOf(s.object({}).parse(Object.assign({}, { [Symbol("k")]: "v" })))).toContainEqual(typeAt([]));
  });

  it("a union member reached through a non-plain object fails with rule type", () => {
    const U = s.union("kind", [s.object({ kind: s.literal("a"), n: s.int() })]);
    const v = new (class {
      kind = "a";
      n = 1;
    })();
    expect(U.parse(v).ok).toBe(false);
    expect(U.parse({ kind: "a", n: 1 }).ok).toBe(true);
  });
});

// ---- the attacker's property: one non-plain value holding a Secret, nested in plain data
type Step = { readonly kind: "key"; readonly name: string } | { readonly kind: "index"; readonly at: number };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.stringMatching(/^[a-z]{1,4}$/).map((name): Step => ({ kind: "key", name })),
  fc.nat(2).map((at): Step => ({ kind: "index", at })),
);
const stepsArb = fc.array(stepArb, { minLength: 0, maxLength: 4 });
const wrap = (leaf: unknown, path: readonly Step[]): unknown =>
  path.reduceRight<unknown>((inner, step) => {
    if (step.kind === "key") return { [step.name]: inner };
    return Array.from({ length: step.at + 1 }, (_, i) => (i === step.at ? inner : null));
  }, leaf);
const segs = (path: readonly Step[]): Path => path.map((p) => (p.kind === "key" ? p.name : p.at));

/** A proxy standing for "something under the non-plain value": it records each trap that runs. */
const watched = (log: string[], held: unknown): object =>
  new Proxy(
    { held },
    {
      get: (t, k) => (log.push(`get:${String(k)}`), Reflect.get(t, k)),
      ownKeys: (t) => (log.push("ownKeys"), Reflect.ownKeys(t)),
      getOwnPropertyDescriptor: (t, k) => (log.push(`gopd:${String(k)}`), Reflect.getOwnPropertyDescriptor(t, k)),
      getPrototypeOf: (t) => (log.push("getPrototypeOf"), Reflect.getPrototypeOf(t)),
      has: (t, k) => (log.push(`has:${String(k)}`), Reflect.has(t, k)),
    },
  );

type Holder = (sec: Secret<string>, log: string[]) => unknown;
const holders: readonly (readonly [string, Holder])[] = [
  ["Map value", (sec) => new Map([["k", sec]])],
  ["Map key", (sec) => new Map([[sec, 1]])],
  ["Set", (sec) => new Set([sec])],
  ["class instance field", (sec, log) => Object.assign(new (class {})(), { secret: sec, under: watched(log, sec) })],
  [
    "class instance with toJSON",
    (sec) =>
      new (class {
        s = sec;
        toJSON() {
          return { s: sec };
        }
      })(),
  ],
  ["function property", (sec, log) => Object.assign(() => 1, { secret: sec, under: watched(log, sec) })],
  ["Date with an own property", (sec) => Object.assign(new Date(0), { secret: sec })],
  ["symbol key", (sec, log) => ({ [Symbol("k")]: sec, plain: watched(log, sec) })],
  [
    "non-enumerable key",
    (sec, log) => Object.defineProperty({ under: watched(log, sec) }, "k", { value: sec, enumerable: false }),
  ],
  ["getter", (sec, log) => Object.defineProperty({}, "k", { get: () => (log.push("getter"), sec), enumerable: true })],
  ["prototype carries the secret", (sec) => Object.create({ k: sec })],
  ["sparse array", (sec, log) => [, sec, watched(log, sec)]],
  ["array with an own extra key", (sec, log) => Object.assign([watched(log, sec)], { e: sec })],
  ["array with a symbol key", (sec) => Object.assign([1], { [Symbol("k")]: sec })],
  [
    "array with a getter index",
    (sec, log) => Object.defineProperty([0], "0", { get: () => (log.push("getter"), sec), enumerable: true }),
  ],
  ["own __proto__ key", (sec) => Object.defineProperty({}, "__proto__", { value: { secret: sec }, enumerable: true })],
  ["own constructor key", (sec) => ({ constructor: { secret: sec } })],
  ["own prototype key", (sec) => ({ prototype: { secret: sec } })],
];
const holderArb = fc.constantFrom(...holders);

describe("k.schema plain data: a non-plain value holding a Secret never lets the Secret out", () => {
  const Root = s.object({ name: s.string() });
  const Deep = s.object({
    name: s.string(),
    inner: s.object({ n: s.int() }),
    items: s.array(s.object({})),
    r: s.record(s.object({})),
    j: s.json(),
  });
  const marker = fc.stringMatching(/^[a-z]{16}$/).map((m) => `MARK${m}`);

  const check = (r: Parsed, at: Path, log: readonly string[], raw: string, strict = true): void => {
    expect(r.ok).toBe(false);
    const issues = issuesOf(r);
    expect(issues).toContainEqual(typeAt(at));
    expect(JSON.stringify(r)).not.toContain(raw);
    if (!strict) return;
    // under an undeclared key nothing under the non-plain value is read or reported
    for (const i of issues)
      expect(i.path.length <= at.length || i.path.slice(0, at.length).some((p, k) => p !== at[k])).toBe(true);
    expect(log).toEqual([]);
  };

  it("under an undeclared key of the root open object, at any depth, parse fails at the non-plain value's path and the Secret is not returned", () => {
    fc.assert(
      fc.property(
        holderArb,
        stepsArb,
        stepsArb,
        marker,
        fc.stringMatching(/^x[a-z]{0,3}$/),
        ([, hold], before, _after, raw, key) => {
          const log: string[] = [];
          const leaf = hold(secretOf(raw), log);
          const r = Root.parse({ name: "n", [key]: wrap(leaf, before) });
          check(r, [key, ...segs(before)], log, raw);
        },
      ),
      opts,
    );
  });

  it("the same under an undeclared key of a declared open object, an array item's open object and a record value's open object", () => {
    fc.assert(
      fc.property(
        holderArb,
        stepsArb,
        marker,
        fc.stringMatching(/^x[a-z]{0,3}$/),
        fc.nat(2),
        ([, hold], before, raw, key, idx) => {
          const base = { name: "n", inner: { n: 1 }, items: [] as unknown[], r: {}, j: null };
          const log: string[] = [];
          const w = (): unknown => wrap(hold(secretOf(raw), log), before);
          check(Deep.parse({ ...base, inner: { n: 1, [key]: w() } }), ["inner", key, ...segs(before)], log, raw);
          const items = Array.from({ length: idx + 1 }, (_, i) => (i === idx ? { [key]: w() } : {}));
          check(Deep.parse({ ...base, items }), ["items", idx, key, ...segs(before)], log, raw);
          check(Deep.parse({ ...base, r: { rk: { [key]: w() } } }), ["r", "rk", key, ...segs(before)], log, raw);
        },
      ),
      opts,
    );
  });

  it("at a declared object node, the non-plain value itself fails at the node's path; under a json node it fails at the json node's path", () => {
    fc.assert(
      fc.property(holderArb, stepsArb, marker, ([, hold], before, raw) => {
        const base = { name: "n", inner: { n: 1 }, items: [] as unknown[], r: {}, j: null };
        const log: string[] = [];
        check(Deep.parse({ ...base, inner: hold(secretOf(raw), log) }), ["inner"], log, raw, false);
        const log2: string[] = [];
        check(Deep.parse({ ...base, j: wrap(hold(secretOf(raw), log2), before) }), ["j"], log2, raw, false);
        const log3: string[] = [];
        check(s.json().parse(wrap(hold(secretOf(raw), log3), before)), [], log3, raw, false);
      }),
      opts,
    );
  });

  it("a Secret under an undeclared key held by plain arrays and objects only fails at the Secret's own path, as before", () => {
    fc.assert(
      fc.property(stepsArb, marker, fc.stringMatching(/^x[a-z]{0,3}$/), (before, raw, key) => {
        const r = Root.parse({ name: "n", [key]: wrap(secretOf(raw), before) });
        expect(issuesOf(r)).toEqual([typeAt([key, ...segs(before)])]);
        expect(JSON.stringify(r)).not.toContain(raw);
      }),
      opts,
    );
  });
});

// ---- generated schemas
type Piece =
  | { readonly kind: "string" | "int" | "bool" | "secret" | "json" }
  | { readonly kind: "array" | "record" | "nullable"; readonly item: Piece }
  | { readonly kind: "object"; readonly fields: readonly Piece[] };
const leaf: fc.Arbitrary<Piece> = fc.constantFrom<Piece>(
  { kind: "string" },
  { kind: "int" },
  { kind: "bool" },
  { kind: "secret" },
  { kind: "json" },
);
const pieceArb = (depth: number): fc.Arbitrary<Piece> =>
  depth <= 0
    ? leaf
    : fc.oneof(
        leaf,
        fc.record({
          kind: fc.constantFrom("array" as const, "record" as const, "nullable" as const),
          item: pieceArb(depth - 1),
        }),
        fc
          .array(pieceArb(depth - 1), { minLength: 0, maxLength: 3 })
          .map((fields): Piece => ({ kind: "object", fields })),
      );
const rootArb: fc.Arbitrary<Piece> = fc
  .array(pieceArb(2), { minLength: 1, maxLength: 3 })
  .map((fields): Piece => ({ kind: "object", fields }));
const schemaOf = (p: Piece): Schema<unknown> => {
  switch (p.kind) {
    case "string":
      return s.string();
    case "int":
      return s.int();
    case "bool":
      return s.boolean();
    case "secret":
      return s.secret(s.string());
    case "json":
      return s.json();
    case "array":
      return s.array(schemaOf(p.item));
    case "record":
      return s.record(schemaOf(p.item));
    case "nullable":
      return schemaOf(p.item).nullable();
    case "object":
      return s.object(Object.fromEntries(p.fields.map((f, i) => [`f${i}`, schemaOf(f)])));
  }
};

type Pos = { readonly path: Path; readonly piece: Piece | undefined };
const unwrapNullable = (p: Piece | undefined): Piece | undefined =>
  p?.kind === "nullable" ? unwrapNullable(p.item) : p;
const childPiece = (p: Piece | undefined, key: string | number): Piece | undefined => {
  const u = unwrapNullable(p);
  if (u === undefined) return undefined;
  if (u.kind === "array" || u.kind === "record") return u.item;
  if (u.kind === "object") {
    const m = /^f(\d+)$/.exec(String(key));
    return m?.[1] === undefined ? undefined : u.fields[Number(m[1])];
  }
  return undefined;
};
/** Every position (the root included) of a generated value, found through own enumerable keys, not entering a Secret. */
const positions = (p: Piece | undefined, v: unknown, path: Path = [], out: Pos[] = []): Pos[] => {
  out.push({ path, piece: unwrapNullable(p) });
  if (unwrapNullable(p)?.kind === "secret" || typeof v !== "object" || v === null) return out;
  for (const [k, child] of Object.entries(v))
    positions(childPiece(p, Array.isArray(v) ? Number(k) : k), child, [...path, Array.isArray(v) ? Number(k) : k], out);
  return out;
};
const setAt = (v: unknown, path: Path, x: unknown): unknown => {
  const [head, ...rest] = path;
  if (head === undefined) return x;
  if (Array.isArray(v)) return v.map((c, i) => (i === head ? setAt(c, rest, x) : c));
  return { ...Object(v), [head]: setAt(Reflect.get(Object(v), head), rest, x) };
};
const addKeyAt = (v: unknown, path: Path, key: string, x: unknown): unknown => {
  const [head, ...rest] = path;
  if (head === undefined) return { ...Object(v), [key]: x };
  if (Array.isArray(v)) return v.map((c, i) => (i === head ? addKeyAt(c, rest, key, x) : c));
  return { ...Object(v), [head]: addKeyAt(Reflect.get(Object(v), head), rest, key, x) };
};

describe("k.schema plain data: adding a non-plain value under an undeclared key of any generated open object", () => {
  const wrapperArb = fc.array(fc.constantFrom("array" as const, "object" as const), { minLength: 0, maxLength: 3 });
  const wrapAll = (leafValue: unknown, ws: readonly ("array" | "object")[]): { value: unknown; path: Path } => {
    let value = leafValue;
    const path: Path = [];
    for (const w of [...ws].reverse()) {
      value = w === "array" ? [value] : { k: value };
    }
    for (const w of ws) path.push(w === "array" ? 0 : "k");
    return { value, path };
  };
  it("parse fails with an issue of rule type at that value's path, and none below it", () => {
    fc.assert(
      fc.property(
        rootArb.chain((piece) => fc.tuple(fc.constant(piece), gen(schemaOf(piece)))),
        fc.nat(),
        fc.constantFrom(...L, ...MORE),
        wrapperArb,
        ([piece, value], pick, [name, make], ws) => {
          const schema = schemaOf(piece);
          expect(schema.parse(value).ok).toBe(true);
          const objects = positions(piece, value).filter((p) => p.piece?.kind === "object");
          const target = objects[pick % objects.length];
          if (target === undefined) throw new Error("the root is an object");
          const { value: held, path: inner } = wrapAll(make(), ws);
          const at: Path = [...target.path, "zz", ...inner];
          const r = schema.parse(addKeyAt(value, target.path, "zz", held));
          expect(issuesOf(r), name).toContainEqual(typeAt(at));
          for (const i of issuesOf(r))
            expect(i.path.length <= at.length || i.path.slice(0, at.length).some((x, k) => x !== at[k]), name).toBe(
              true,
            );
        },
      ),
      opts,
    );
  });
});

/** Asserts `v` is walk-safe: only plain arrays and objects, finite numbers, strings, booleans, null; a Secret only at a secret node. */
const assertWalkable = (v: unknown, p: Piece | undefined, path: Path): void => {
  const u = unwrapNullable(p);
  if (u?.kind === "secret") return;
  if (v === null || typeof v === "boolean" || typeof v === "string") return;
  if (typeof v === "number") return void expect(Number.isFinite(v), `number at ${path.join(".")}`).toBe(true);
  expect(typeof v, `type at ${path.join(".")}`).toBe("object");
  if (typeof v !== "object") return;
  const keys = Reflect.ownKeys(v);
  expect(
    keys.every((k) => typeof k === "string"),
    `symbol key at ${path.join(".")}`,
  ).toBe(true);
  if (Array.isArray(v)) {
    expect(Object.getPrototypeOf(v)).toBe(Array.prototype);
    expect([...keys].sort()).toEqual([...Array.from(v.keys(), String), "length"].sort());
  } else {
    const proto = Object.getPrototypeOf(v);
    expect(proto === Object.prototype || proto === null, `prototype at ${path.join(".")}`).toBe(true);
    for (const k of keys) expect(["__proto__", "constructor", "prototype"]).not.toContain(k);
  }
  for (const k of keys) {
    if (k === "length" && Array.isArray(v)) continue;
    const d = Reflect.getOwnPropertyDescriptor(v, k);
    expect(
      d !== undefined && "value" in d && d.enumerable === true,
      `descriptor ${String(k)} at ${path.join(".")}`,
    ).toBe(true);
    assertWalkable(d?.value, childPiece(p, Array.isArray(v) ? Number(k) : String(k)), [...path, String(k)]);
  }
};

describe("k.schema plain data: what parse accepts is reached by a walk of own enumerable string keys", () => {
  const hostile: readonly (readonly [string, () => unknown])[] = [
    ...L,
    ...MORE,
    ...holders.map(([n, h]): readonly [string, () => unknown] => [`holder ${n}`, () => h(secretOf("MARKwalk"), [])]),
    ["plain null-prototype object", () => Object.assign(Object.create(null), { k: [1] })],
    ["plain array", () => [1, "a", null]],
  ];
  it("for every generated schema and value, and the same value with one hostile value put in or added at a generated position, an accepted result is plain data but for the Secrets at secret nodes", () => {
    fc.assert(
      fc.property(
        rootArb.chain((piece) => fc.tuple(fc.constant(piece), gen(schemaOf(piece)))),
        fc.nat(),
        fc.constantFrom(...hostile),
        fc.boolean(),
        ([piece, value], pick, [name, make], add) => {
          const schema = schemaOf(piece);
          const plain = schema.parse(value);
          expect(plain.ok).toBe(true);
          if (plain.ok) assertWalkable(plain.value, piece, []);
          const all = positions(piece, value);
          const target = all[pick % all.length];
          if (target === undefined) throw new Error("the root is a position");
          const input =
            add && target.piece?.kind === "object"
              ? addKeyAt(value, target.path, "zz", make())
              : setAt(value, target.path, make());
          const r = schema.parse(input);
          if (r.ok) assertWalkable(r.value, piece, []);
          else expect(issuesOf(r).length, name).toBeGreaterThan(0);
        },
      ),
      opts,
    );
  });

  it("a Secret at a secret node is the one value that is not plain data, and it stays out of the walk of the rest", () => {
    const S = s.object({ f0: s.secret(s.string()), f1: s.array(s.string()) });
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{8,12}$/), fc.array(fc.string(), { maxLength: 3 }), (raw, rest) => {
        const r = S.parse({ f0: raw, f1: rest });
        expect(r.ok).toBe(true);
        if (r.ok) {
          assertWalkable(
            r.value,
            { kind: "object", fields: [{ kind: "secret" }, { kind: "array", item: { kind: "string" } }] },
            [],
          );
          expect(JSON.stringify(r.value)).not.toContain(raw);
        }
      }),
      opts,
    );
  });
});

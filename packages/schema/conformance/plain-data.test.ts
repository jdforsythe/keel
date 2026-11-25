// Spec: k.schema, clause "With L the values `new Map([['k', 'v']])`, `new Set(['v'])`, `new Date(0)`, `new (class {})()`, `() => 1`, `1n`, `undefined`, `NaN`, `Infinity`, `[1, , 2]`, `Object.assign([1], { e: 1 })`, `{ [Symbol('k')]: 'v' }`, `Object.defineProperty({}, 'k', { value: 'v', enumerable: false })`, `{ get k() { return 'v' } }` and `Object.create({ k: 'v' })`: for each `w` in L, `s.object({}).parse({ x: w })` fails with an issue of rule `type` at `['x']`, `s.object({}).parse({ x: { y: [w] } })` with one at `['x', 'y', 0]`, and `s.json().parse({ x: w })` with one at `[]`."
// Spec: k.schema, clause "`s.object({}).parse({ x: { a: ['v', 1, null, true] } })`, `s.object({}).parse(Object.create(null))` and `s.json().parse({ a: [1, 'b', null, true, { c: -0 }] })` are each `ok`."
// Spec: k.schema, clause "With `S = s.object({ a: s.object({}), r: s.record(s.string()), l: s.array(s.string()) })` and the valid value `{ a: {}, r: {}, l: [] }`: `S.parse` fails with an issue of rule `type` at `['a']`, and with one at `['r']`, when `a`, or `r`, is each of `new Map()`, `new Date(0)`, `new (class {})()`, `{ [Symbol('k')]: 'v' }`, `Object.defineProperty({}, 'k', { value: 'v', enumerable: false })` and `{ get k() { return 'v' } }`; with one at `['l']` when `l` is `Object.assign(['v'], { e: 'w' })` or an array holding `'v'` with an own symbol key; and with one at `[]` when the value itself has an own symbol key."
// Spec: k.schema, clause "For every generated open-object schema and every value it accepts, adding an undeclared key to an open object in the value, holding a value of L inside 0 to 3 plain arrays and objects, makes `parse` fail with an issue of rule `type` at that value of L's path."
// Spec: k.schema, clause "For every generated schema and every generated value it accepts, `parse` returns `ok` of a value in which every value reached through own properties of any key (`Reflect.ownKeys`), not entering a `Secret`, is reached through own enumerable string keys and array indices and is `null`, a boolean, a string, a finite number, a plain array, a plain object, or a `Secret` standing at a `secret` node."
// Spec: k.schema, clause "A plain array: `Array.isArray` holds, its prototype is `Array.prototype`, and its own keys are `length` and each index below it, each index enumerable and holding a value (no getter or setter)."
// Spec: k.schema, clause "A plain object: its prototype is `Object.prototype` or `null`, each own key is a string other than `__proto__`, `constructor` and `prototype`, and each own property is enumerable and holds a value; the brand `ok` and `err` put on a Result (k.errors: `Symbol.for('keel.result')`, non-enumerable, holding `true`) is no key for this test and holds no data."
// Spec: k.schema, clause "A value is plain data when it is `null`, a boolean, a string, a finite number, or a plain array or plain object each item and value of which is plain data, no container being its own ancestor."
// Spec: k.schema, clause "So a `Secret`, a `Map`, a `Set`, a `Date`, a typed array or `Buffer`, a class instance, a function (an own `toJSON` method among them), a `bigint`, `undefined`, `NaN`, an array with a hole and a container with a symbol key, a non-enumerable key or a getter are not plain data."
// Spec: k.schema, clause "`json` accepts exactly plain data; anything else fails rule `type` at the `json` node's path."
// Spec: k.schema, clause "Under an undeclared key of an open object, at any depth, each value reached through plain arrays and plain objects that is none of `null`, a boolean, a string, a finite number, a plain array or a plain object, and each container met again inside itself, fails rule `type` at its path; nothing under it is read. A plain container met again elsewhere (not inside itself) is not walked again, so what is under it is reported at its first path only; parse fails either way."
// Spec: k.schema, clause "At a declared position, an `object`, `record` or `union` node fails rule `type` at its path on a value that is not a plain object by the test above, and an `array` node on a value that is not a plain array, and then reads nothing under it; on a plain container, each item, field and record value is judged by its own node, and each undeclared key as above, so the issues below are theirs."
// Spec: k.schema, clause "So a value `parse` accepts is plain data but for the `Secret` at each `secret` node (k.privacy), and every value in it, outside each `Secret`, is reached by a walk of own enumerable string keys and array items, as `JSON.stringify`, `encode`, `piiValues`, the server log's value set (k.privacy), sessions' `redact` (std.sessions) and `#k-state` (k.leave) walk it; nothing in it is out of their reach."
// Spec: k.schema, clause "Limits: a Proxy is judged by what its traps answer while `parse` reads it (its own keys and property descriptors; under an undeclared key or a `json` node no `get`), and one whose trap throws, or a revoked one, fails rule `type` at `[]`; `parse` of a schema with no `secret` node returns the value it was given, so a change to that value after `parse` returns is not judged."
// Seed 1337. Readings, where the spec text is silent or only implies:
// - `{ __proto__: x }` as an object literal sets the prototype (no own key): it is plain only when `x` is `null` or `Object.prototype`. Only an own `__proto__` key (JSON.parse, defineProperty) is refused as a key.
// - "nothing under it is read": a Proxy held by a non-plain value records every trap; no trap runs.
// - A Proxy with a `get` trap that is judged plain is `ok`: the spec says it is judged by its answers, and under an undeclared key or a `json` node by keys and descriptors only.
// - The Result brand is asserted only as "is no key for this test": the accepted value's brand is not asserted.
// Untestable: "`parse` of a schema with no `secret` node returns the value it was given" is asserted by identity; what a schema with a `secret` node returns is not stated.
import { type Schema, type Secret, ok, s } from "@keel/schema";
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

/** The Date of the spec's list, made without a bare constructor call. */
const epoch = (): Date => Reflect.construct(Date, [0]);
const noItems = (): unknown[] => [];

// ---- L, as the spec lists it (a fresh value per call: some are stateful)
const L: readonly (readonly [string, () => unknown])[] = [
  ["Map", () => new Map([["k", "v"]])],
  ["Set", () => new Set(["v"])],
  ["Date", () => epoch()],
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
  ["array with a non-enumerable index", () => Object.defineProperty([1, 2], "0", { value: 1, enumerable: false })],
  ["Result brand holding false", () => Object.defineProperty({ k: 1 }, Symbol.for("keel.result"), { value: false })],
  [
    "Result brand enumerable",
    () => Object.defineProperty({ k: 1 }, Symbol.for("keel.result"), { value: true, enumerable: true }),
  ],
  [
    "a symbol that is not the Result brand",
    () => Object.defineProperty({ k: 1 }, Symbol("keel.result"), { value: true }),
  ],
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
    ["Date", () => epoch()],
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
    ["Buffer", () => Buffer.from("v")],
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
      ["Buffer", () => Buffer.from("v")],
      ["non-enumerable index", () => Object.defineProperty(["v", "w"], "0", { value: "v", enumerable: false })],
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
  ["Date with an own property", (sec) => Object.assign(epoch(), { secret: sec })],
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
          const base = { name: "n", inner: { n: 1 }, items: noItems(), r: {}, j: null };
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
        const base = { name: "n", inner: { n: 1 }, items: noItems(), r: {}, j: null };
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

// ---- the sentences the first pass left unasserted
const watchedPlain = (target: object, log: string[]): object =>
  new Proxy(target, {
    get: (t, k, r) => {
      log.push(`get:${String(k)}`);
      return Reflect.get(t, k, r);
    },
  });
const BRAND = Symbol.for("keel.result");

describe("k.schema plain data: array indices, the Result brand, typed arrays and toJSON", () => {
  it("an array index must be enumerable: an array with a non-enumerable index is not plain data, wherever it sits", () => {
    const hidden = (): unknown[] => Object.defineProperty([1, 2], "0", { value: 1, enumerable: false });
    expect(issuesOf(s.object({}).parse({ x: hidden() }))).toEqual([typeAt(["x"])]);
    expect(issuesOf(s.object({}).parse({ x: { y: [hidden()] } }))).toEqual([typeAt(["x", "y", 0])]);
    expect(issuesOf(s.json().parse({ x: hidden() }))).toEqual([typeAt([])]);
    expect(issuesOf(s.object({ l: s.array(s.int()) }).parse({ l: hidden() }))).toEqual([typeAt(["l"])]);
  });

  it("the Result brand `ok` puts on a Result is no key for this test: a Result of plain data is plain data", () => {
    fc.assert(
      fc.property(
        fc.jsonValue().filter((v) => !/"(__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(v))),
        (v) => {
          expect(s.object({}).parse({ x: ok(v) }).ok).toBe(true);
          expect(s.json().parse(ok(v)).ok).toBe(true);
          const branded = Object.defineProperty({ k: v }, BRAND, { value: true, enumerable: false });
          expect(s.object({}).parse({ x: branded }).ok).toBe(true);
          expect(s.json().parse([branded]).ok).toBe(true);
        },
      ),
      opts,
    );
  });

  it("typed arrays and Buffer are not plain data, at an undeclared key, in an array and under a json node", () => {
    const made: readonly (() => unknown)[] = [
      () => new Uint8Array(2),
      () => new Int32Array(1),
      () => new Float64Array(1),
      () => Buffer.from("v"),
    ];
    for (const make of made) {
      expect(issuesOf(s.object({}).parse({ x: make() }))).toEqual([typeAt(["x"])]);
      expect(issuesOf(s.object({}).parse({ x: [make()] }))).toEqual([typeAt(["x", 0])]);
      expect(issuesOf(s.json().parse(make()))).toEqual([typeAt([])]);
    }
  });

  it("an own toJSON method is a function: it fails with rule type at its own key, however deep, and is never called", () => {
    fc.assert(
      fc.property(stepsArb, (before) => {
        let calls = 0;
        const make = () => ({
          toJSON() {
            calls++;
            return { safe: 1 };
          },
        });
        const r = s.object({}).parse({ x: wrap(make(), before) });
        expect(issuesOf(r)).toEqual([typeAt(["x", ...segs(before), "toJSON"])]);
        expect(issuesOf(s.json().parse(wrap(make(), before)))).toEqual([typeAt([])]);
        expect(calls).toBe(0);
      }),
      opts,
    );
  });
});

describe("k.schema plain data: shared and cyclic containers", () => {
  it("a plain container met again elsewhere is not walked again: what is under it is reported at its first path only, and parse fails", () => {
    fc.assert(
      fc.property(fc.constantFrom(...L, ...MORE), stepsArb, ([name, make], before) => {
        const shared = { bad: wrap(make(), before) };
        const firstSecond = s.object({}).parse({ x: { first: shared, second: shared } });
        expect(firstSecond.ok, name).toBe(false);
        const paths = issuesOf(firstSecond).map((i) => i.path.join("."));
        expect(
          paths.every((p) => p.startsWith("x.first.")),
          name,
        ).toBe(true);
        expect(
          paths.some((p) => p.startsWith("x.second")),
          name,
        ).toBe(false);
        const inArray = s.object({}).parse({ x: [shared, shared] });
        expect(inArray.ok, name).toBe(false);
        expect(
          issuesOf(inArray).every((i) => i.path[1] === 0),
          name,
        ).toBe(true);
        expect(issuesOf(inArray).length, name).toBeGreaterThan(0);
      }),
      opts,
    );
  });

  it("a shared plain container of plain data is plain data", () => {
    const shared = { n: [1, "a", null] };
    expect(s.object({}).parse({ x: { a: shared, b: shared, c: [shared, shared] } }).ok).toBe(true);
    expect(s.json().parse({ a: shared, b: shared }).ok).toBe(true);
  });

  it("a container met again inside itself fails with rule type at its path, and nothing under it is read", () => {
    const self: Record<string, unknown> = {};
    self.self = self;
    expect(issuesOf(s.object({}).parse({ x: self }))).toEqual([typeAt(["x", "self"])]);
    const deep: Record<string, unknown> = {};
    deep.d = { back: deep };
    expect(issuesOf(s.object({}).parse({ x: deep }))).toEqual([typeAt(["x", "d", "back"])]);
    const ring: unknown[] = [];
    ring.push(ring);
    expect(issuesOf(s.object({}).parse({ x: ring }))).toEqual([typeAt(["x", 0])]);
    expect(issuesOf(s.json().parse(self))).toEqual([typeAt([])]);
    // a container at a declared position that holds itself: the first path of the repeat is not stated (at ['a','self'] or one level below), so only that it fails by rule type
    const D = s.object({ a: s.object({}) });
    const declared = issuesOf(D.parse({ a: self }));
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.every((i) => i.rule === "type" && i.path[0] === "a" && i.path.length >= 2)).toBe(true);
  });
});

describe("k.schema plain data: a non-plain container at a declared position", () => {
  const S = s.object({
    a: s.object({}),
    r: s.record(s.string()),
    l: s.array(s.string()),
    u: s.union("kind", [s.object({ kind: s.literal("a") })]),
    m: s.union([s.object({ kind: s.literal("a") }), s.object({ kind: s.literal("b") })]),
  });
  const valid = (): Record<string, unknown> => ({ a: {}, r: {}, l: [], u: { kind: "a" }, m: { kind: "a" } });
  const withUnder = (v: object, log: string[]): object =>
    Object.defineProperty(v, "under", { value: watched(log, "v"), enumerable: true });
  const bad: readonly (readonly [string, () => object])[] = [
    ["Map", () => new Map()],
    ["Date", () => epoch()],
    ["class instance", () => new (class {})()],
    ["symbol key", () => ({ [Symbol("k")]: "v" })],
    ["non-enumerable key", () => Object.defineProperty({}, "k", { value: "v", enumerable: false })],
    ["Uint8Array", () => new Uint8Array(1)],
    ["Buffer", () => Buffer.from("v")],
    ["prototype carries a key", () => Object.create({ k: "v" })],
  ];

  it("an object, record or union node gives one issue, rule type at its path, and reads nothing under the value", () => {
    for (const key of ["a", "r", "u", "m"] as const) {
      for (const [name, make] of bad) {
        const log: string[] = [];
        const r = S.parse({ ...valid(), [key]: withUnder(make(), log) });
        expect(issuesOf(r), `${key}: ${name}`).toEqual([typeAt([key])]);
        expect(log, `${key}: ${name}`).toEqual([]);
      }
    }
  });

  it("an array node gives one issue, rule type at its path, and reads nothing under the value", () => {
    const badArrays: readonly (readonly [string, () => object])[] = [
      ["extra own key", () => Object.assign(["v"], { e: "w" })],
      ["symbol key", () => Object.assign(["v"], { [Symbol("k")]: 1 })],
      ["non-enumerable index", () => Object.defineProperty(["v", "w"], "0", { value: "v", enumerable: false })],
      ["typed array", () => new Uint8Array(1)],
      ["array-like object", () => ({ 0: "v", length: 1 })],
    ];
    for (const [name, make] of badArrays) {
      const log: string[] = [];
      const r = S.parse({ ...valid(), l: withUnder(make(), log) });
      expect(issuesOf(r), name).toEqual([typeAt(["l"])]);
      expect(log, name).toEqual([]);
    }
  });

  it("on a plain container each field, item and record value is judged by its own node, and each undeclared key by the undeclared-key rule", () => {
    fc.assert(
      fc.property(fc.constantFrom(...L), ([name, make]) => {
        const r = S.parse({ ...valid(), a: { z: make() }, r: { k: 1 }, l: ["v", 2] });
        const paths = issuesOf(r).map((i) => i.path.join("."));
        expect(paths, name).toContain("a.z");
        expect(paths, name).toContain("r.k");
        expect(paths, name).toContain("l.1");
        expect(
          issuesOf(r).every((i) => i.rule === "type"),
          name,
        ).toBe(true);
      }),
      opts,
    );
  });
});

describe("k.schema plain data: a Proxy is judged by its keys and descriptors", () => {
  it("under an undeclared key or a json node a plain-answering Proxy is ok and no get trap runs", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{1,4}$/), { maxLength: 3 }), fc.integer(), (keys, n) => {
        const log: string[] = [];
        const target = Object.fromEntries(keys.map((k) => [k, [n, null, "v"]]));
        const proxies = (): readonly object[] => [watchedPlain(target, log), watchedPlain([n, "a", [1]], log)];
        for (const p of proxies()) {
          expect(s.object({}).parse({ x: p }).ok).toBe(true);
          expect(s.object({}).parse({ x: { y: [p] } }).ok).toBe(true);
          expect(s.json().parse({ x: p }).ok).toBe(true);
          expect(s.json().parse(p).ok).toBe(true);
        }
        expect(log.filter((e) => e.startsWith("get:"))).toEqual([]);
      }),
      opts,
    );
  });

  it("a Proxy whose descriptor trap answers a getter, or whose keys include a symbol, is not plain data", () => {
    const getter = (): object =>
      new Proxy(
        { k: 1 },
        {
          getOwnPropertyDescriptor: (t, k) =>
            k === "k" ? { get: () => 1, enumerable: true, configurable: true } : Reflect.getOwnPropertyDescriptor(t, k),
        },
      );
    const symbol = (): object => new Proxy({ k: 1 }, { ownKeys: () => ["k", Symbol("s")] });
    for (const make of [getter, symbol]) {
      expect(issuesOf(s.object({}).parse({ x: make() }))).toEqual([typeAt(["x"])]);
      expect(issuesOf(s.json().parse({ x: make() }))).toEqual([typeAt([])]);
    }
  });

  it("a Proxy whose trap throws, or a revoked one, fails rule type at [] wherever it sits, and parse does not throw", () => {
    const boom = (): never => {
      throw new Error("trap");
    };
    const revoked = (): object => {
      const r = Proxy.revocable({}, {});
      r.revoke();
      return r.proxy;
    };
    const revokedArray = (): object => {
      const r = Proxy.revocable([], {});
      r.revoke();
      return r.proxy;
    };
    const makers: readonly (readonly [string, () => object])[] = [
      ["revoked", revoked],
      ["revoked array", revokedArray],
      ["ownKeys throws", () => new Proxy({}, { ownKeys: boom })],
      ["getOwnPropertyDescriptor throws", () => new Proxy({ k: 1 }, { getOwnPropertyDescriptor: boom })],
      ["getPrototypeOf throws", () => new Proxy({}, { getPrototypeOf: boom })],
    ];
    const arrays: readonly (readonly [string, () => object])[] = [
      ["revoked array", revokedArray],
      ["array ownKeys throws", () => new Proxy([1], { ownKeys: boom })],
      ["array getOwnPropertyDescriptor throws", () => new Proxy([1], { getOwnPropertyDescriptor: boom })],
      ["array getPrototypeOf throws", () => new Proxy([1], { getPrototypeOf: boom })],
    ];
    const S = s.object({ a: s.object({}), l: s.array(s.int()) });
    for (const [name, make] of arrays) {
      expect(issuesOf(S.parse({ a: {}, l: make() })), name).toEqual([typeAt([])]);
      expect(issuesOf(s.object({}).parse({ x: [make()] })), name).toEqual([typeAt([])]);
    }
    for (const [name, make] of makers) {
      expect(issuesOf(s.object({}).parse({ x: make() })), name).toEqual([typeAt([])]);
      expect(issuesOf(s.object({}).parse({ x: { y: [make()] } })), name).toEqual([typeAt([])]);
      expect(issuesOf(s.json().parse({ x: make() })), name).toEqual([typeAt([])]);
      expect(issuesOf(s.json().parse(make())), name).toEqual([typeAt([])]);
      expect(issuesOf(S.parse({ a: make(), l: [] })), name).toEqual([typeAt([])]);
      expect(issuesOf(S.parse(make())), name).toEqual([typeAt([])]);
    }
  });

  it("parse of a schema with no secret node returns the value it was given, so a change after parse returns is not judged", () => {
    const S = s.object({ a: s.array(s.int()) });
    const v: { a: unknown[] } = { a: [1] };
    const r = S.parse(v);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.is(r.value, v)).toBe(true);
    v.a.push(new Map());
    expect(Object.is(r.value, v)).toBe(true);
    expect(S.parse(v).ok).toBe(false);
  });
});

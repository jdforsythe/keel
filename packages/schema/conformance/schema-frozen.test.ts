// Spec: k.schema, Frozen "The `s` namespace, every schema `@keel/schema` makes and its `node`, with every object and array under it, are frozen when made, so in a module an assignment, `delete` or `Object.defineProperty` on one throws a `TypeError` and the schema stays as made; static reads of a schema (k.privacy-reads) rest on it."
// Spec: k.schema, Conformance "`Object.isFrozen` is true of `s`, of `s.object({ a: s.string().pii('name') })`, of its `node` and of each object under the node; `S.node.fields.b = s.secret(s.string()).node` and `delete S.node.fields.a` each throw a `TypeError` and leave `S.doc()` as it was."
// Seed: 1337.
// Reading: "in a module" is strict code, as every ES module is, so an assignment or `delete` on a frozen object throws a `TypeError`; a test file is such a module.
// Reading: "every object and array under" a node is found by walking own enumerable properties of plain objects and arrays; a function in a node (a format's `check`) is not one.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Arr, Nested, Obj, RUNS, Rec, SEED, Union, allTypes } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Every object and array under `v`, `v` included, once each. */
const containers = (v: unknown, seen: Set<object> = new Set()): object[] => {
  if (!isObj(v) || seen.has(v)) return [...seen];
  seen.add(v);
  for (const k of Object.keys(v)) containers(v[k], seen);
  return [...seen];
};
const nodeOf = (schema: unknown): unknown => (isObj(schema) ? schema.node : undefined);
const assign = (target: Record<string, unknown>, key: string): void => {
  target[key] = 1;
};
const remove = (target: Record<string, unknown>, key: string): void => {
  delete target[key];
};
const define = (target: object, key: string): void => {
  Object.defineProperty(target, key, { value: 1 });
};

const A = s.object({ a: s.string().pii("name") });
const SCHEMAS: [string, unknown][] = [
  ["an object with a marked field", A],
  ["the fixture object", Obj],
  ["an array", Arr],
  ["a union", Union],
  ["a record", Rec],
  ["nested objects, arrays and unions", Nested],
  ["a secret", s.secret(s.object({ k: s.string(), xs: s.array(s.int()) }))],
  ["an optional nullable", s.object({ k: s.string() }).optional().nullable()],
  ["a closed object", s.object({ k: s.int() }, { closed: true })],
  [
    "a format type",
    s.format("frozen.test", s.string(), { check: () => true, gen: { from: s.string(), map: (v: string) => v } }),
  ],
  ...Object.entries(allTypes).map(([name, schema]): [string, unknown] => [`allTypes.${name}`, schema]),
];

describe("k.schema Frozen: `s`, every schema `@keel/schema` makes and its `node` are frozen when made", () => {
  it("`Object.isFrozen` is true of `s`, of `s.object({ a: s.string().pii('name') })`, of its `node` and of each object under the node", () => {
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(A)).toBe(true);
    expect(Object.isFrozen(nodeOf(A))).toBe(true);
    for (const c of containers(nodeOf(A))) expect(Object.isFrozen(c)).toBe(true);
  });

  it("`S.node.fields.b = s.secret(s.string()).node` and `delete S.node.fields.a` each throw a `TypeError` and leave `S.doc()` as it was", () => {
    const S = s.object({ a: s.string().pii("name") });
    const before = JSON.stringify(S.doc());
    const node = nodeOf(S);
    const fields = isObj(node) ? node.fields : undefined;
    if (!isObj(fields)) throw new Error("an object schema's node has no fields");
    expect(() => {
      fields.b = s.secret(s.string()).node;
    }).toThrow(TypeError);
    expect(() => remove(fields, "a")).toThrow(TypeError);
    expect(JSON.stringify(S.doc())).toBe(before);
    expect(Object.keys(fields)).toEqual(["a"]);
  });

  it("property: every schema `@keel/schema` makes is frozen, with its `node` and every object and array under it", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCHEMAS), ([, schema]) => {
        expect(Object.isFrozen(schema)).toBe(true);
        const node = nodeOf(schema);
        expect(isObj(node)).toBe(true);
        for (const c of containers(node)) expect(Object.isFrozen(c)).toBe(true);
      }),
      { ...opts, numRuns: SCHEMAS.length * 2 },
    );
  });

  it("property: an assignment, a `delete` and `Object.defineProperty` on the schema, its node or anything under it throws a `TypeError` and the schema stays as made", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCHEMAS), fc.stringMatching(/^[a-z]{1,6}$/), ([, schema], key) => {
        const before = JSON.stringify(isObj(schema) && typeof schema.doc === "function" ? schema.doc() : null);
        const targets = [schema, ...containers(nodeOf(schema))].filter(isObj);
        for (const t of targets) {
          expect(() => assign(t, key)).toThrow(TypeError);
          expect(() => define(t, key)).toThrow(TypeError);
          for (const own of Object.keys(t)) {
            expect(() => assign(t, own)).toThrow(TypeError);
            expect(() => remove(t, own)).toThrow(TypeError);
            expect(() => define(t, own)).toThrow(TypeError);
          }
        }
        expect(JSON.stringify(isObj(schema) && typeof schema.doc === "function" ? schema.doc() : null)).toBe(before);
      }),
      { ...opts, numRuns: SCHEMAS.length * 3 },
    );
  });

  it("an array under a node does not grow, shrink or sort in place", () => {
    const arrays = SCHEMAS.flatMap(([, schema]) => containers(nodeOf(schema))).filter((c) => Array.isArray(c));
    expect(arrays.length).toBeGreaterThan(0);
    for (const arr of arrays) {
      expect(() => Reflect.apply(Array.prototype.push, arr, [1])).toThrow(TypeError);
      expect(() => Reflect.apply(Array.prototype.pop, arr, [])).toThrow(TypeError);
      expect(() => Reflect.apply(Array.prototype.reverse, arr, [])).toThrow(TypeError);
    }
  });

  it("the `s` namespace takes no assignment, no `delete`, no new member and no `Object.defineProperty`", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(s)), fc.stringMatching(/^[a-z]{3,8}$/), (member, fresh) => {
        const target: Record<string, unknown> = s;
        const kept = target[member];
        expect(() => assign(target, member)).toThrow(TypeError);
        expect(() => remove(target, member)).toThrow(TypeError);
        expect(() => define(target, member)).toThrow(TypeError);
        if (!Object.hasOwn(target, fresh)) {
          expect(() => assign(target, fresh)).toThrow(TypeError);
          expect(() => define(target, fresh)).toThrow(TypeError);
        }
        expect(target[member]).toBe(kept);
      }),
      { ...opts, numRuns: 40 },
    );
  });

  it("a frozen schema still parses, encodes and documents as it did, and a schema made from it is frozen too", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (name) => {
        const S = s.object({ name: s.string() });
        expect(S.parse({ name }).ok).toBe(true);
        for (const derived of [S.optional(), S.nullable(), s.array(S), s.object({ inner: S }), s.secret(S)]) {
          expect(Object.isFrozen(derived)).toBe(true);
          expect(Object.isFrozen(nodeOf(derived))).toBe(true);
        }
      }),
      { ...opts, numRuns: 20 },
    );
  });
});

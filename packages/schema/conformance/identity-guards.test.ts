// Spec: k.identity, clause "`isSchema(S)`, `isStore(st)`, `isTransaction(tx)` and `isRouteTable(routes)` are true of what `s.object`, `store`, `transaction` and `manifest` returned, also under a second copy of the guard's package loaded from another path; each is false of `{ ...v }`, of an object given every own key and descriptor of `v`, and of a function or object declaring `Symbol.for('keel.schema')`, `Symbol.for('keel.store')` or `Symbol.for('keel.action')` as an own key."
// Seed 1337. Only the `@keel/schema` guards are asserted here (isSchema, isObjectSchema); the store, transaction and route-table guards are in packages/store and packages/router. A second copy is a second evaluation of the package (`vi.resetModules()`).
import { isObjectSchema, isSchema, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { RUNS, SEED, allTypes } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const S = s.object({ a: s.int() });
const copyOwn = (v: object): object => {
  const o = Object.create(Object.getPrototypeOf(v));
  for (const k of Reflect.ownKeys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d !== undefined) Object.defineProperty(o, k, d);
  }
  return o;
};

describe("k.identity: schema guards", () => {
  it("isSchema(S) and isObjectSchema(S) are true of what s.object returned", () => {
    expect(isSchema(S)).toBe(true);
    expect(isObjectSchema(S)).toBe(true);
    expect(isObjectSchema(s.string())).toBe(false);
  });

  it("isSchema is true of every schema built, under a second copy of @keel/schema too", async () => {
    vi.resetModules();
    const second = await import("@keel/schema");
    expect(second.isSchema(S)).toBe(true);
    expect(second.isSchema(second.s.object({ a: second.s.int() }))).toBe(true);
    expect(isSchema(second.s.string())).toBe(true);
    for (const schema of Object.values(allTypes)) expect(second.isSchema(schema)).toBe(true);
  });

  it("isSchema is false of { ...S } and of an object given every own key and descriptor of S", () => {
    expect(isSchema({ ...S })).toBe(false);
    expect(isObjectSchema({ ...S })).toBe(false);
    expect(isSchema(copyOwn(S))).toBe(false);
    expect(isObjectSchema(copyOwn(S))).toBe(false);
  });

  it("property: a copy of any built schema is no schema", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(allTypes)), (schema) => {
        expect(isSchema({ ...schema })).toBe(false);
        expect(isSchema(copyOwn(schema))).toBe(false);
      }),
      opts,
    );
  });

  it("isSchema is false of a function or object declaring Symbol.for('keel.schema'), keel.store or keel.action as an own key", () => {
    for (const name of ["keel.schema", "keel.store", "keel.action"]) {
      const key = Symbol.for(name);
      expect(isSchema({ [key]: true })).toBe(false);
      expect(isSchema(Object.assign(() => 0, { [key]: true }))).toBe(false);
      expect(isSchema(Object.defineProperty({}, key, { value: true, enumerable: false }))).toBe(false);
    }
  });

  it("a built schema is frozen", () => {
    expect(Object.isFrozen(S)).toBe(true);
  });
});

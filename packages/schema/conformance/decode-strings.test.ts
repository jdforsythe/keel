import { type SchemaError, pathToString, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Clause: object schemas decode string input (k.forms, k.router); parse hardening; construction guard. Seed 1337, 100 runs.
import { describe, expect, it } from "vitest";
import { RUNS, SEED, norm } from "./fixtures";

const Prim = s.object({
  name: s.string({ min: 0, max: 8 }),
  nick: s.string({ min: 1, max: 8 }).optional(),
  age: s.int(),
  score: s.number(),
  admin: s.boolean(),
  role: s.enum(["admin", "member"]),
  kind: s.literal("user"),
  id: s.id("User"),
});

const fails = (r: { ok: boolean }): boolean => !r.ok;
const rulesOf = (r: { ok: true } | { ok: false; error: SchemaError }) => (r.ok ? [] : r.error.data.issues);

describe("k.schema decodeStrings", () => {
  it("encode to URLSearchParams then decodeStrings returns an equal value", () => {
    fc.assert(
      fc.property(gen(Prim), (v) => {
        const wire = new URLSearchParams();
        for (const [k, x] of Object.entries(v)) wire.append(k, String(x));
        const r = Prim.decodeStrings(wire);
        expect(r.ok).toBe(true);
        if (r.ok) expect(norm(r.value)).toEqual(norm(v));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("coerces numbers and reports non-numeric text as rule type", () => {
    const N = s.object({ n: s.number(), i: s.int() });
    expect(N.decodeStrings({ n: "1.5", i: "5" })).toEqual({ ok: true, value: { n: 1.5, i: 5 } });
    expect(rulesOf(N.decodeStrings({ n: "abc", i: "5" }))).toEqual([{ path: ["n"], rule: "type" }]);
    expect(rulesOf(N.decodeStrings({ n: "1", i: "5.5" }))).toEqual([{ path: ["i"], rule: "int" }]);
  });

  it("coerces booleans; absent boolean is false", () => {
    const B = s.object({ a: s.boolean() });
    for (const t of ["true", "on", "1"]) expect(B.decodeStrings({ a: t })).toEqual({ ok: true, value: { a: true } });
    for (const f of ["false", "off", "0"]) expect(B.decodeStrings({ a: f })).toEqual({ ok: true, value: { a: false } });
    expect(B.decodeStrings({})).toEqual({ ok: true, value: { a: false } });
    expect(rulesOf(B.decodeStrings({ a: "maybe" }))).toEqual([{ path: ["a"], rule: "type" }]);
  });

  it("absent key is required, or absent when optional; empty string for optional is absent", () => {
    const O = s.object({ r: s.string(), o: s.string().optional(), n: s.number().optional() });
    expect(rulesOf(O.decodeStrings({}))).toEqual([{ path: ["r"], rule: "required" }]);
    expect(O.decodeStrings({ r: "x", o: "", n: "" })).toEqual({ ok: true, value: { r: "x" } });
    expect(O.decodeStrings({ r: "" })).toEqual({ ok: true, value: { r: "" } });
  });

  it("builds arrays from repeated keys and key[]", () => {
    const A = s.object({ tags: s.array(s.string()), ns: s.array(s.int()) });
    const params = new URLSearchParams([
      ["tags", "a"],
      ["tags", "b"],
      ["ns[]", "1"],
      ["ns[]", "2"],
    ]);
    expect(A.decodeStrings(params)).toEqual({ ok: true, value: { tags: ["a", "b"], ns: [1, 2] } });
    expect(A.decodeStrings({ tags: ["x"], ns: ["3", "4"] })).toEqual({ ok: true, value: { tags: ["x"], ns: [3, 4] } });
    expect(rulesOf(A.decodeStrings({ tags: ["x"], ns: ["3", "z"] }))).toEqual([{ path: ["ns", 1], rule: "type" }]);
  });

  it("builds nested objects from dotted keys", () => {
    const N = s.object({ address: s.object({ city: s.string(), zip: s.int() }), note: s.string() });
    const form = new FormData();
    form.append("address.city", "Oslo");
    form.append("address.zip", "150");
    form.append("note", "hi");
    expect(N.decodeStrings(form)).toEqual({ ok: true, value: { address: { city: "Oslo", zip: 150 }, note: "hi" } });
    expect(rulesOf(N.decodeStrings({ note: "hi" }))).toEqual([{ path: ["address"], rule: "required" }]);
  });

  it("compares literal and enum as strings; id is a string", () => {
    const L = s.object({ v: s.literal(3), b: s.literal(true), e: s.enum(["a", "b"]), id: s.id("U") });
    expect(L.decodeStrings({ v: "3", b: "true", e: "a", id: "7" })).toEqual({
      ok: true,
      value: { v: 3, b: true, e: "a", id: "7" },
    });
    expect(rulesOf(L.decodeStrings({ v: "4", b: "true", e: "c", id: "7" })).map((i) => i.rule)).toEqual([
      "literal",
      "enum",
    ]);
  });

  it("selects union variants by discriminant", () => {
    const U = s.object({
      shape: s.union("kind", [
        s.object({ kind: s.literal("circle"), r: s.number() }),
        s.object({ kind: s.literal("square"), side: s.int() }),
      ]),
    });
    expect(U.decodeStrings({ "shape.kind": "square", "shape.side": "4" })).toEqual({
      ok: true,
      value: { shape: { kind: "square", side: 4 } },
    });
    expect(rulesOf(U.decodeStrings({ "shape.kind": "hex", "shape.side": "4" }))).toEqual([
      { path: ["shape", "kind"], rule: "discriminant" },
    ]);
  });

  it("builds records from the remaining prefixed keys", () => {
    const R = s.object({ tags: s.record(s.int()), x: s.string() });
    expect(R.decodeStrings({ "tags.a": "1", "tags.b": "2", x: "y" })).toEqual({
      ok: true,
      value: { tags: { a: 1, b: 2 }, x: "y" },
    });
  });

  it("decode stays the JSON inverse of encode", () => {
    fc.assert(
      fc.property(gen(Prim), (v) => {
        const r = Prim.decode(Prim.encode(v));
        expect(r.ok).toBe(true);
        if (r.ok) expect(norm(r.value)).toEqual(norm(v));
      }),
      { seed: SEED, numRuns: RUNS },
    );
    expect(fails(Prim.decode({ age: "5" }))).toBe(true);
  });
});

describe("k.schema parse hardening", () => {
  const Obj = s.object({ a: s.int() });
  const poisoned = (key: string): unknown => Object.defineProperty({ a: 1 }, key, { value: 1, enumerable: true });
  for (const key of ["__proto__", "constructor", "prototype"]) {
    it(`parse rejects an object with an own ${key} key (rule type)`, () => {
      const r = Obj.parse(poisoned(key));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "type" }]);
    });
  }
  it("parse reports the path of a nested poisoned object", () => {
    const r = s.object({ o: Obj }).parse({ o: poisoned("__proto__") });
    expect(r.ok ? [] : r.error.data.issues).toEqual([{ path: ["o"], rule: "type" }]);
  });
  it("parse rejects a poisoned record", () => {
    expect(s.record(s.int()).parse(JSON.parse('{"__proto__": 1}')).ok).toBe(false);
  });
});

describe("k.schema construction guard", () => {
  it("s.string throws when min > max", () => {
    expect(() => s.string({ min: 3, max: 2 })).toThrow();
    expect(() => s.string({ min: 2, max: 2 })).not.toThrow();
    expect(() => s.string({ min: 5 })).not.toThrow();
  });
});

describe("k.schema pathToString", () => {
  it("joins segments with dots", () => {
    expect(pathToString(["users", 0, "name"])).toBe("users.0.name");
    expect(pathToString([])).toBe("");
  });
});

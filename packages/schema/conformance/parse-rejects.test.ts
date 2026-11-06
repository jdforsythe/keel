// Clause: parse rejects every invalid shape in the fixture set.
import { describe, expect, it } from "vitest";
import { Arr, Bool, Enum, Int, Lit, Num, Obj, Rec, Str, Union, UserId } from "./fixtures";

const validObj = { id: "u1", name: "a", role: "admin", nick: null };

const cases: ReadonlyArray<readonly [string, { parse(x: unknown): { ok: boolean } }, unknown]> = [
  ["string given number", Str, 1],
  ["string given null", Str, null],
  ["string below min", Str, ""],
  ["string above max", Str, "x".repeat(9)],
  ["number given string", Num, "1"],
  ["number given NaN", Num, Number.NaN],
  ["number given Infinity", Num, Number.POSITIVE_INFINITY],
  ["number given -Infinity", Num, Number.NEGATIVE_INFINITY],
  ["int given 1.5", Int, 1.5],
  ["int given NaN", Int, Number.NaN],
  ["int given string", Int, "1"],
  ["boolean given 0", Bool, 0],
  ['boolean given "true"', Bool, "true"],
  ["literal given other value", Lit, "off"],
  ["literal given wrong type", Lit, 1],
  ["enum given non-member string", Enum, "owner"],
  ["enum given number", Enum, 0],
  ["id given number", UserId, 5],
  ["id given null", UserId, null],
  ["array given non-array", Arr, "nope"],
  ["array given object", Arr, {}],
  ["array with non-int element", Arr, [1, 2.5]],
  ["record given array", Rec, []],
  ["record with bad value", Rec, { a: "x" }],
  ["record given null", Rec, null],
  ["object given null", Obj, null],
  ["object given array", Obj, []],
  ["object given string", Obj, "x"],
  ["object missing required id", Obj, { name: "a", role: "admin", nick: null }],
  ["object missing required name", Obj, { id: "u1", role: "admin", nick: null }],
  ["object missing non-optional nullable key", Obj, { id: "u1", name: "a", role: "admin" }],
  ["object with wrong field type", Obj, { ...validObj, name: 7 }],
  ["object with non-member enum", Obj, { ...validObj, role: "owner" }],
  ["object with null for optional-only key", Obj, { ...validObj, email: null }],
  ["union bad discriminant", Union, { kind: "triangle", r: 1 }],
  ["union missing discriminant", Union, { r: 1 }],
  ["union wrong discriminant type", Union, { kind: 1, r: 1 }],
  ["union variant field mismatch", Union, { kind: "circle", side: 1 }],
  ["union given null", Union, null],
];

describe("k.schema parse rejects invalid shapes", () => {
  for (const [name, schema, input] of cases) {
    it(`rejects ${name}`, () => {
      const r = schema.parse(input);
      expect(r.ok).toBe(false);
    });
  }

  const RULES = [
    "type", "finite", "int", "min", "max", "literal", "enum",
    "required", "optional-null", "nullable-absent", "discriminant",
  ];

  it("failure carries code, path array, and message", () => {
    const r = Obj.parse({ ...validObj, name: 7 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const e = r.error;
      expect(e.code).toBe("schema.invalid");
      expect(typeof e.message).toBe("string");
      expect(e.data.issues.length).toBeGreaterThan(0);
      for (const issue of e.data.issues) {
        expect(Array.isArray(issue.path)).toBe(true);
        expect(typeof issue.rule).toBe("string");
        expect(RULES).toContain(issue.rule);
      }
    }
  });

  it("error path points at the offending key", () => {
    const r = Obj.parse({ ...validObj, name: 7 });
    if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual(["name"]);
    expect(r.ok).toBe(false);
  });

  it("error path points at the offending array index", () => {
    const r = Arr.parse([1, 2, "x"]);
    if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual([2]);
    expect(r.ok).toBe(false);
  });

  it("rule 'enum' when a string is not an enum member", () => {
    const r = Enum.parse("owner");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues[0]?.rule).toBe("enum");
  });

  it("rule 'discriminant' when the union discriminant is not a variant", () => {
    const r = Union.parse({ kind: "triangle", r: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues[0]?.rule).toBe("discriminant");
  });

  it("decode rejects the same invalid shapes as parse", () => {
    expect(Int.decode(1.5).ok).toBe(false);
    expect(Enum.decode("owner").ok).toBe(false);
    expect(Obj.decode({}).ok).toBe(false);
  });
});

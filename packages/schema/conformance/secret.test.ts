// Spec: k.schema, clause "For every generated secret: it parses; `encode`, `String` and `util.inspect` give the marker, `JSON.stringify` the marker's JSON, `structuredClone` an empty object; parsing a raw value yields a secret revealing it; the marker fails with rule `secret-missing`."
// Seed 1337.
import { inspect } from "node:util";
import { type Infer, type Secret, reveal, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const MARKER = "[secret]";
const opts = { seed: SEED, numRuns: RUNS };

const Str = s.secret(s.string());
const Int = s.secret(s.int());
const Obj = s.object({ id: s.int(), token: s.secret(s.string()) });
const Arr = s.array(s.secret(s.string()));

describe("k.schema secrets", () => {
  it("every generated secret parses (string, int, object with nested secret, array of secrets)", () => {
    fc.assert(
      fc.property(gen(Str), gen(Int), gen(Obj), gen(Arr), (a, b, c, d) => {
        expect(Str.parse(a).ok).toBe(true);
        expect(Int.parse(b).ok).toBe(true);
        expect(Obj.parse(c).ok).toBe(true);
        expect(Arr.parse(d).ok).toBe(true);
      }),
      opts,
    );
  });

  it("encode, String and template literals give the marker", () => {
    fc.assert(
      fc.property(gen(Str), gen(Int), (a, b) => {
        expect(Str.encode(a)).toBe(MARKER);
        expect(Int.encode(b)).toBe(MARKER);
        expect(String(a)).toBe(MARKER);
        expect(`${a}`).toBe(MARKER);
        expect(String(b)).toBe(MARKER);
        expect(`${b}`).toBe(MARKER);
      }),
      opts,
    );
  });

  it("util.inspect gives the marker", () => {
    fc.assert(
      fc.property(gen(Str), gen(Int), (a, b) => {
        expect(inspect(a)).toBe(MARKER);
        expect(inspect(b)).toBe(MARKER);
      }),
      opts,
    );
  });

  it("JSON.stringify gives the marker's JSON, also for a secret field inside an object", () => {
    fc.assert(
      fc.property(gen(Str), gen(Obj), (a, o) => {
        expect(JSON.stringify(a)).toBe(JSON.stringify(MARKER));
        expect(JSON.parse(JSON.stringify(o)).token).toBe(MARKER);
      }),
      opts,
    );
  });

  it("structuredClone gives an empty object and the secret has no own enumerable keys", () => {
    fc.assert(
      fc.property(gen(Str), gen(Int), (a, b) => {
        expect(structuredClone(a)).toEqual({});
        expect(structuredClone(b)).toEqual({});
        expect(Object.keys(a)).toEqual([]);
        expect(Object.keys(b)).toEqual([]);
      }),
      opts,
    );
  });

  it("parsing a raw string value yields a secret revealing it", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const r = Str.parse(raw);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(typeof r.value).toBe("object");
          expect(reveal(r.value)).toBe(raw);
        }
      }),
      opts,
    );
  });

  it("parsing a raw int value yields a secret revealing it", () => {
    fc.assert(
      fc.property(fc.integer(), (raw) => {
        const r = Int.parse(raw);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(typeof r.value).toBe("object");
          expect(reveal(r.value)).toBe(raw);
        }
      }),
      opts,
    );
  });

  it("parsing an object with a raw value at the secret field yields a secret revealing it", () => {
    const O = s.object({ token: s.secret(s.string({ min: 1 })) });
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (raw) => {
        const r = O.parse({ token: raw });
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(typeof r.value.token).toBe("object");
          expect(r.value.token).not.toBe(raw);
          expect(reveal(r.value.token)).toBe(raw);
        }
      }),
      opts,
    );
  });

  it("parsing an existing secret returns ok and reveals the same value", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const first = Str.parse(raw);
        expect(first.ok).toBe(true);
        if (first.ok) {
          const again = Str.parse(first.value);
          expect(again.ok).toBe(true);
          if (again.ok) expect(reveal(again.value)).toBe(raw);
        }
      }),
      opts,
    );
  });

  it("the marker fails parse with schema.invalid and rule secret-missing at path []", () => {
    const r = Str.parse(MARKER);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("schema.invalid");
      expect(r.error.data.issues).toEqual([{ path: [], rule: "secret-missing" }]);
    }
  });

  it("the marker fails decode with schema.invalid and rule secret-missing at path []", () => {
    const r = Str.decode(MARKER);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("schema.invalid");
      expect(r.error.data.issues).toEqual([{ path: [], rule: "secret-missing" }]);
    }
  });

  it("the marker at a nested secret fails parse and decode with rule secret-missing at its path", () => {
    const O = s.object({ token: s.secret(s.string()) });
    for (const r of [O.parse({ token: MARKER }), O.decode({ token: MARKER })]) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe("schema.invalid");
        expect(r.error.data.issues).toEqual([{ path: ["token"], rule: "secret-missing" }]);
      }
    }
  });

  it("encode then decode of an object containing a secret fails with secret-missing (the codec never restores a value)", () => {
    fc.assert(
      fc.property(gen(Obj), (o) => {
        const r = Obj.decode(Obj.encode(o));
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("schema.invalid");
          expect(r.error.data.issues.map((i) => i.rule)).toContain("secret-missing");
          expect(r.error.data.issues.some((i) => i.path.join(".") === "token")).toBe(true);
        }
      }),
      opts,
    );
  });

  it("doc() is secret<T>", () => {
    expect(s.secret(s.string()).doc()).toBe("secret<string>");
  });

  it("decodeStrings reads the inner type", () => {
    const O = s.object({ pin: s.secret(s.int()) });
    const r = O.decodeStrings({ pin: "42" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(reveal(r.value.pin)).toBe(42);
  });

  it("infers Secret<T> and reveal returns T", () => {
    const schema = s.secret(s.string());
    type T = Infer<typeof schema>;
    expectTypeOf<T>().toEqualTypeOf<Secret<string>>();
    const r = schema.parse("x");
    if (r.ok) expectTypeOf(reveal(r.value)).toEqualTypeOf<string>();
  });
});

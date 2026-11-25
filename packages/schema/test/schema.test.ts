// Properties for every s.* builder and Schema method. fast-check seed 1337 (fixed for determinism).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gen } from "../src/gen.ts";
import { type Schema, s } from "../src/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const Shape = s.object({
  id: s.id("User"),
  name: s.string({ min: 1, max: 8 }),
  role: s.enum(["admin", "member"]),
  email: s.string().optional(),
  nick: s.string().nullable(),
  bio: s.string().optional().nullable(),
  tags: s.record(s.int()),
  items: s.array(s.number()),
  on: s.boolean(),
  kind: s.literal("x"),
  shape: s.union("k", [s.object({ k: s.literal(1), r: s.number() }), s.object({ k: s.literal(2), w: s.int() })]),
});
const all: ReadonlyArray<readonly [string, Schema<unknown, boolean>]> = [
  ["string", s.string({ min: 2, max: 5 })],
  ["number", s.number()],
  ["int", s.int()],
  ["boolean", s.boolean()],
  ["literal", s.literal(true)],
  ["enum", s.enum(["a", "b", "c"])],
  ["id", s.id("Post")],
  ["array", s.array(s.string().nullable())],
  ["record", s.record(s.boolean())],
  ["object", Shape],
  ["closed object", s.object({ a: s.int(), b: s.string().optional() }, { closed: true })],
  ["member union", s.union([s.string(), s.object({ a: s.int() }, { closed: true }), s.array(s.int())])],
];
const wire = (x: unknown): string => JSON.stringify(x);
const RULES = [
  "type",
  "finite",
  "int",
  "min",
  "max",
  "literal",
  "enum",
  "required",
  "optional-null",
  "nullable-absent",
  "discriminant",
  "unknown-key",
  "secret-missing",
];

describe("every schema", () => {
  for (const [name, T] of all) {
    it(`${name}: parse never throws and errors are well-formed`, () => {
      fc.assert(
        fc.property(fc.anything({ withNullPrototype: true }), (x) => {
          const r = T.parse(x);
          if (!r.ok) {
            expect(r.error.code).toBe("schema.invalid");
            expect(r.error.message.length).toBeLessThan(90);
            expect(r.error.data.issues.length).toBeGreaterThan(0);
            for (const i of r.error.data.issues) expect(RULES).toContain(i.rule);
            expect(JSON.parse(JSON.stringify(r.error))).toEqual(r.error);
          }
        }),
      );
    });
    it(`${name}: parse returns the input by reference`, () => {
      fc.assert(
        fc.property(gen(T), (v) => {
          const r = T.parse(v);
          expect(r.ok && r.value).toBe(v);
        }),
      );
    });
    it(`${name}: has no decode (RFC 0043: parse is the JSON inverse of encode)`, () => {
      expect("decode" in T).toBe(false);
    });
    it(`${name}: encode output is JSON-stable and parses`, () => {
      fc.assert(
        fc.property(gen(T), (v) => {
          const j = T.encode(v);
          expect(wire(JSON.parse(wire(j)))).toBe(wire(j));
          expect(T.parse(j).ok).toBe(true);
        }),
      );
    });
    it(`${name}: encode throws an Error exactly when parse fails`, () => {
      fc.assert(
        fc.property(fc.anything(), (x) => {
          if (T.parse(x).ok) expect(() => T.encode(x)).not.toThrow();
          else expect(() => T.encode(x)).toThrow(/^schema\.invalid: /);
        }),
      );
    });
    it(`${name}: doc is a non-empty string`, () => {
      expect(T.doc().length).toBeGreaterThan(0);
    });
  }
});

describe("primitives", () => {
  it("string honours arbitrary min/max bounds", () => {
    fc.assert(
      fc.property(fc.nat(6), fc.nat(6), fc.string({ maxLength: 15 }), (a, b, x) => {
        const [min, max] = a <= b ? [a, b] : [b, a];
        const ok = x.length >= min && x.length <= max;
        expect(s.string({ min, max }).parse(x).ok).toBe(ok);
      }),
    );
  });
  it("number accepts exactly the finite numbers", () => {
    fc.assert(fc.property(fc.double(), (x) => s.number().parse(x).ok === Number.isFinite(x)));
  });
  it("int accepts exactly the safe integers", () => {
    fc.assert(fc.property(fc.double(), (x) => s.int().parse(x).ok === Number.isSafeInteger(x)));
  });
  it("boolean accepts only booleans", () => {
    fc.assert(fc.property(fc.anything(), (x) => s.boolean().parse(x).ok === (typeof x === "boolean")));
  });
  it("literal accepts only its own value", () => {
    const lit = fc.oneof(fc.string(), fc.integer(), fc.boolean());
    fc.assert(fc.property(lit, lit, (v, x) => s.literal(v).parse(x).ok === (x === v)));
  });
  it("enum accepts members; other strings fail rule enum, non-strings rule type", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { minLength: 1, maxLength: 5 }), fc.anything(), ([first, ...rest], x) => {
        if (first === undefined) return;
        const r = s.enum([first, ...rest]).parse(x);
        const member = typeof x === "string" && [first, ...rest].includes(x);
        expect(r.ok).toBe(member);
        if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: typeof x === "string" ? "enum" : "type" }]);
      }),
    );
  });
  it("id accepts any non-empty string regardless of brand", () => {
    fc.assert(fc.property(fc.string(), fc.string(), (brand, x) => s.id(brand).parse(x).ok === x.length > 0));
  });
});

describe("containers", () => {
  it("array error path is the first bad index", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.nat(), (xs, k) => {
        const i = xs.length === 0 ? 0 : k % xs.length;
        const bad = [...xs.slice(0, i), "x", ...xs.slice(i + 1)];
        const r = s.array(s.int()).parse(bad);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues.map((x) => x.path)).toEqual([[i]]);
      }),
    );
  });
  it("record checks every value and reports the key", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), fc.string(), (d, key) => {
        const r = s.record(s.int()).parse({ ...d, [key]: "x" });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues.map((x) => x.path)).toEqual([[key]]);
      }),
    );
  });
  it("object: absent optional stays absent through encode; unknown keys holding plain data are dropped", () => {
    const T = s.object({ a: s.string().optional() });
    fc.assert(
      fc.property(fc.string(), fc.jsonValue(), (extra, junk) => {
        if (extra === "a" || extra === "__proto__" || extra === "constructor" || extra === "prototype") return;
        const j = T.encode({ [extra]: junk });
        expect(j).toEqual({});
      }),
    );
  });
  it("object: encode throws on an unknown key holding a value that is not plain data (k.schema Plain data)", () => {
    const T = s.object({ a: s.string().optional() });
    for (const junk of [new Map(), undefined, Number.NaN, () => 1, new Uint8Array(1)])
      expect(() => T.encode({ x: junk })).toThrow();
  });
  it("rules optional-null, nullable-absent, required", () => {
    const Opt = s.object({ a: s.int().optional() });
    const Nul = s.object({ a: s.int().nullable() });
    const o = Opt.parse({ a: null });
    const n = Nul.parse({});
    expect(!o.ok && o.error.data.issues).toEqual([{ path: ["a"], rule: "optional-null" }]);
    expect(!n.ok && n.error.data.issues).toEqual([{ path: ["a"], rule: "nullable-absent" }]);
    const m = s.object({ a: s.int() }).parse({});
    expect(!m.ok && m.error.data.issues).toEqual([{ path: ["a"], rule: "required" }]);
  });
  it("modifier order does not matter and modifiers are idempotent", () => {
    const a = s.int().optional().nullable();
    const b = s.int().nullable().optional().nullable().optional();
    expect(b.node).toEqual(a.node);
    expect(a.isOptional && b.isOptional).toBe(true);
  });
  it("union dispatches on the discriminant", () => {
    const U = s.union("t", [
      s.object({ t: s.literal("a"), n: s.int() }),
      s.object({ t: s.literal("b"), n: s.string() }),
    ]);
    fc.assert(
      fc.property(fc.integer(), fc.string(), (i, str) => {
        expect(U.parse({ t: "a", n: i }).ok).toBe(true);
        expect(U.parse({ t: "b", n: str }).ok).toBe(true);
        expect(U.parse({ t: "a", n: str }).ok).toBe(false);
      }),
    );
  });
  it("union construction rejects variants without a unique literal discriminant", () => {
    const A = s.object({ t: s.literal("a") });
    expect(() => s.union("t", [A, s.object({ t: s.literal("a") })])).toThrow(Error);
    expect(() => s.union("t", [A, s.object({ t: s.string() })])).toThrow(Error);
  });
});

describe("issues", () => {
  it("every failing field is reported, in declaration order", () => {
    const T = s.object({ a: s.int(), b: s.string(), c: s.boolean() });
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (ba, bb, bc) => {
        const x = { a: ba ? "bad" : 1, b: bb ? 2 : "ok", c: bc ? null : true };
        const r = T.parse(x);
        const want = [ba && "a", bb && "b", bc && "c"].filter((k) => k !== false);
        expect(r.ok ? [] : r.error.data.issues.map((i) => i.path[0])).toEqual(want);
      }),
    );
  });
  it("numbers distinguish type, finite and int", () => {
    const n = s.number().parse(Number.NaN);
    const i = s.int().parse(1.5);
    const t = s.int().parse("1");
    expect([n, i, t].map((r) => (r.ok ? "ok" : r.error.data.issues[0]?.rule))).toEqual(["finite", "int", "type"]);
  });
  it("union: missing or unknown discriminant is rule discriminant at [key]", () => {
    const U = s.union("t", [s.object({ t: s.literal("a") })]);
    for (const x of [{}, { t: "b" }, { t: 1 }]) {
      const r = U.parse(x);
      expect(!r.ok && r.error.data.issues).toEqual([{ path: ["t"], rule: "discriminant" }]);
    }
  });
});

describe("doc", () => {
  it("one line per field, optional keys marked", () => {
    const T = s.object({
      id: s.id("User"),
      name: s.string({ min: 1, max: 8 }),
      role: s.enum(["admin", "member"]),
      email: s.string().optional(),
      nick: s.string().nullable(),
      tags: s.array(s.int()),
    });
    expect(T.doc()).toBe(
      [
        "id: id<User>",
        "name: string(1..8)",
        'role: "admin"|"member"',
        "email?: string",
        "nick: string | null",
        "tags: array<int>",
      ].join("\n"),
    );
  });
  it("object docs have exactly one line per declared key", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1 }).filter((k) => !k.includes("\n")),
          { minLength: 1 },
        ),
        (keys) => {
          const T = s.object(Object.fromEntries(keys.map((k) => [k, s.boolean()])));
          expect(T.doc().split("\n")).toHaveLength(keys.length);
        },
      ),
    );
  });
});

describe("registry", () => {
  it("register is idempotent for the same schema and rejects a different one", () => {
    fc.assert(
      fc.property(fc.uuid(), (name) => {
        const T = s.int();
        s.register(`prop.${name}`, T);
        s.register(`prop.${name}`, T);
        expect(s.registry().get(`prop.${name}`)).toBe(T);
        expect(() => s.register(`prop.${name}`, s.int())).toThrow(Error);
      }),
    );
  });
  it("registry() returns a snapshot that cannot mutate the registry", () => {
    const snap = s.registry();
    if (snap instanceof Map) snap.set("prop.injected", s.int());
    expect(s.registry().has("prop.injected")).toBe(false);
  });
});

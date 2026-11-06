// Targeted examples pinning construction guards, coercion branches, doc text, and issue messages.
// Property-based parts use fast-check seed 1337 (fixed for determinism).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gen } from "../src/gen.ts";
import { type Schema, attempt, s } from "../src/index.ts";
import type { Issue } from "../src/internal/Issue.ts";
import type { Node } from "../src/internal/Node.ts";
import { clip } from "../src/internal/clip.ts";
import { fromStrings } from "../src/internal/fromStrings.ts";
import { invalid } from "../src/internal/invalid.ts";
import { issueText } from "../src/internal/issueText.ts";
import { stringEntries } from "../src/internal/stringEntries.ts";
import { toJson } from "../src/internal/toJson.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const THEN: string = "then";
const entries = (o: Record<string, string[]>): Map<string, string[]> => new Map(Object.entries(o));
const issue = (path: (string | number)[], rule: Issue["rule"]): Issue => ({ path, rule });
const sample = <T>(arb: fc.Arbitrary<T>, n = 60): T[] => fc.sample(arb, { seed: 1337, numRuns: n });

describe("s.* construction guards", () => {
  it("rejects non-finite number and int bounds with the kind in the message", () => {
    expect(() => s.number({ min: Number.NaN })).toThrow("number bound NaN is not finite");
    expect(() => s.number({ max: Number.POSITIVE_INFINITY })).toThrow("number bound Infinity is not finite");
    expect(() => s.int({ min: Number.NEGATIVE_INFINITY })).toThrow("int bound -Infinity is not finite");
    expect(() => s.int({ max: Number.NaN })).toThrow("int bound NaN is not finite");
  });

  it("rejects min above max, accepts equal and one-sided bounds", () => {
    expect(() => s.number({ min: 3, max: 2 })).toThrow("number min 3 exceeds max 2");
    expect(() => s.int({ min: 3, max: 2 })).toThrow("int min 3 exceeds max 2");
    expect(() => s.string({ min: 5, max: 3 })).toThrow("string min 5 exceeds max 3");
    expect(() => s.number({ min: 2, max: 2 })).not.toThrow();
    expect(() => s.int({ min: 2, max: 2 })).not.toThrow();
    expect(() => s.string({ min: 3, max: 3 })).not.toThrow();
    expect(() => s.number({ min: 2 })).not.toThrow();
    expect(() => s.number({ max: 2 })).not.toThrow();
    expect(() => s.int({ min: 2 })).not.toThrow();
    expect(() => s.int({ max: 2 })).not.toThrow();
    expect(() => s.string({ max: 3 })).not.toThrow();
    expect(() => s.string({ min: 3 })).not.toThrow();
  });

  it("rejects an int range that holds no integer, only for int", () => {
    expect(() => s.int({ min: 1.2, max: 1.8 })).toThrow("int range 1.2..1.8 contains no integer");
    expect(() => s.int({ min: 1.2, max: 2.1 })).not.toThrow();
    expect(() => s.int({ min: 1.2 })).not.toThrow();
    expect(() => s.int({ max: 1.2 })).not.toThrow();
    expect(() => s.number({ min: 1.2, max: 1.8 })).not.toThrow();
  });

  it("keeps bound keys only when set, so nodes stay plain JSON", () => {
    expect(s.number().node).toStrictEqual({ kind: "number" });
    expect(s.number({ min: 1 }).node).toStrictEqual({ kind: "number", min: 1 });
    expect(s.number({ max: 2 }).node).toStrictEqual({ kind: "number", max: 2 });
    expect(s.number({ min: 1, max: 2 }).node).toStrictEqual({ kind: "number", min: 1, max: 2 });
    expect(s.int().node).toStrictEqual({ kind: "int" });
    expect(s.int({ min: 1 }).node).toStrictEqual({ kind: "int", min: 1 });
    expect(s.int({ max: 2 }).node).toStrictEqual({ kind: "int", max: 2 });
    expect(s.int({ min: 1, max: 2 }).node).toStrictEqual({ kind: "int", min: 1, max: 2 });
    expect(s.string({ max: 4 }).node).toStrictEqual({ kind: "string", min: 0, max: 4 });
  });

  it("builders are required, not optional, until .optional()", () => {
    const base: Schema<unknown, boolean>[] = [
      s.string(),
      s.number(),
      s.int(),
      s.boolean(),
      s.literal("a"),
      s.enum(["a"]),
      s.id("A"),
      s.object({ a: s.int() }),
      s.array(s.int()),
      s.record(s.int()),
      s.union("k", [s.object({ k: s.literal("a") })]),
      s.result(s.int(), s.string()),
      s.error("a.b", s.int()),
    ];
    for (const b of base) {
      expect(b.isOptional).toBe(false);
      expect(b.optional().isOptional).toBe(true);
    }
  });

  it("union rejects variants lacking a unique literal discriminant, naming the first bad one", () => {
    const A = s.object({ t: s.literal("a") });
    const B = s.object({ t: s.literal("b") });
    const key: string = "t";
    const bare = s.object({ other: s.int() });
    const loose = s.object({ t: s.string() });
    expect(() => s.union(key, [A, B])).not.toThrow();
    expect(() => s.union(key, [A, A])).toThrow("union variant 1 needs a unique literal t");
    expect(() => s.union(key, [A, B, A])).toThrow("union variant 2 needs a unique literal t");
    expect(() => s.union(key, [bare])).toThrow("union variant 0 needs a unique literal t");
    expect(() => s.union(key, [loose])).toThrow("union variant 0 needs a unique literal t");
    expect(() => s.union(key, [A, loose])).toThrow("union variant 1 needs a unique literal t");
  });

  it("register reports the clipped name on a conflicting registration", () => {
    const name = `mutants.${"x".repeat(60)}`;
    s.register(name, s.int());
    expect(() => s.register(name, s.string())).toThrow(`${clip(name)} is registered to a different schema`);
  });
});

describe("clip", () => {
  it("keeps text up to max and ellipsizes beyond", () => {
    expect(clip("x".repeat(40))).toBe("x".repeat(40));
    expect(clip("x".repeat(41))).toBe(`${"x".repeat(39)}…`);
    expect(clip("abc", 3)).toBe("abc");
    expect(clip("abcd", 3)).toBe("ab…");
    expect(clip("")).toBe("");
  });
});

describe("issue messages", () => {
  it("invalid summarises the first issue and counts the rest", () => {
    expect(invalid([]).message).toBe("type at root");
    expect(invalid([issue([], "min")]).message).toBe("min at root");
    expect(invalid([issue(["a", 0, "b"], "max")]).message).toBe("max at a.0.b");
    expect(invalid([issue(["a"], "min"), issue(["b"], "max")]).message).toBe("min at a (+1 more)");
    expect(invalid([issue(["a"], "min"), issue(["b"], "max"), issue(["c"], "type")]).message).toBe(
      "min at a (+2 more)",
    );
    const longPath = ["k".repeat(60)];
    expect(invalid([issue(longPath, "type")]).message).toBe(`type at ${clip("k".repeat(60))}`);
    const e = invalid([issue(["a"], "min")]);
    expect(e.code).toBe("schema.invalid");
    expect(e.data).toStrictEqual({ issues: [issue(["a"], "min")] });
  });

  it("issueText lists up to five issues and counts the rest", () => {
    expect(issueText([])).toBe("schema.invalid: ");
    expect(issueText([issue([], "type")])).toBe("schema.invalid: type at root");
    expect(issueText([issue(["a", 1], "min"), issue(["b"], "max")])).toBe("schema.invalid: min at a.1; max at b");
    const five = Array.from({ length: 5 }, (_, i) => issue([`f${i}`], "type"));
    expect(issueText(five)).toBe("schema.invalid: type at f0; type at f1; type at f2; type at f3; type at f4");
    const six = [...five, issue(["f5"], "type")];
    expect(issueText(six)).toBe("schema.invalid: type at f0; type at f1; type at f2; type at f3; type at f4 (+1 more)");
    expect(issueText([...six, issue(["f6"], "min")])).toMatch(/\(\+2 more\)$/);
  });

  it("a non-object union value is a type issue at its own path", () => {
    const U = s.union("k", [s.object({ k: s.literal("a") })]);
    const r = U.parse(5);
    expect(!r.ok && r.error.data.issues).toStrictEqual([issue([], "type")]);
    const nested = s.object({ u: U }).parse({ u: "x" });
    expect(!nested.ok && nested.error.data.issues).toStrictEqual([issue(["u"], "type")]);
  });
});

describe("doc text", () => {
  it("renders string and numeric bounds", () => {
    expect(s.string().doc()).toBe("string");
    expect(s.string({ min: 1 }).doc()).toBe("string(1..)");
    expect(s.string({ max: 5 }).doc()).toBe("string(0..5)");
    expect(s.string({ min: 2, max: 5 }).doc()).toBe("string(2..5)");
    expect(s.number().doc()).toBe("number");
    expect(s.number({ min: 1 }).doc()).toBe("number(1..)");
    expect(s.number({ max: 2 }).doc()).toBe("number(..2)");
    expect(s.number({ min: 1, max: 2 }).doc()).toBe("number(1..2)");
    expect(s.int().doc()).toBe("int");
    expect(s.int({ min: 1 }).doc()).toBe("int(1..)");
    expect(s.int({ max: 2 }).doc()).toBe("int(..2)");
    expect(s.int({ min: 1, max: 2 }).doc()).toBe("int(1..2)");
  });

  it("renders scalars, wrappers, and containers", () => {
    expect(s.boolean().doc()).toBe("boolean");
    expect(s.literal("a").doc()).toBe('"a"');
    expect(s.literal(3).doc()).toBe("3");
    expect(s.enum(["a", "b"]).doc()).toBe('"a"|"b"');
    expect(s.id("User").doc()).toBe("id<User>");
    expect(s.string().nullable().doc()).toBe("string | null");
    expect(s.string().optional().doc()).toBe("string");
    expect(s.array(s.int()).doc()).toBe("array<int>");
    expect(s.record(s.boolean()).doc()).toBe("record<boolean>");
    const U = s.union("k", [s.object({ k: s.literal("a") }), s.object({ k: s.literal("b"), n: s.int() })]);
    expect(U.doc()).toBe('{ k: "a" } | { k: "b", n: int }');
    expect(s.array(s.object({ a: s.int(), b: s.string().optional(), c: s.string().nullable() })).doc()).toBe(
      "array<{ a: int, b?: string, c: string | null }>",
    );
    expect(s.object({ a: s.int(), b: s.string().optional() }).doc()).toBe("a: int\nb?: string");
  });
});

describe("fromStrings coercion", () => {
  const Deep = s.object({ o: s.object({ a: s.string() }).optional(), b: s.boolean().optional() });
  it("optional fields are absent unless an entry sits at or under their key", () => {
    expect(fromStrings(Deep.node, "", entries({ other: ["x"] }))).toStrictEqual({});
    expect(fromStrings(Deep.node, "", entries({ "o.a": ["x"] }))).toStrictEqual({ o: { a: "x" } });
    expect(fromStrings(Deep.node, "", entries({ b: ["on"] }))).toStrictEqual({ b: true });
    expect(fromStrings(Deep.node, "", entries({ b: [""] }))).toStrictEqual({});
  });

  it("optional arrays read key and key[] entries", () => {
    const N = s.object({ t: s.array(s.int()).optional() });
    expect(fromStrings(N.node, "", entries({ "t[]": ["1", "2"] }))).toStrictEqual({ t: [1, 2] });
    expect(fromStrings(N.node, "", entries({ t: ["1"], "t[]": ["2"] }))).toStrictEqual({ t: [1, 2] });
    expect(fromStrings(N.node, "", entries({}))).toStrictEqual({});
  });

  it("required nested objects and arrays stay absent so parse reports required", () => {
    const N = s.object({ o: s.object({ a: s.string() }), t: s.array(s.int()) });
    expect(fromStrings(N.node, "", entries({}))).toStrictEqual({});
    const r = N.decodeStrings({});
    expect(!r.ok && r.error.data.issues).toStrictEqual([issue(["o"], "required"), issue(["t"], "required")]);
  });

  it("nullable maps absent and empty text to null, otherwise keeps the value", () => {
    const N = s.object({ n: s.string().nullable(), m: s.int().nullable() });
    expect(fromStrings(N.node, "", entries({}))).toStrictEqual({ n: null, m: null });
    expect(fromStrings(N.node, "", entries({ n: [""], m: [""] }))).toStrictEqual({ n: null, m: null });
    expect(fromStrings(N.node, "", entries({ n: ["x"], m: ["4"] }))).toStrictEqual({ n: "x", m: 4 });
  });

  it("unions pick the variant by tag text and coerce its fields", () => {
    const U = s.object({
      u: s.union("k", [s.object({ k: s.literal("a"), n: s.string() }), s.object({ k: s.literal(2), n: s.int() })]),
    });
    expect(fromStrings(U.node, "", entries({ "u.k": ["2"], "u.n": ["5"] }))).toStrictEqual({ u: { k: 2, n: 5 } });
    expect(fromStrings(U.node, "", entries({ "u.k": ["a"], "u.n": ["5"] }))).toStrictEqual({ u: { k: "a", n: "5" } });
    expect(fromStrings(U.node, "", entries({ "u.k": ["zzz"], "u.n": ["5"] }))).toStrictEqual({ u: { k: "zzz" } });
    expect(fromStrings(U.node, "", entries({ "u.n": ["5"] }))).toStrictEqual({ u: {} });
    expect(fromStrings(U.node, "", entries({}))).toStrictEqual({});
  });

  it("records read leaf names with dots, nested names by first segment", () => {
    const str: Node = { kind: "string", min: 0, max: undefined };
    const L: Node = {
      kind: "object",
      fields: {
        m: { kind: "record", value: { kind: "nullable", inner: str } },
        o: { kind: "record", value: { kind: "optional", inner: str } },
      },
    };
    expect(fromStrings(L, "", entries({ "m.a.b": ["x"], "m.c": ["y"], "o.d.e": ["z"] }))).toStrictEqual({
      m: { "a.b": "x", c: "y" },
      o: { "d.e": "z" },
    });
    const R = s.object({ r: s.record(s.object({ a: s.int(), b: s.string().optional() })) });
    expect(fromStrings(R.node, "", entries({ "r.k1.a": ["1"], "r.k1.b": ["x"], "r.k2.a": ["2"] }))).toStrictEqual({
      r: { k1: { a: 1, b: "x" }, k2: { a: 2 } },
    });
    expect(fromStrings(R.node, "", entries({ r: ["stray"], "r.k.a": ["3"] }))).toStrictEqual({ r: { k: { a: 3 } } });
  });

  it("records drop members whose value is absent", () => {
    const R: Node = {
      kind: "object",
      fields: { r: { kind: "record", value: { kind: "optional", inner: { kind: "string", min: 0, max: undefined } } } },
    };
    expect(fromStrings(R, "", entries({ "r.a": [""], "r.b": ["x"] }))).toStrictEqual({ r: { b: "x" } });
  });
});

describe("stringEntries", () => {
  it("drops File entries from FormData and keeps strings, lists, and records", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("a", "2");
    fd.append("f", new File(["x"], "x.txt"));
    expect([...stringEntries(fd)]).toStrictEqual([["a", ["1", "2"]]]);
    expect([...stringEntries(new URLSearchParams("a=1&b=2&a=3"))]).toStrictEqual([
      ["a", ["1", "3"]],
      ["b", ["2"]],
    ]);
    expect([...stringEntries({ a: "1", b: ["2", "3"], c: [] })]).toStrictEqual([
      ["a", ["1"]],
      ["b", ["2", "3"]],
    ]);
  });
});

describe("toJson", () => {
  it("encodes through optional and nullable wrappers around containers", () => {
    const S = s.object({
      a: s.array(s.int()).optional(),
      b: s.object({ x: s.int() }).nullable(),
      c: s.object({ y: s.int() }).optional(),
      d: s.record(s.int()).nullable(),
    });
    const v = { a: [1, 2], b: { x: 1 }, c: { y: 2 }, d: { k: 3 } };
    expect(S.encode(v)).toStrictEqual(v);
    expect(S.encode({ b: null, d: null })).toStrictEqual({ b: null, d: null });
  });

  it("refuses values the node cannot encode", () => {
    const msg = "value cannot be encoded by this schema";
    expect(() => toJson(s.string().node, [1])).toThrow(msg);
    expect(() => toJson(s.object({}).node, [1])).toThrow(msg);
    expect(() => toJson(s.record(s.int()).node, [1])).toThrow(msg);
    expect(() => toJson(s.string().node, { a: 1 })).toThrow(msg);
    expect(() => toJson(s.int().node, undefined)).toThrow(msg);
    const U: Node = { kind: "union", key: "k", variants: [s.object({ k: s.literal("a") }).node] };
    expect(() => toJson(U, { k: "zzz" })).toThrow(msg);
    expect(toJson(U, { k: "a", extra: 1 })).toStrictEqual({ k: "a" });
  });
});

describe("attempt", () => {
  it("treats thenable objects and functions as async, plain values as sync", async () => {
    const thenable = { [THEN]: (res: (v: number) => void) => res(7) };
    const fnThenable = Object.assign(() => 0, { [THEN]: (res: (v: number) => void) => res(8) });
    expect(await attempt(() => thenable)).toStrictEqual({ ok: true, value: 7 });
    expect(await attempt(() => fnThenable)).toStrictEqual({ ok: true, value: 8 });
    const plain = { [THEN]: 5 };
    expect(attempt(() => plain)).toStrictEqual({ ok: true, value: plain });
    const f = () => 1;
    expect(attempt(() => f)).toStrictEqual({ ok: true, value: f });
    expect(attempt(() => null)).toStrictEqual({ ok: true, value: null });
  });

  it("describes whatever was thrown", () => {
    const cause = (thrown: unknown): unknown => {
      const r = attempt(() => {
        throw thrown;
      });
      return !r.ok && r.error.data.cause;
    };
    expect(cause("boom")).toBe("boom");
    expect(cause(new TypeError("bad"))).toBe("TypeError: bad");
    expect(cause({ a: 1 })).toBe('{"a":1}');
    expect(cause(undefined)).toBe("undefined");
    expect(cause(10n)).toBe("[object BigInt]");
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(cause(loop)).toBe("[object Object]");
  });
});

describe("gen", () => {
  it("respects numeric bounds without relying on the post-filter", () => {
    for (const v of sample(gen(s.number({ min: 1e6, max: 1e6 + 5 })))) expect(v).toBeGreaterThanOrEqual(1e6);
    for (const v of sample(gen(s.number({ min: 1e9 })))) expect(v).toBeGreaterThanOrEqual(1e9);
    for (const v of sample(gen(s.number({ max: -1e9 })))) expect(v).toBeLessThanOrEqual(-1e9);
    const ints = new Set(sample(gen(s.int({ min: 5, max: 7 })), 100));
    expect([...ints].sort()).toStrictEqual([5, 6, 7]);
    for (const v of sample(gen(s.int({ min: 1e6 })))) expect(v).toBeGreaterThanOrEqual(1e6);
    for (const v of sample(gen(s.int({ max: -1e6 })))) expect(v).toBeLessThanOrEqual(-1e6);
  });

  it("produces bounded strings, nulls, and optional keys that are sometimes absent", () => {
    for (const v of sample(gen(s.string({ min: 12, max: 12 })), 20)) expect(v).toHaveLength(12);
    for (const v of sample(gen(s.string({ min: 12 })), 20)) expect(v.length).toBeGreaterThanOrEqual(12);
    const nulls = sample(gen(s.int().nullable()), 100);
    expect(nulls).toContain(null);
    expect(nulls.some((v) => typeof v === "number")).toBe(true);
    expect(sample(gen(s.string().optional())).every((v) => typeof v === "string")).toBe(true);
    const objs = sample(gen(s.object({ a: s.int(), b: s.string().optional() })), 100);
    expect(objs.some((o) => "b" in o)).toBe(true);
    expect(objs.some((o) => !("b" in o))).toBe(true);
    expect(objs.every((o) => typeof o.a === "number")).toBe(true);
  });
});

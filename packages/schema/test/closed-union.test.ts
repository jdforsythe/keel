// Unit and property tests for rfc:0029 internals: closed objects (node flag, unknown-key, doc and type text)
// and member unions (anyOf: check, seal, toJson, fromStrings, gen, hasSecret). fast-check seed 1337.
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Secret } from "../src/Secret.ts";
import { gen } from "../src/gen.ts";
import { reveal, s } from "../src/index.ts";
import type { Node } from "../src/internal/Node.ts";
import { fits } from "../src/internal/fits.ts";
import { fromStrings } from "../src/internal/fromStrings.ts";
import { hasSecret } from "../src/internal/hasSecret.ts";
import { seal } from "../src/internal/seal.ts";
import { toJson } from "../src/internal/toJson.ts";
import { typeText } from "../src/internal/typeText.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const issuesOf = (r: { ok: true } | { ok: false; error: { data: { issues: unknown } } }): unknown =>
  r.ok ? [] : r.error.data.issues;
const entries = (q: string): Map<string, string[]> => {
  const m = new Map<string, string[]>();
  for (const [k, v] of new URLSearchParams(q)) m.set(k, [...(m.get(k) ?? []), v]);
  return m;
};

const Pair = s.object({ light: s.string(), dark: s.string() }, { closed: true });
const Color = s.union([s.string(), Pair]);

describe("closed objects", () => {
  it("marks the node only when closed, so open nodes stay unchanged", () => {
    expect(Pair.node).toEqual({
      kind: "object",
      fields: { light: { kind: "string", min: 0, max: undefined }, dark: { kind: "string", min: 0, max: undefined } },
      closed: true,
    });
    expect(Object.hasOwn(s.object({ a: s.int() }).node, "closed")).toBe(false);
    expect(Object.hasOwn(s.object({ a: s.int() }, { closed: false }).node, "closed")).toBe(false);
  });

  it("reports every undeclared key, in key order, alongside field issues", () => {
    const r = Pair.parse({ x: 1, light: 2, dark: "d", y: { __proto__: null } });
    expect(issuesOf(r)).toEqual([
      { path: ["x"], rule: "unknown-key" },
      { path: ["y"], rule: "unknown-key" },
      { path: ["light"], rule: "type" },
    ]);
  });

  it("open objects still scan undeclared data for prototype keys; closed ones report the key itself", () => {
    const bad = JSON.parse('{"light":"a","dark":"b","x":{"__proto__":1}}');
    expect(issuesOf(s.object({ light: s.string(), dark: s.string() }).parse(bad))).toEqual([
      { path: ["x"], rule: "type" },
    ]);
    expect(issuesOf(Pair.parse(bad))).toEqual([{ path: ["x"], rule: "unknown-key" }]);
    expect(issuesOf(Pair.parse(JSON.parse('{"light":"a","dark":"b","__proto__":1}')))).toEqual([
      { path: [], rule: "type" },
    ]);
  });

  it("fails encode for a value with undeclared keys", () => {
    expect(() => Pair.encode({ light: "a", dark: "b", z: 1 })).toThrow(/unknown-key at z/);
  });

  it("writes closed objects as {| |} in type text and doc", () => {
    expect(typeText(Pair.node)).toBe("{| light: string, dark: string |}");
    expect(typeText(s.object({ a: s.int().optional() }).node)).toBe("{ a?: int }");
    expect(Pair.doc()).toBe("{|\nlight: string\ndark: string\n|}");
    expect(s.object({ a: s.int() }).doc()).toBe("a: int");
    expect(s.object({ c: Pair.optional() }).doc()).toBe("c?: {| light: string, dark: string |}");
  });

  it("accepts every generated value and rejects it with any extra key", () => {
    fc.assert(
      fc.property(gen(Pair), fc.stringMatching(/^[a-z]{3,6}$/), (v, k) => {
        expect(Pair.parse(v).ok).toBe(true);
        const r = Pair.parse({ ...v, [k]: v.light });
        expect(issuesOf(r)).toEqual(k === "light" || k === "dark" ? [] : [{ path: [k], rule: "unknown-key" }]);
      }),
    );
  });
});

describe("member unions (anyOf)", () => {
  const Mixed = s.union([s.int(), s.secret(s.string({ min: 1 })), s.object({ a: s.boolean() })]);

  it("builds an anyOf node of the members in order", () => {
    expect(s.union([s.int(), s.boolean()]).node).toEqual({
      kind: "anyOf",
      members: [{ kind: "int" }, { kind: "boolean" }],
    });
  });

  it("infers the union of member types", () => {
    expectTypeOf<s.infer<typeof Color>>().toEqualTypeOf<string | { light: string; dark: string }>();
  });

  it("stops at the first member that accepts and otherwise reports the last member's issues at the full path", () => {
    const O = s.object({ c: Color });
    expect(O.parse({ c: "red" }).ok).toBe(true);
    expect(issuesOf(O.parse({ c: { light: "a" } }))).toEqual([{ path: ["c", "dark"], rule: "required" }]);
    expect(issuesOf(O.parse({ c: null }))).toEqual([{ path: ["c"], rule: "type" }]);
    expect(issuesOf(s.union([s.object({ a: s.int() }), s.string()]).parse({ a: "x" }))).toEqual([
      { path: [], rule: "type" },
    ]);
  });

  it("seals raw values only for the member that accepts them", () => {
    expect(hasSecret(Mixed.node)).toBe(true);
    expect(hasSecret(s.union([s.int(), s.string()]).node)).toBe(false);
    const n = Mixed.parse(3);
    expect(n.ok && n.value).toBe(3);
    const pw = Mixed.parse("pw");
    expect(pw.ok && Secret.is(pw.value) && reveal(pw.value)).toBe("pw");
    expect(Mixed.parse({ a: true }).ok).toBe(true);
    expect(seal(Mixed.node, "")).toBe("");
    expect(issuesOf(Mixed.parse(""))).toEqual([{ path: [], rule: "type" }]);
  });

  it("encodes through the first accepting member", () => {
    expect(Mixed.encode(3)).toBe(3);
    expect(Mixed.encode(Secret.of("pw"))).toBe("[secret]");
    expect(Mixed.encode({ a: false, extra: 1 })).toEqual({ a: false });
    expect(toJson(s.union([s.object({ a: s.int() }), s.object({ b: s.int() })]).node, { a: 1, b: 2 })).toEqual({
      a: 1,
    });
    expect(() => Mixed.encode("")).toThrow(/type at root/);
  });

  it("builds string candidates member by member, keeping the last when none fits", () => {
    const node: Node = s.union([s.int(), s.object({ x: s.int() })]).node;
    expect(fromStrings(node, "c", entries("c=3"))).toBe(3);
    expect(fromStrings(node, "c", entries("c.x=4"))).toEqual({ x: 4 });
    expect(fromStrings(node, "c", entries("d=1"))).toBeUndefined();
    const O = s.object({ c: s.union([s.int(), s.object({ x: s.int() })]) });
    expect(issuesOf(O.decodeStrings(new URLSearchParams("c=abc")))).toEqual([{ path: ["c", "x"], rule: "required" }]);
    expect(issuesOf(O.decodeStrings(new URLSearchParams("")))).toEqual([{ path: ["c"], rule: "required" }]);
    const R = s.object({ color: s.record(Color) });
    const r = R.decodeStrings(new URLSearchParams("color.accent=red&color.fg.light=a&color.fg.dark=b"));
    expect(r.ok && r.value).toEqual({ color: { accent: "red", fg: { light: "a", dark: "b" } } });
  });

  it("generates values from every member, all accepted, all round-tripping", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(gen(Color), (v) => {
        seen.add(typeof v);
        expect(fits(Color.node, v)).toBe(true);
        expect(Color.decode(JSON.parse(JSON.stringify(Color.encode(v))))).toEqual({ ok: true, value: v });
      }),
    );
    expect([...seen].sort()).toEqual(["object", "string"]);
  });

  it("renders members joined by |, nullable appending null", () => {
    expect(typeText(Color.nullable().node)).toBe("string | {| light: string, dark: string |} | null");
  });

  it("keeps discriminated unions working beside member unions", () => {
    const U = s.union("t", [s.object({ t: s.literal("a") }), s.object({ t: s.literal("b"), n: s.int() })]);
    expect(U.node.kind).toBe("union");
    expect(U.parse({ t: "b", n: 1 }).ok).toBe(true);
    expect(() => s.union("t", [s.object({ t: s.literal("a") }), s.object({ t: s.literal("a") })])).toThrow(/variant 1/);
  });
});

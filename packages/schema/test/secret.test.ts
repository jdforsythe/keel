// Unit tests for s.secret internals: sealing through every container, hasSecret, the check branches, doc text,
// decodeStrings unwrapping, and Secret's own surface. fast-check seed 1337 (fixed for determinism).
import { inspect } from "node:util";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Secret } from "../src/Secret.ts";
import { gen } from "../src/gen.ts";
import { reveal, s } from "../src/index.ts";
import type { Node } from "../src/internal/Node.ts";
import { SECRET_MARKER } from "../src/internal/SECRET_MARKER.ts";
import { hasSecret } from "../src/internal/hasSecret.ts";
import { seal } from "../src/internal/seal.ts";
import { secretAccess } from "../src/internal/secretAccess.ts";
import { toJson } from "../src/internal/toJson.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const secretNode: Node = { kind: "secret", inner: { kind: "string", min: 0, max: undefined } };
const str: Node = { kind: "string", min: 0, max: undefined };
const revealed = (x: unknown): unknown => (secretAccess.is(x) ? reveal(x) : "not a secret");

describe("Secret", () => {
  it("prints only the marker through every conversion", () => {
    const v = secretAccess.of("hunter2", str);
    expect(SECRET_MARKER).toBe("[secret]");
    expect([String(v), `${v}`, `${v.toString()}`, v.toJSON(), inspect(v), inspect({ v })]).toEqual([
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
      "[secret]",
      "{ v: [secret] }",
    ]);
    expect(JSON.stringify({ v })).toBe('{"v":"[secret]"}');
    expect(Object.keys(v)).toEqual([]);
    expect({ ...v }).toEqual({});
    expect(Object.isFrozen(v)).toBe(true);
    expect(reveal(v)).toBe("hunter2");
  });
  it("is() accepts only real secrets", () => {
    for (const x of [
      null,
      undefined,
      "[secret]",
      1,
      {},
      { toJSON: () => "[secret]" },
      structuredClone(secretAccess.of(1, str)),
    ])
      expect(secretAccess.is(x)).toBe(false);
    expect(secretAccess.is(secretAccess.of(null, str))).toBe(true);
  });
});

describe("hasSecret", () => {
  it("finds a secret under every container kind and nowhere else", () => {
    const yes: Node[] = [
      secretNode,
      { kind: "optional", inner: secretNode },
      { kind: "nullable", inner: secretNode },
      { kind: "array", item: secretNode },
      { kind: "record", value: secretNode },
      { kind: "object", fields: { a: str, b: secretNode } },
      s.union("t", [s.object({ t: s.literal(1) }), s.object({ t: s.literal(2), k: s.secret(s.int()) })]).node,
    ];
    const no: Node[] = [
      str,
      { kind: "optional", inner: str },
      { kind: "nullable", inner: str },
      { kind: "array", item: str },
      { kind: "record", value: str },
      { kind: "object", fields: { a: str } },
      s.union("t", [s.object({ t: s.literal(1) })]).node,
      { kind: "json" },
    ];
    for (const n of yes) expect(hasSecret(n)).toBe(true);
    for (const n of no) expect(hasSecret(n)).toBe(false);
  });
});

describe("seal", () => {
  it("wraps raw values, keeps secrets, the marker and null", () => {
    const kept = secretAccess.of("a", str);
    expect(seal(secretNode, kept)).toBe(kept);
    expect(seal(secretNode, "[secret]")).toBe("[secret]");
    expect(revealed(seal(secretNode, "a"))).toBe("a");
    expect(seal({ kind: "nullable", inner: secretNode }, null)).toBe(null);
    expect(revealed(seal({ kind: "optional", inner: secretNode }, "o"))).toBe("o");
    expect(seal(str, "plain")).toBe("plain");
  });
  it("wraps inside arrays, records, objects and union variants, keeping undeclared keys", () => {
    const arr = seal({ kind: "array", item: secretNode }, ["a", "b"]);
    expect(Array.isArray(arr) && arr.map(revealed)).toEqual(["a", "b"]);
    const rec = seal({ kind: "record", value: secretNode }, { x: "1" });
    expect(revealed(Reflect.get(Object(rec), "x"))).toBe("1");
    const obj = seal({ kind: "object", fields: { k: secretNode, n: str, gone: secretNode } }, { k: "s", n: "n", u: 1 });
    expect(Object.keys(Object(obj)).sort()).toEqual(["k", "n", "u"]);
    expect(revealed(Reflect.get(Object(obj), "k"))).toBe("s");
    expect(Reflect.get(Object(obj), "n")).toBe("n");
    const U = s.union("t", [s.object({ t: s.literal(1), k: s.secret(s.string()) }), s.object({ t: s.literal(2) })]);
    expect(revealed(Reflect.get(Object(seal(U.node, { t: 1, k: "u" })), "k"))).toBe("u");
    const other = { t: 3, k: "u" };
    expect(seal(U.node, other)).toBe(other);
  });
  it("leaves values of the wrong container type untouched", () => {
    for (const x of [1, "s", null]) {
      expect(seal({ kind: "array", item: secretNode }, x)).toBe(x);
      expect(seal({ kind: "record", value: secretNode }, x)).toBe(x);
      expect(seal({ kind: "object", fields: { k: secretNode } }, x)).toBe(x);
      expect(seal(s.union("t", [s.object({ t: s.literal(1) })]).node, x)).toBe(x);
    }
    const nested = seal(s.secret(s.object({ k: s.secret(s.string()) })).node, { k: "deep" });
    expect(revealed(Reflect.get(Object(revealed(nested)), "k"))).toBe("deep");
  });
});

describe("s.secret", () => {
  const Pw = s.secret(s.string({ min: 1 }));
  it("parse wraps, validates the inner value and keeps identity for secret-free schemas", () => {
    const r = Pw.parse("pw");
    expect(r.ok && reveal(r.value)).toBe("pw");
    expect(Pw.parse("").ok).toBe(false);
    const bad = Pw.parse(secretAccess.of("", str));
    expect(!bad.ok && bad.error.data.issues).toEqual([{ path: [], rule: "required" }]);
    const wrong = Pw.parse(5);
    expect(!wrong.ok && wrong.error.data.issues).toEqual([{ path: [], rule: "type" }]);
    const plain = { a: "x" };
    const P = s.object({ a: s.string() }).parse(plain);
    expect(P.ok && P.value).toBe(plain);
  });
  it("marker fails with secret-missing; nullable and optional wrappers derive", () => {
    const m = Pw.parse("[secret]");
    expect(!m.ok && m.error.message).toBe("secret-missing at root");
    expect(Pw.nullable().parse(null)).toEqual({ ok: true, value: null });
    const O = s.object({ k: Pw.optional() });
    expect(O.parse({})).toEqual({ ok: true, value: {} });
    expect(O.doc()).toBe("k?: secret<string(1..)>");
  });
  it("encode gives the marker for raw and sealed values; toJson never reads the value", () => {
    expect(Pw.encode("raw")).toBe("[secret]");
    expect(Pw.encode(secretAccess.of("sealed", str))).toBe("[secret]");
    expect(toJson(secretNode, secretAccess.of("x", str))).toBe("[secret]");
    expect(() => Pw.encode(secretAccess.of("", str))).toThrow();
  });
  it("decodeStrings reads the inner type, including inside records of secrets", () => {
    const F = s.object({
      pin: s.secret(s.int()),
      tags: s.record(s.secret(s.string())),
      skip: s.secret(s.int()).optional(),
    });
    const r = F.decodeStrings({ pin: "42", "tags.a": "x", "tags.b.c": "y" });
    expect(r.ok && reveal(r.value.pin)).toBe(42);
    expect(r.ok && r.value.tags.a !== undefined && reveal(r.value.tags.a)).toBe("x");
    expect(r.ok && "skip" in r.value).toBe(false);
    expect(r.ok && Object.keys(r.value.tags)).toEqual(["a", "b.c"]);
    const m = F.decodeStrings({ pin: "[secret]", "tags.a": "x" });
    expect(!m.ok && m.error.data.issues).toEqual([{ path: ["pin"], rule: "secret-missing" }]);
  });
  it("gen yields secrets whose inner values fit", () => {
    const S = s.secret(s.int({ min: 0, max: 9 }));
    fc.assert(
      fc.property(gen(S), (v) => {
        expect(secretAccess.is(v)).toBe(true);
        const n = reveal(v);
        expect(n >= 0 && n <= 9).toBe(true);
        expect(S.parse(v)).toEqual({ ok: true, value: v });
      }),
    );
  });
});

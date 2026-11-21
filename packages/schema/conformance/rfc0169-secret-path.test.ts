// Spec: k.parity, clause "`secretPath(s.secret(s.string()))` is `\"\"`; over `{ a: int, b: { c: secret(int) } }` it is `b.c`; over `{ x: secret, y: secret }` `x`; over `array(record({ k: secret(int).nullable() }))` `k`; over `union([int, { m: secret(int).optional() }])` `m`; over `{ a: json, b: array(enum) }` null."
// Seed: 1337.
import { type Schema, s, secretPath } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

describe("rfc:0169 conformance: secretPath", () => {
  test("rfc:0169 conformance: `secretPath(s.secret(s.string()))` is the empty string", () => {
    expect(secretPath(s.secret(s.string()))).toBe("");
  });

  test("rfc:0169 conformance: over `{ a: int, b: { c: secret(int) } }` it is `b.c`", () => {
    const schema = s.object({ a: s.int(), b: s.object({ c: s.secret(s.int()) }) });
    expect(secretPath(schema)).toBe("b.c");
  });

  test("rfc:0169 conformance: over `{ x: secret, y: secret }` it is `x`", () => {
    const schema = s.object({ x: s.secret(s.string()), y: s.secret(s.string()) });
    expect(secretPath(schema)).toBe("x");
  });

  test("rfc:0169 conformance: over `array(record({ k: secret(int).nullable() }))` it is `k`", () => {
    const schema = s.array(s.record(s.object({ k: s.secret(s.int()).nullable() })));
    expect(secretPath(schema)).toBe("k");
  });

  test("rfc:0169 conformance: over `union([int, { m: secret(int).optional() }])` it is `m`", () => {
    const schema = s.union([s.int(), s.object({ m: s.secret(s.int()).optional() })]);
    expect(secretPath(schema)).toBe("m");
  });

  test("rfc:0169 conformance: over `{ a: json, b: array(enum) }` it is null", () => {
    const schema = s.object({ a: s.json(), b: s.array(s.enum(["p", "q"])) });
    expect(secretPath(schema)).toBeNull();
  });

  test("rfc:0169 conformance: for any generated schema with exactly one secret the result names it (property)", () => {
    type Step = { readonly k: "key"; readonly name: string } | { readonly k: "array" | "record" | "union" };
    const step: fc.Arbitrary<Step> = fc.oneof(
      fc.constantFrom("a", "b", "c", "d", "e").map((name): Step => ({ k: "key", name })),
      fc.constantFrom<Step>({ k: "array" }, { k: "record" }, { k: "union" }),
    );
    const wrap = fc.constantFrom("none", "optional", "nullable");
    fc.assert(
      fc.property(fc.array(step, { maxLength: 6 }), wrap, (steps, w) => {
        const leaf = s.secret(s.int());
        let node: Schema<unknown> = w === "optional" ? leaf.optional() : w === "nullable" ? leaf.nullable() : leaf;
        const keys: string[] = [];
        for (const st of [...steps].reverse()) {
          if (st.k === "key") {
            // `z` is a plain sibling, listed first in source order, and holds no secret.
            node = s.object({ z: s.int(), [st.name]: node });
            keys.unshift(st.name);
          } else if (st.k === "array") node = s.array(node);
          else if (st.k === "record") node = s.record(node);
          else node = s.union([s.string(), node]);
        }
        expect(secretPath(node)).toBe(keys.join("."));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

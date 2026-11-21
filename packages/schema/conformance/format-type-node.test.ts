// Spec: k.formats, clause "The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name." (rfc:0079)
// Seed 1337. ASSUMPTION (the spec names no accessor): a schema value serializes through JSON.stringify to its node.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

describe("k.schema format types: node", () => {
  test("a serialized format node keeps `kind` and `name` and its `base`, and carries neither `check` nor `gen`", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9.-]{0,11}$/), (name) => {
        const F = s.format(name, s.string(), { check: () => true, gen: { from: s.string(), map: (x) => x } });
        const node: unknown = JSON.parse(JSON.stringify(F));
        expect(node).toMatchObject({ kind: "format", name, base: { kind: "string" } });
        const text = JSON.stringify(F);
        expect(text).not.toContain("check");
        expect(text).not.toContain("gen");
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});

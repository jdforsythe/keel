// `hasSecret` reads a node's JSON text for a `secret` kind; it must agree with the tree walk of `secretPathOf` on every
// schema, field names, literals and enum values that spell `"kind":"secret"` included. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type PiiClass, type Schema, s } from "../src/index.ts";
import { hasSecret } from "../src/internal/hasSecret.ts";
import { secretPathOf } from "../src/internal/secretPathOf.ts";

const TRICKY = ['"kind":"secret"', "kind", "secret", '{"kind":"secret"}', '\\"kind\\":\\"secret\\"'];
const text = fc.oneof(fc.constantFrom(...TRICKY), fc.string({ maxLength: 6 }));

const { schema } = fc.letrec<{ schema: Schema<unknown> }>((tie) => ({
  schema: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.constant(s.string()),
    text.map((v) => s.literal(v)),
    fc.array(text, { minLength: 1, maxLength: 3 }).map(([a = "a", ...rest]) => s.enum([a, ...rest])),
    text.map((brand) => s.id(brand)),
    tie("schema").map((inner) => s.secret(inner)),
    tie("schema").map((inner) => s.array(inner)),
    tie("schema").map((inner) => s.object({ r: s.record(inner).optional() })),
    tie("schema").map((inner) => s.object({ x: inner }).nullable()),
    fc
      .array(fc.tuple(text, tie("schema")), { minLength: 1, maxLength: 3 })
      .map((pairs) => s.object(Object.fromEntries(pairs))),
    fc.tuple(tie("schema"), tie("schema")).map(([a, b]) => s.union([a, b])),
    fc.tuple(tie("schema"), fc.constantFrom<PiiClass>("name", "special")).map(([inner, cls]) => inner.pii(cls)),
  ),
}));

describe("hasSecret", () => {
  it("is true exactly when `secretPathOf` finds a `secret` node", () => {
    fc.assert(
      fc.property(schema, (sch) => {
        expect(hasSecret(sch.node)).toBe(secretPathOf(sch.node) !== null);
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  it("text spelling a secret kind is not one", () => {
    for (const t of TRICKY) {
      expect(hasSecret(s.object({ [t]: s.literal(t) }).node)).toBe(false);
      expect(hasSecret(s.enum([t]).node)).toBe(false);
      expect(hasSecret(s.object({ kind: s.literal("secret") }).node)).toBe(false);
    }
  });
});

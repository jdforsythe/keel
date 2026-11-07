import { type Mode, createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
// k.ctx: random.id(brand) under sim is deterministic by seed and parses with s.id(brand)
import { describe, expect, expectTypeOf, test } from "vitest";

const SEED = 1337;

describe("k.ctx random.id (sim)", () => {
  test("same seed yields the same ids", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.string({ minLength: 1, maxLength: 8 }), (n, brand) => {
        const a = createCtx({ mode: "sim", seed: SEED }).random;
        const b = createCtx({ mode: "sim", seed: SEED }).random;
        for (let i = 0; i < n; i++) expect(a.id(brand)).toBe(b.id(brand));
      }),
      { seed: SEED },
    );
  });

  test("ids parse with s.id(brand) and are distinct", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 8 }), (brand) => {
        const r = createCtx({ mode: "sim", seed: SEED }).random;
        const schema = s.id(brand);
        const seen = new Set<string>();
        for (let i = 0; i < 10; i++) {
          const id = r.id(brand);
          expect(schema.parse(id).ok).toBe(true);
          seen.add(id);
        }
        expect(seen.size).toBe(10);
      }),
      { seed: SEED },
    );
  });

  test("random has no uuid: id(brand) is the one way to mint (rfc:0043)", () => {
    const modes: readonly Mode[] = ["real", "shell", "sim"];
    for (const mode of modes) expect("uuid" in createCtx({ mode }).random).toBe(false);
    expectTypeOf(createCtx({ mode: "sim" }).random).not.toHaveProperty("uuid");
  });
});

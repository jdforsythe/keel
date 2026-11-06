// Type-level inference checks (checked by tsc; vitest runs them as no-ops).
import { describe, expectTypeOf, it } from "vitest";
import { type Infer, s } from "../src/index.ts";

describe("s.infer", () => {
  it("infers primitives, literals, enums", () => {
    expectTypeOf<s.infer<ReturnType<typeof s.int>>>().toEqualTypeOf<number>();
    expectTypeOf<s.infer<ReturnType<typeof s.literal<"on">>>>().toEqualTypeOf<"on">();
    const E = s.enum(["a", "b"]);
    expectTypeOf<s.infer<typeof E>>().toEqualTypeOf<"a" | "b">();
  });
  it("infers containers and discriminated unions", () => {
    const U = s.union("k", [s.object({ k: s.literal("a"), n: s.int() }), s.object({ k: s.literal("b") })]);
    expectTypeOf<s.infer<typeof U>>().toEqualTypeOf<{ k: "a"; n: number } | { k: "b" }>();
    const R = s.record(s.array(s.boolean().nullable()));
    expectTypeOf<s.infer<typeof R>>().toEqualTypeOf<Record<string, (boolean | null)[]>>();
  });
  it("optional+nullable infers an optional key that may be null", () => {
    const O = s.object({ a: s.string().optional().nullable(), b: s.int() });
    expectTypeOf<Infer<typeof O>>().toEqualTypeOf<{ a?: string | null; b: number }>();
  });
});

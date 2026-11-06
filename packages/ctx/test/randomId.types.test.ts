import type { Id, Infer } from "@keel/schema";
import type { s } from "@keel/schema";
import { describe, expect, expectTypeOf, test } from "vitest";
import { createCtx } from "../src/index.ts";

describe("random.id", () => {
  test("returns Id<B> matching Infer of s.id(B), both ways", () => {
    const id = createCtx({ mode: "sim", seed: 1 }).random.id("Todo");
    expectTypeOf(id).toEqualTypeOf<Id<"Todo">>();
    expectTypeOf(id).toEqualTypeOf<Infer<ReturnType<typeof s.id<"Todo">>>>();
    expect(typeof id).toBe("string");
  });
});

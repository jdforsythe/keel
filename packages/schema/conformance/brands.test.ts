// Clause: branded IDs are not assignable across brands (type-level, no ts-expect-error).
import { describe, expect, expectTypeOf, it } from "vitest";
import { s } from "@keel/schema";
import { PostId, UserId } from "./fixtures";

type UserIdT = s.infer<typeof UserId>;
type PostIdT = s.infer<typeof PostId>;

describe("k.schema branded ids", () => {
  it("User id is not assignable to Post id", () => {
    expectTypeOf<UserIdT>().not.toMatchTypeOf<PostIdT>();
  });
  it("Post id is not assignable to User id", () => {
    expectTypeOf<PostIdT>().not.toMatchTypeOf<UserIdT>();
  });
  it("same brand has identical type", () => {
    expectTypeOf<s.infer<ReturnType<typeof s.id<"User">>>>().toEqualTypeOf<UserIdT>();
  });
  it("plain string is not assignable to a branded id", () => {
    expectTypeOf<string>().not.toMatchTypeOf<UserIdT>();
  });
  it("branded id is assignable to string", () => {
    expectTypeOf<UserIdT>().toMatchTypeOf<string>();
  });
  it("brand survives inside object inference", () => {
    const O = s.object({ owner: UserId });
    expectTypeOf<s.infer<typeof O>["owner"]>().toEqualTypeOf<UserIdT>();
    expectTypeOf<s.infer<typeof O>["owner"]>().not.toMatchTypeOf<PostIdT>();
  });
  it("runtime: ids of different brands both parse the same string", () => {
    const a = UserId.parse("x1");
    const b = PostId.parse("x1");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });
});

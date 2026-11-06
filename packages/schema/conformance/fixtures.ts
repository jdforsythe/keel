// Shared fixtures for k.schema conformance. Public API only.
import { s } from "@keel/schema";

export const SEED = 1337;
export const RUNS = 100;

export const Str = s.string({ min: 1, max: 8 });
export const Num = s.number();
export const Int = s.int();
export const Bool = s.boolean();
export const Lit = s.literal("on");
export const Enum = s.enum(["admin", "member"]);
export const UserId = s.id("User");
export const PostId = s.id("Post");
export const Obj = s.object({
  id: UserId,
  name: Str,
  role: Enum,
  email: s.string().optional(),
  nick: s.string().nullable(),
  bio: s.string().optional().nullable(),
});
export const Arr = s.array(Int);
export const Circle = s.object({ kind: s.literal("circle"), r: Num });
export const Square = s.object({ kind: s.literal("square"), side: Int });
export const Union = s.union("kind", [Circle, Square]);
export const Rec = s.record(Int);
export const Nested = s.object({ items: s.array(Obj), shapes: s.array(Union), tags: Rec });

export const allTypes = {
  string: Str,
  number: Num,
  int: Int,
  boolean: Bool,
  literal: Lit,
  enum: Enum,
  id: UserId,
  object: Obj,
  array: Arr,
  union: Union,
  record: Rec,
  nested: Nested,
};

// Normalise through JSON so -0/0 and absent/undefined do not cause false diffs.
export const norm = (x: unknown): unknown => JSON.parse(JSON.stringify(x));

import type { Id } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** Brand a raw uuid string as `Id<B>`. The brand is type-only (s.id adds no runtime tag). */
export function asId<B extends string>(raw: string): Id<B> {
  return unsafe(
    "Id<B> is string & a phantom brand; s.id(brand) accepts any non-empty string, so a fresh uuid is a valid Id<B>",
    () => raw as Id<B>,
  );
}

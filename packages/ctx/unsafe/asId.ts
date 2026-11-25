import type { Id } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** Brand a raw uuid string as `Id<B>`. The brand is type-only (s.id adds no runtime tag). */
export function asId<B extends string>(raw: string): Id<B> {
  return unsafe(
    "Id<B> is a string with a type-only brand and s.id(brand) parses any non-empty string; realRandom and simRandom pass a fresh uuid, never empty",
    () => raw as Id<B>,
  );
}

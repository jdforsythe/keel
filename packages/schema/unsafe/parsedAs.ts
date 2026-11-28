import type { Schema } from "../src/Schema.ts";
import { unsafe } from "./unsafe.ts";

/**
 * `schema`'s parse as a type guard for the type `S` infers to (k.identity What stays unsafe): the parse proves it, but
 * the relation between a type parameter `S` and what `S` infers to is opaque to the checker.
 */
export function parsedAs<S extends Schema<unknown, boolean>>(
  schema: S,
): (x: unknown) => x is S extends Schema<infer T, boolean> ? T : never {
  return unsafe(
    "a value S's own parse accepts is the type S infers to; the checker cannot relate a type parameter S to it",
    () =>
      (x: unknown): x is S extends Schema<infer T, boolean> ? T : never =>
        schema.parse(x).ok,
  );
}

import type { JsonValue } from "@keel/schema";

/**
 * `sections[id]` of the inspect document (k.inspect Inspector hooks): the section schema's `doc()` with the encoded
 * value, or with an `error` (E1057) when `read` threw or its value failed the schema.
 */
export type InspectSection =
  | { readonly doc: string; readonly value: JsonValue }
  | { readonly doc: string; readonly error: string };

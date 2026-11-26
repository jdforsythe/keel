import { type ObjectSchema, isSchema } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** `v` as an object schema when it is a schema `s` built with a `decodeStrings` function, else `undefined`. */
export function objectSchemaOf(v: unknown): ObjectSchema<unknown> | undefined {
  if (!isSchema(v) || !("decodeStrings" in v) || typeof v.decodeStrings !== "function") return undefined;
  return unsafe(
    "a schema s built that carries decodeStrings came from objectOf in @keel/schema s.ts, the one maker adding decodeStrings and pii, so it is an ObjectSchema",
    () => v as ObjectSchema<unknown>,
  );
}

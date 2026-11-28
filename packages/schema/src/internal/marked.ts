import { records } from "./records.ts";

/** `schema`, recorded as one `s` built (k.identity, `isSchema`) and frozen. */
export function marked<S extends object>(schema: S): Readonly<S> {
  records.schema.add(schema);
  return Object.freeze(schema);
}

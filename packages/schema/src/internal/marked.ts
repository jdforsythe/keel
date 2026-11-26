import { SCHEMA_KEY } from "./SCHEMA_KEY.ts";

/** `schema`, marked as one `s` built (`isSchema`) and frozen. */
export function marked<S extends object>(schema: S): Readonly<S> {
  Object.defineProperty(schema, SCHEMA_KEY, { value: true });
  return Object.freeze(schema);
}

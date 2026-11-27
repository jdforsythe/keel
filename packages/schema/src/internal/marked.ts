import { kernelSet } from "./kernelSet.ts";

/** `schema`, recorded as one `s` built (k.identity, `isSchema`) and frozen. */
export function marked<S extends object>(schema: S): Readonly<S> {
  kernelSet("schema").add(schema);
  return Object.freeze(schema);
}

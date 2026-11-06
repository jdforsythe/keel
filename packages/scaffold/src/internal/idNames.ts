import type { RenameSpec } from "./RenameSpec.ts";

/** Names that may lead an element id: the declared names plus a route's leaf. */
export function idNames(spec: RenameSpec): ReadonlyMap<string, string> {
  if (spec.leaf === null) return spec.names;
  return new Map([...spec.names, spec.leaf]);
}

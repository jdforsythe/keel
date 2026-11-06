import { isLowerCamel } from "./isLowerCamel.ts";

/** Split a store id `<module>.<name>` into its parts, or null when it is not two lowerCamel segments. */
export function storeId(id: string): { mod: string; name: string } | null {
  const segs = id.split(".");
  const [mod, name] = segs;
  if (segs.length !== 2 || mod === undefined || name === undefined) return null;
  return isLowerCamel(mod) && isLowerCamel(name) ? { mod, name } : null;
}

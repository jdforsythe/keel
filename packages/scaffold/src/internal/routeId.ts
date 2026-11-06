import { camelJoin } from "./camelJoin.ts";
import { isLowerCamel } from "./isLowerCamel.ts";

/** Split a route id `<module>.<seg>(.<seg>)*` into module and leaf name (segments joined lowerCamel), or null. */
export function routeId(id: string): { mod: string; leaf: string } | null {
  const segs = id.split(".");
  const [mod, ...rest] = segs;
  if (mod === undefined || rest.length === 0 || !segs.every(isLowerCamel)) return null;
  return { mod, leaf: camelJoin(rest) };
}

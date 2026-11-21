import type { Located } from "./Located.ts";
import { patternKey } from "./patternKey.ts";

/** The routes of `list` at `route`'s path pattern: the page itself, or its contract's API entries there (k.api Paths). */
export function atPattern(list: readonly Located[], route: Located): readonly Located[] {
  if (route.def.kind !== "api") return [route];
  const key = patternKey(route.segments);
  return list.filter(
    (r) => r.def.kind === "api" && r.def.module === route.def.module && patternKey(r.segments) === key,
  );
}

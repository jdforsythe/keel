import type { EntryShape } from "./EntryShape.ts";
import { patternKey } from "./patternKey.ts";

/**
 * Why `shapes` break k.api Paths (E1502), or null: two entries at one path pattern, unless both are API entries of
 * one module at distinct methods (`across`: any two entries of different modules clash, methods aside).
 */
export function patternClash(shapes: Iterable<EntryShape>): string | null {
  const at = new Map<string, EntryShape[]>();
  for (const s of shapes) {
    if (s.segments === null) continue;
    const key = patternKey(s.segments);
    const here = at.get(key) ?? [];
    for (const o of here) {
      const apart = s.kind === "api" && o.kind === "api" && s.module === o.module && s.method !== o.method;
      if (!apart) return `${s.id}: path pattern "${key}" is also ${o.id}'s`;
    }
    here.push(s);
    at.set(key, here);
  }
  return null;
}

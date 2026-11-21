import { hasProtoKey } from "./hasProtoKey.ts";

/**
 * True when `x` is exactly JSON-representable: finite numbers, plain objects and arrays, no cycles or prototype keys.
 * Each container's children are read later from a list rather than by recursion, so a deep value cannot overflow the
 * stack; a container stays in `above` until its children are read.
 */
export function isJson(x: unknown): boolean {
  const above = new Set<object>();
  const todo: (() => boolean)[] = [];
  const one = (v: unknown): boolean => {
    if (typeof v === "number") return Number.isFinite(v);
    if (v === null || typeof v === "string" || typeof v === "boolean") return true;
    if (typeof v !== "object" || above.has(v)) return false;
    const list = Array.isArray(v);
    const proto: unknown = Object.getPrototypeOf(v);
    if (!list && ((proto !== Object.prototype && proto !== null) || hasProtoKey(v))) return false;
    above.add(v);
    todo.push(() => above.delete(v));
    // A hole reads as undefined, which is not JSON.
    for (const c of list ? Array.from(v) : Object.values(v)) todo.push(() => one(c));
    return true;
  };
  if (!one(x)) return false;
  for (let f = todo.pop(); f !== undefined; f = todo.pop()) if (!f()) return false;
  return true;
}

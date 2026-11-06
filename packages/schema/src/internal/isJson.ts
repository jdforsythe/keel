import { hasProtoKey } from "./hasProtoKey.ts";

/** True when `x` is exactly JSON-representable: finite numbers, plain objects and arrays, no cycles or prototype keys. */
export function isJson(x: unknown, ancestors: Set<object>): boolean {
  if (x === null || typeof x === "string" || typeof x === "boolean") return true;
  if (typeof x === "number") return Number.isFinite(x);
  if (typeof x !== "object" || ancestors.has(x)) return false;
  const proto: unknown = Object.getPrototypeOf(x);
  const list = Array.isArray(x);
  if (!list && proto !== Object.prototype && proto !== null) return false;
  if (!list && hasProtoKey(x)) return false;
  ancestors.add(x);
  const ok = list
    ? Array.from({ length: x.length }, (_, i) => i).every((i) => i in x && isJson(x[i], ancestors))
    : Object.values(x).every((v) => isJson(v, ancestors));
  ancestors.delete(x);
  return ok;
}

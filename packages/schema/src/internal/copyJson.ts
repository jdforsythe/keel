import type { JsonValue } from "../JsonValue.ts";
import { isRecord } from "./isRecord.ts";

/**
 * Rebuild an already-validated JSON value as fresh plain data. Each container is made first and filled later from a
 * list rather than by recursion, so a deep value cannot overflow the stack.
 */
export function copyJson(value: unknown): JsonValue {
  const fills: (() => void)[] = [];
  const one = (x: unknown): JsonValue => {
    if (x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean") return x;
    if (Array.isArray(x)) {
      const list: readonly unknown[] = x;
      const out: JsonValue[] = [];
      fills.push(() => {
        for (const c of list) out.push(one(c));
      });
      return out;
    }
    if (!isRecord(x)) throw new Error("value is not JSON");
    const out: Record<string, JsonValue> = {};
    fills.push(() => {
      for (const k of Object.keys(x)) out[k] = one(x[k]);
    });
    return out;
  };
  const root = one(value);
  for (let fill = fills.pop(); fill !== undefined; fill = fills.pop()) fill();
  return root;
}

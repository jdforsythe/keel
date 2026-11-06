import type { JsonValue } from "../JsonValue.ts";
import { isRecord } from "./isRecord.ts";

/** Rebuild an already-validated JSON value as fresh plain data. */
export function copyJson(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value)) {
    const list: readonly unknown[] = value;
    return list.map(copyJson);
  }
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).map((k) => [k, copyJson(value[k])]));
  throw new Error("value is not JSON");
}

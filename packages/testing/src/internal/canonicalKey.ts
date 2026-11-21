import type { JsonValue } from "@keel/schema";

/** JSON text of `value` with every object's keys sorted: two states are one state when their keys are equal. */
export function canonicalKey(value: JsonValue): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(",")}]`;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalKey(v)}`).join(",")}}`;
}

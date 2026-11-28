import type { JsonValue } from "@keel/schema";

const quote = (s: string): string => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/** An array parameter as a Postgres array literal; an object element is its JSON text. */
function literal(items: readonly JsonValue[]): string {
  const each = (v: JsonValue): string => {
    if (v === null) return "NULL";
    if (Array.isArray(v)) return literal(v);
    const t = toText(v);
    return t === null ? "NULL" : quote(t);
  };
  return `{${items.map(each).join(",")}}`;
}

/**
 * A parameter as the text both engines send (std.postgres API): a string itself, a number or boolean its text, `null`
 * SQL `NULL`, an array a Postgres array literal, a plain object its JSON text.
 */
export function toText(v: JsonValue): string | null {
  if (v === null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return literal(v);
  return JSON.stringify(v);
}

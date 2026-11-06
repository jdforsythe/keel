import type { JsonValue } from "@keel/schema";

/**
 * Flatten encoded JSON into string entries the way `decodeStrings` reads them back: nested objects as dotted
 * keys, arrays as repeated keys, `null` as an empty string.
 */
export function flattenJson(key: string, v: JsonValue, out: [string, string][]): void {
  if (v === null) out.push([key, ""]);
  else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out.push([key, String(v)]);
  else if (Array.isArray(v)) for (const item of v) flattenJson(key, item, out);
  else for (const [k, x] of Object.entries(v)) flattenJson(key === "" ? k : `${key}.${k}`, x, out);
}

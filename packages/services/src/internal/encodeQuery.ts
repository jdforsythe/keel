import type { JsonValue } from "@keel/schema";

/**
 * Flatten a schema-encoded query value into URLSearchParams, the inverse of `decodeStrings` (k.schema):
 * nested objects as dotted keys, arrays as repeated keys, null as absent.
 */
export function encodeQuery(value: JsonValue): URLSearchParams {
  const out = new URLSearchParams();
  const join = (key: string, name: string | number): string => (key === "" ? String(name) : `${key}.${name}`);
  const walk = (key: string, v: JsonValue): void => {
    if (v === null) return;
    if (typeof v !== "object") {
      out.append(key, String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x: JsonValue, i) => walk(typeof x === "object" && x !== null ? join(key, i) : key, x));
      return;
    }
    for (const [name, x] of Object.entries(v)) walk(join(key, name), x);
  };
  walk("", value);
  return out;
}

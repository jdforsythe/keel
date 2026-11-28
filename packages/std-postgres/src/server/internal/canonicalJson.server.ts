/** `value` as JSON text with every object's keys sorted, so equal params give one key whatever their key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== "object" || value === null) return value;
  const keys = Object.keys(value).sort();
  return Object.fromEntries(keys.map((k) => [k, sorted(Reflect.get(value, k))]));
}

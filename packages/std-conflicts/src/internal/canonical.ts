const keyed = (v: unknown): v is { readonly id: string } =>
  typeof v === "object" && v !== null && !Array.isArray(v) && typeof Reflect.get(v, "id") === "string";

const byText = (
  a: { readonly id: string; readonly text: string },
  b: { readonly id: string; readonly text: string },
) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.text < b.text ? -1 : a.text > b.text ? 1 : 0);

const order = (v: unknown): unknown => {
  if (Array.isArray(v)) {
    if (v.length > 0 && v.every(keyed))
      return v
        .map((item) => ({ id: item.id, text: JSON.stringify(order(item)) }))
        .sort(byText)
        .map((t): unknown => JSON.parse(t.text));
    return v.map(order);
  }
  if (typeof v === "object" && v !== null) {
    const out: { [key: string]: unknown } = {};
    for (const k of Object.keys(v).sort()) out[k] = order(Reflect.get(v, k));
    return out;
  }
  return v;
};

/**
 * The comparison text of a JSON state: object keys sorted, and an array whose items are all objects with a string
 * `id` sorted by `id`, so it compares as a set keyed by `id`.
 */
export function canonical(v: unknown): string {
  return JSON.stringify(order(v));
}

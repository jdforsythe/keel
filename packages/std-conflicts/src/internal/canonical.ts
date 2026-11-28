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
        .map((item) => {
          const ordered = order(item);
          return { id: item.id, text: JSON.stringify(ordered), ordered };
        })
        .sort(byText)
        .map((t) => t.ordered);
    return v.map(order);
  }
  // `fromEntries` defines own properties, so a key such as `__proto__` is kept, not assigned through the prototype.
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, order(Reflect.get(v, k))]),
    );
  return v;
};

/**
 * The comparison text of a JSON state: object keys sorted, and an array whose items are all objects with a string
 * `id` sorted by `id`, so it compares as a set keyed by `id`.
 */
export function canonical(v: unknown): string {
  return JSON.stringify(order(v));
}

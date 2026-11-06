/** JSON with object keys sorted at every depth (the `.keel/` artifact encoding of `@keel/compiler`). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, Reflect.get(v, k)]),
    );
  });
}

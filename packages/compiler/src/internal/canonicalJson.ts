/** JSON with object keys sorted at every depth; arrays keep their order. Keys like `__proto__` are kept. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
    const out: Record<string, unknown> = Object.create(null);
    for (const k of Object.keys(v).sort()) out[k] = Reflect.get(v, k);
    return out;
  });
}

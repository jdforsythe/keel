const MARKER = "[secret]";

/**
 * `encoded` (a schema's `encode` output) with each `"[secret]"` marker that stands for a `Secret` in `value` put back.
 * The encoding prunes undeclared keys and copies every container, while a `Secret` is frozen and opaque,
 * so sharing it is safe. A string field whose value is the marker text stays a string.
 */
export function graft(encoded: unknown, value: unknown): unknown {
  if (encoded === MARKER) return typeof value === "object" && value !== null ? value : encoded;
  if (typeof encoded !== "object" || encoded === null || typeof value !== "object" || value === null) return encoded;
  if (Array.isArray(encoded)) return encoded.map((e: unknown, i) => graft(e, Reflect.get(value, i)));
  const out: Record<string, unknown> = {};
  for (const [k, e] of Object.entries(encoded)) out[k] = graft(e, Reflect.get(value, k));
  return out;
}

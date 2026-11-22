import type { Baseline } from "./Baseline.ts";

const isBag = (v: unknown): v is { readonly [k: string]: unknown } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The entries of a `keel-review.json` text (k.review Baseline), none for an absent file, or null when it does not
 * parse as `{ v: 1, accepted: [{ id, code, path, reason }] }` or holds an `id` twice (E1070).
 */
export function baselineOf(text: string | undefined): readonly Baseline[] | null {
  if (text === undefined) return [];
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isBag(v) || v.v !== 1 || !Array.isArray(v.accepted)) return null;
  const out: Baseline[] = [];
  const ids = new Set<string>();
  for (const e of v.accepted) {
    if (!isBag(e)) return null;
    const { id, code, path, reason } = e;
    if (typeof id !== "string" || typeof code !== "string" || typeof path !== "string" || typeof reason !== "string")
      return null;
    if (ids.has(id)) return null;
    ids.add(id);
    out.push({ id, code, path, reason });
  }
  return out;
}

import { canonicalJson } from "./canonicalJson.ts";

/** The `.keel/` artifact content hash: `fnv1a:` + FNV-1a (UTF-16 units) of the canonical JSON (k.compiler; keep in step). */
export function hashOf(value: unknown): string {
  let h = 0x811c9dc5;
  const text = canonicalJson(value);
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `fnv1a:${h.toString(16).padStart(8, "0")}`;
}

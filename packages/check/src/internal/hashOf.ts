import { canonicalJson } from "./canonicalJson.ts";

/** FNV-1a 32-bit over UTF-16 code units, 8 lowercase hex digits. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The compiler's artifact content hash: `fnv1a:` + FNV-1a of the canonical JSON (k.compiler; keep in step). */
export function hashOf(value: unknown): string {
  return `fnv1a:${fnv1a(canonicalJson(value))}`;
}

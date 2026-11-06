import { canonicalJson } from "./canonicalJson.ts";
import { fnv1a } from "./fnv1a.ts";

/** Content hash of an artifact: `fnv1a:` + FNV-1a of its canonical (sorted-key) JSON. */
export function hashOf(value: unknown): string {
  return `fnv1a:${fnv1a(canonicalJson(value))}`;
}

import { fnv1a } from "./fnv1a.ts";

const PLAIN = /^[A-Za-z0-9]+$/;

/**
 * A CSS identifier for `parts`. Readable (`a-b-c`) when `readable` holds and every part is alphanumeric;
 * otherwise each part has non-alphanumerics replaced by `_` and a hash of `key` is appended after `_`.
 * Readable names never contain `_`, hashed names always do, so the two never collide.
 */
export function ident(parts: readonly string[], key: string, readable: boolean): string {
  if (readable && parts.every((p) => PLAIN.test(p))) return parts.join("-");
  return `${parts.map((p) => p.replace(/[^A-Za-z0-9]/g, "_")).join("-")}_${fnv1a(key)}`;
}

import { attempt } from "@keel/schema";
import { MAX_NEXT_LENGTH } from "./MAX_NEXT_LENGTH.ts";

const BASE = "http://k";
const control = (v: string): boolean => {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
};

/**
 * Whether a decoded `next` may be carried forward by a guard redirect (rfc:0051, amended for backlog 0145 and 0146):
 * at most `MAX_NEXT_LENGTH` long, no ASCII control character (URL parsers strip tab and newline, so `/<TAB>/host`
 * is another origin), resolving against a base to that same origin, and a path that starts with `/` but not `//`
 * or `/\`. Anything else is dropped, never carried.
 */
export function carriedNext(v: string): boolean {
  if (v.length > MAX_NEXT_LENGTH || control(v)) return false;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return false;
  const u = attempt(() => new URL(v, BASE));
  return u.ok && u.value.origin === BASE;
}

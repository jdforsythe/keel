import { MAX_NEXT_LENGTH } from "./MAX_NEXT_LENGTH.ts";
import { unsafeChar } from "./unsafeChar.ts";

/** Whether `s` is `%2F` or `%5C` (either case) at `i`. */
function encodedSlash(s: string, i: number): boolean {
  if (s.charCodeAt(i) !== 0x25) return false;
  const a = s.charCodeAt(i + 1);
  const b = s.charCodeAt(i + 2) | 0x20;
  return (a === 0x32 && b === 0x66) || (a === 0x35 && b === 0x63);
}

/** Whether a path segment is `.` or `..` once percent-decoded; a malformed escape counts as refused. */
function dotSegment(raw: string): boolean {
  if (raw.length > 6) return false;
  try {
    const d = decodeURIComponent(raw);
    return d === "." || d === "..";
  } catch {
    return true;
  }
}

/**
 * Whether `pageHref` refuses `text` before it matches (k.router Return targets): over `MAX_NEXT_LENGTH` characters,
 * not exactly one leading `/`, a backslash or control character anywhere, `%2F` or `%5C` in the path (before the first
 * `?` or `#`), or a path segment that is `.` or `..` once decoded. One linear scan; nothing is decoded twice.
 */
export function returnRefused(text: string): boolean {
  if (text.length > MAX_NEXT_LENGTH || text.charCodeAt(0) !== 0x2f || text.charCodeAt(1) === 0x2f) return true;
  if (unsafeChar(text)) return true;
  let start = 1;
  for (let i = 1; i <= text.length; i++) {
    const c = i === text.length ? 0x3f : text.charCodeAt(i);
    if (encodedSlash(text, i)) return true;
    if (c === 0x2f || c === 0x3f || c === 0x23) {
      if (dotSegment(text.slice(start, i))) return true;
      if (c !== 0x2f) return false;
      start = i + 1;
    }
  }
  return false;
}

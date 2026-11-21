import type { Href } from "../types/Href.ts";

/** Whether `path` holds a backslash (a URL parser reads it as `/`) or a control character: C0, DEL or C1. */
function unsafeChar(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x5c) return true;
  }
  return false;
}

/**
 * Brand check for a path `hrefIn` built: root-relative with exactly one leading `/` (never `//`, which is
 * protocol-relative), no backslash or control character, no hash. The only way a string becomes an `Href`.
 */
export function isHref(path: string): path is Href {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("#") && !unsafeChar(path);
}

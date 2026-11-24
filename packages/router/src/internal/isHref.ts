import type { Href } from "../types/Href.ts";
import { unsafeChar } from "./unsafeChar.ts";

/**
 * Brand check for a path `hrefIn` built: root-relative with exactly one leading `/` (never `//`, which is
 * protocol-relative), no backslash or control character, no hash. The only way a string becomes an `Href`.
 */
export function isHref(path: string): path is Href {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("#") && !unsafeChar(path);
}

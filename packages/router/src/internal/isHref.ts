import type { Href } from "../types/Href.ts";

/** Brand check for a path `hrefIn` built: root-relative, no hash. The only way a string becomes an `Href`. */
export function isHref(path: string): path is Href {
  return path.startsWith("/") && !path.includes("#");
}

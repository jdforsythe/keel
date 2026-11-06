import type { Href } from "../src/types/Href.ts";
import { unsafe } from "./unsafe.ts";

/** Brand a path built by `href()`. The only place a string becomes an `Href`. */
export function toHref(path: string): Href {
  return unsafe(
    "href() built this path from a registered route and schema-encoded params and search",
    () => path as Href,
  );
}

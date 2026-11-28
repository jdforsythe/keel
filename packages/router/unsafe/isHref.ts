import { unsafeChar } from "../src/internal/unsafeChar.ts";
import type { Href } from "../src/types/Href.ts";
import { unsafe } from "./unsafe.ts";

/**
 * Brand check for a path `hrefIn` built: root-relative with exactly one leading `/` (never `//`, which is
 * protocol-relative), no backslash or control character, no hash. The only way a string becomes an `Href`.
 */
export const isHref: (path: string) => path is Href = unsafe(
  "Href is a brand with no run-time form: a string passing these checks is a root-relative path, which is all the brand records",
  () =>
    (path: string): path is Href =>
      path.startsWith("/") && !path.startsWith("//") && !path.includes("#") && !unsafeChar(path),
);

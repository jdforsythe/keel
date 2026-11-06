import { HTML_TAGS } from "./HTML_TAGS.ts";

/** Characters that make a string a CSS selector rather than an element id. */
const SELECTOR_CHARS = /[#[\]>~*,\s]/;

/** True when `id` is shaped like a DOM selector: leading `.`, `#`/`[`/`>`/whitespace anywhere, or a bare tag name. */
export function isSelector(id: string): boolean {
  return id.startsWith(".") || SELECTOR_CHARS.test(id) || HTML_TAGS.has(id.toLowerCase());
}

import type { DocHead } from "./DocHead.ts";

/**
 * Set `document.title` and `document.documentElement.lang` to `head` where they differ (k.head Client), `fallback`
 * standing for a null title. Two property writes: no element or text node is rebuilt.
 */
export function writeHead(head: DocHead, fallback: string): void {
  if (typeof document === "undefined") return;
  const title = head.title ?? fallback;
  if (document.title !== title) document.title = title;
  const root = document.documentElement;
  if (root.lang !== head.lang) root.lang = head.lang;
}

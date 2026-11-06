import { contentText } from "./contentText.ts";

/**
 * Text an `aria-labelledby` target contributes (accname 2B): its `aria-label`, else an image's `alt`, else its
 * content, whatever its role; its own `aria-labelledby` is not followed, so a self-reference cannot recurse.
 */
export function refText(ref: Element): string {
  const aria = (ref.getAttribute("aria-label") ?? "").trim();
  if (aria !== "") return aria;
  if (ref.tagName.toLowerCase() === "img") return ref.getAttribute("alt") ?? "";
  return contentText(ref);
}

import { isHidden } from "./isHidden.ts";

/** Name from content: text of descendants, images contributing their `alt`, hidden subtrees skipped. */
export function contentText(node: Node): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) out += child.nodeValue ?? "";
    else if (child instanceof Element && !isHidden(child)) {
      const aria = child.getAttribute("aria-label");
      if (aria !== null && aria.trim() !== "") out += aria;
      else if (child.tagName.toLowerCase() === "img") out += child.getAttribute("alt") ?? "";
      else out += contentText(child);
    }
  }
  return out;
}

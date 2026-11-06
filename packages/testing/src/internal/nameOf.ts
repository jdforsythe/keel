import { LABELABLE } from "./LABELABLE.ts";
import { NAME_FROM_CONTENT } from "./NAME_FROM_CONTENT.ts";
import { contentText } from "./contentText.ts";
import { labelText } from "./labelText.ts";
import { refText } from "./refText.ts";

/**
 * Accessible name, first non-empty of: `aria-labelledby` targets (each via `refText`, so a self-reference uses the
 * element's own label or content), `aria-label`, `<label>`s (form controls), `alt` (images), button-like `value`,
 * content text (only for roles that allow name from content), `title`. Trimmed; `presentation`/`none`: "".
 */
export function nameOf(el: Element, role: string): string {
  if (role === "presentation" || role === "none") return "";
  const doc = el.ownerDocument;
  const ids = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter((x) => x !== "");
  const tag = el.tagName.toLowerCase();
  const control = LABELABLE.has(tag);
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  const candidates: (() => string)[] = [
    () =>
      ids
        .map((id) => doc.getElementById(id))
        .map((ref) => (ref === null ? "" : refText(ref).trim()))
        .filter((t) => t !== "")
        .join(" "),
    () => el.getAttribute("aria-label") ?? "",
    () => (control ? labelText(el) : ""),
    () =>
      tag === "img" || tag === "area" || (tag === "input" && type === "image") ? (el.getAttribute("alt") ?? "") : "",
    () =>
      tag === "input" && (type === "button" || type === "submit" || type === "reset")
        ? (el.getAttribute("value") ?? "")
        : "",
    () => (!control && NAME_FROM_CONTENT.has(role) ? contentText(el) : ""),
    () => el.getAttribute("title") ?? "",
  ];
  for (const c of candidates) {
    const name = c().trim();
    if (name !== "") return name;
  }
  return "";
}

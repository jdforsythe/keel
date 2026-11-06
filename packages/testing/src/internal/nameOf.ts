import { LABELABLE } from "./LABELABLE.ts";
import { contentText } from "./contentText.ts";
import { labelText } from "./labelText.ts";

/**
 * Accessible name, first non-empty of: `aria-labelledby` targets' text, `aria-label`, `<label>` (form controls),
 * `alt` (images), button-like `value`, content text (non-controls), `title`. Trimmed; `presentation`/`none`: "".
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
        .map((ref) => (ref === null ? "" : contentText(ref)))
        .join(" "),
    () => el.getAttribute("aria-label") ?? "",
    () => (control ? labelText(el) : ""),
    () =>
      tag === "img" || tag === "area" || (tag === "input" && type === "image") ? (el.getAttribute("alt") ?? "") : "",
    () =>
      tag === "input" && (type === "button" || type === "submit" || type === "reset")
        ? (el.getAttribute("value") ?? "")
        : "",
    () => (control ? "" : contentText(el)),
    () => el.getAttribute("title") ?? "",
  ];
  for (const c of candidates) {
    const name = c().trim();
    if (name !== "") return name;
  }
  return "";
}

import type { A11yEntry } from "@keel/compiler";
import { LABELABLE, NAME_FROM_CONTENT } from "@keel/compiler/a11y";
import { contentText } from "./contentText.ts";
import { labelText } from "./labelText.ts";
import { refText } from "./refText.ts";

/**
 * Accessible name and its source in `a11y.json` terms, first non-empty of: `aria-labelledby` targets (each via
 * `refText`, so a self-reference uses the element's own label or content) and `aria-label` (`aria`), `<label>`s of
 * form controls (`label`), `alt` of images (`alt`), content text for roles that allow name from content (`text`),
 * then button-like `value` and `title` (`none`: sources a11y.json does not model). Trimmed; empty is source `none`.
 */
export function nameAndSource(
  el: Element,
  role: string,
): { readonly name: string; readonly source: A11yEntry["name"] } {
  if (role === "presentation" || role === "none") return { name: "", source: "none" };
  const doc = el.ownerDocument;
  const ids = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter((x) => x !== "");
  const tag = el.tagName.toLowerCase();
  const control = LABELABLE.has(tag);
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  const candidates: (readonly [A11yEntry["name"], () => string])[] = [
    [
      "aria",
      () =>
        ids
          .map((id) => doc.getElementById(id))
          .map((ref) => (ref === null ? "" : refText(ref).trim()))
          .filter((t) => t !== "")
          .join(" "),
    ],
    ["aria", () => el.getAttribute("aria-label") ?? ""],
    ["label", () => (control ? labelText(el) : "")],
    [
      "alt",
      () =>
        tag === "img" || tag === "area" || (tag === "input" && type === "image") ? (el.getAttribute("alt") ?? "") : "",
    ],
    ["text", () => (!control && NAME_FROM_CONTENT.has(role) ? contentText(el) : "")],
    [
      "none",
      () =>
        tag === "input" && (type === "button" || type === "submit" || type === "reset")
          ? (el.getAttribute("value") ?? "")
          : "",
    ],
    ["none", () => el.getAttribute("title") ?? ""],
  ];
  for (const [source, c] of candidates) {
    const name = c().trim();
    if (name !== "") return { name, source };
  }
  return { name: "", source: "none" };
}

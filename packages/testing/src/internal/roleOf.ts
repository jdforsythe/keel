import { IMPLICIT_ROLES } from "./IMPLICIT_ROLES.ts";
import { INPUT_ROLES } from "./INPUT_ROLES.ts";

/** The element's role: the first token of an explicit `role`, else its implicit role, else `generic`. */
export function roleOf(el: Element): string {
  const explicit = (el.getAttribute("role") ?? "").trim().split(/\s+/)[0] ?? "";
  if (explicit !== "") return explicit;
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "a":
    case "area":
      return el.hasAttribute("href") ? "link" : "generic";
    case "img":
      return el.getAttribute("alt") === "" ? "presentation" : "img";
    case "input":
      return INPUT_ROLES.get((el.getAttribute("type") ?? "text").toLowerCase()) ?? "textbox";
    case "select":
      return el.hasAttribute("multiple") || Number(el.getAttribute("size") ?? "1") > 1 ? "listbox" : "combobox";
    case "section":
      return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "region" : "generic";
    default:
      return IMPLICIT_ROLES.get(tag) ?? "generic";
  }
}

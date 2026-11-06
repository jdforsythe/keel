import type { Violation } from "./Violation.ts";
import { isHidden } from "./isHidden.ts";
import { nameOf } from "./nameOf.ts";
import { roleOf } from "./roleOf.ts";

const UNLABELLED_OK: ReadonlySet<string> = new Set(["hidden", "button", "submit", "reset", "image"]);

const where = (el: Element): string => {
  const tag = el.tagName.toLowerCase();
  return el.id === "" ? `<${tag}>` : `<${tag} id="${el.id}">`;
};

const hiddenWithin = (el: Element, root: Element): boolean => {
  for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) if (isHidden(n)) return true;
  return false;
};

/**
 * Minimal axe-compatible structural rules over the rendered subtree (axe-core is not a dependency):
 * image-alt, button-name, link-name, label. Hidden subtrees are skipped.
 */
export function axe(root: Element): Violation[] {
  const out: Violation[] = [];
  for (const el of Array.from(root.getElementsByTagName("*"))) {
    if (hiddenWithin(el, root)) continue;
    const tag = el.tagName.toLowerCase();
    const role = roleOf(el);
    if (role === "presentation" || role === "none") continue;
    const named = (): boolean => nameOf(el, role) !== "";
    if (tag === "img" && !el.hasAttribute("alt") && !named())
      out.push({ rule: "image-alt", at: where(el), help: 'has no alt text; add alt, or alt="" if decorative' });
    else if (role === "button" && !named())
      out.push({ rule: "button-name", at: where(el), help: "has no accessible name; add text or aria-label" });
    else if (role === "link" && !named())
      out.push({ rule: "link-name", at: where(el), help: "has no accessible name; add text or aria-label" });
    else if (
      (tag === "select" ||
        tag === "textarea" ||
        (tag === "input" && !UNLABELLED_OK.has((el.getAttribute("type") ?? "text").toLowerCase()))) &&
      !named()
    )
      out.push({ rule: "label", at: where(el), help: "has no label; add <label for> or aria-label" });
  }
  return out;
}

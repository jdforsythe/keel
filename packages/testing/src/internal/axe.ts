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

const LANDMARKS: ReadonlySet<string> = new Set([
  "banner",
  "complementary",
  "contentinfo",
  "main",
  "navigation",
  "region",
  "search",
  "form",
]);
const NAMED_ONLY: ReadonlySet<string> = new Set(["region", "form"]);
const SECTIONING: ReadonlySet<string> = new Set(["article", "aside", "main", "nav", "section"]);

/** A landmark per axe: region and form count only with a name; header and footer only outside sectioning content. */
const isLandmark = (el: Element, role: string, name: string): boolean => {
  if (!LANDMARKS.has(role)) return false;
  if (NAMED_ONLY.has(role) && name === "") return false;
  const tag = el.tagName.toLowerCase();
  if ((tag === "header" || tag === "footer") && !el.hasAttribute("role"))
    for (let n = el.parentElement; n !== null; n = n.parentElement)
      if (SECTIONING.has(n.tagName.toLowerCase())) return false;
  return true;
};

/**
 * Minimal axe-compatible structural rules over the rendered subtree (axe-core is not a dependency):
 * image-alt, button-name, link-name, label, landmark-unique (landmarks of one role need distinct names). Hidden subtrees are skipped.
 */
export function axe(root: Element): Violation[] {
  const out: Violation[] = [];
  const landmarks: { el: Element; key: string }[] = [];
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
    else if (isLandmark(el, role, nameOf(el, role)))
      landmarks.push({ el, key: `${role}\n${nameOf(el, role).toLowerCase()}` });
  }
  const seen = new Map<string, number>();
  for (const { key } of landmarks) seen.set(key, (seen.get(key) ?? 0) + 1);
  for (const { el, key } of landmarks)
    if ((seen.get(key) ?? 0) > 1)
      out.push({
        rule: "landmark-unique",
        at: where(el),
        help: "shares its landmark role and name with another landmark; give each a distinct label",
      });
  return out;
}

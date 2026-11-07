/**
 * True when `el` or an element below it carries `data-k` (a bound element: a compiled template's, or a k.ui base
 * element's, rfc:0067)
 * outside any nested `data-k-island` subtree (a nested route level's own island). Walks `children` and
 * attributes only, so the DOM-free server tree needs no selector engine.
 */
export function islandIn(el: Element): boolean {
  if (el.hasAttribute("data-k")) return true;
  for (const c of Array.from(el.children)) if (!c.hasAttribute("data-k-island") && islandIn(c)) return true;
  return false;
}

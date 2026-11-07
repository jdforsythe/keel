/**
 * True when `el` or an element below it carries `data-k` (a bound element the compiler marked, k.runtime)
 * outside any nested `data-k-island` subtree (a nested route level's own island). Walks `children` and
 * attributes only, so the DOM-free server tree needs no selector engine.
 */
export function islandIn(el: Element): boolean {
  if (el.hasAttribute("data-k")) return true;
  for (const c of Array.from(el.children)) if (!c.hasAttribute("data-k-island") && islandIn(c)) return true;
  return false;
}

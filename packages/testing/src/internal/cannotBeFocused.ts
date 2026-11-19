/**
 * True when `el` or an ancestor takes it out of reach of a user: the `hidden` attribute, `inert`, inline
 * `display: none`, or the nearest inline `visibility` being `hidden` or `collapse`. `aria-hidden` is not here: it
 * hides from assistive technology and leaves the element focusable.
 */
export function cannotBeFocused(el: Element): boolean {
  let visibility = "";
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.hasAttribute("inert")) return true;
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      if (node.style.display === "none") return true;
      if (visibility === "") visibility = node.style.visibility;
    }
  }
  return visibility === "hidden" || visibility === "collapse";
}

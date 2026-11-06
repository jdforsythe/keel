/** True when the element is excluded from the accessibility tree (`hidden` or `aria-hidden="true"`). */
export function isHidden(el: Element): boolean {
  return el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true";
}

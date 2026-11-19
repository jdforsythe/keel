/**
 * Mark `el` bound (k.ui, rfc:0067): it registers an event prop or a `field`, or binds a signal or computed. Its
 * `data-k` makes the route level holding it an island (k.runtime), as a compiled template's bound element does.
 */
export function bound(el: Element): void {
  el.setAttribute("data-k", "");
}

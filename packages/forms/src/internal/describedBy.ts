/** Add or remove `id` in an element's `aria-describedby` token list, keeping other ids. */
export function describedBy(el: Element, id: string, on: boolean): void {
  const tokens = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((t) => t !== "" && t !== id);
  if (on) tokens.push(id);
  if (tokens.length === 0) el.removeAttribute("aria-describedby");
  else el.setAttribute("aria-describedby", tokens.join(" "));
}

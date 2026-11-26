/** `el` when it is a submit button of a form (a `button` of type `submit`, an `input` of type `submit` or `image`), else `null`. */
export function submitterOf(el: Element): HTMLButtonElement | HTMLInputElement | null {
  const form = el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el.form : null;
  if (form === null) return null;
  if (el instanceof HTMLButtonElement) return el.type === "submit" ? el : null;
  if (el instanceof HTMLInputElement) return el.type === "submit" || el.type === "image" ? el : null;
  return null;
}

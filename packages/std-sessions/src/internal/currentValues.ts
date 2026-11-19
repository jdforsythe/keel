/** The form control `el` is, or the first one inside it; `null` when there is none. */
const controlOf = (el: Element | null): Element | null =>
  el === null || el.matches("input, textarea, select") ? el : el.querySelector("input, textarea, select");

/** The current value of a form control, `undefined` when `el` is not one. */
const controlValue = (el: Element | null): string | undefined =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    ? el.value
    : undefined;

/**
 * The values a recorder starting now must treat as already redacted (std.sessions): the current value of each element
 * an `el:` entry names (by `id` or `data-k`) and of every password field. `complete` is false when an `el:` element is
 * not in the document, so a value typed into it earlier cannot be known.
 */
export function currentValues(ids: readonly string[]): { readonly values: string[]; readonly complete: boolean } {
  const values: string[] = [];
  let complete = true;
  for (const id of ids) {
    const el =
      document.getElementById(id) ??
      [...document.querySelectorAll("[data-k]")].find((e) => e.getAttribute("data-k") === id);
    const value = controlValue(controlOf(el ?? null));
    if (value === undefined) complete = false;
    else values.push(value);
  }
  const secret = 'input[type="password"], [autocomplete="current-password"], [autocomplete="new-password"]';
  for (const el of document.querySelectorAll(secret)) {
    const value = controlValue(el);
    if (value !== undefined) values.push(value);
  }
  return { values, complete };
}

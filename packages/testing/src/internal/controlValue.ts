const NO_VALUE: ReadonlySet<string> = new Set(["checkbox", "radio", "file"]);

/**
 * The live DOM `value` of a control a person types into or picks from: an `input` other than a checkbox, radio or
 * file input, a `textarea` or a `select`. `undefined` for every other element.
 */
export const controlValue = (el: Element): string | undefined => {
  if (el instanceof HTMLInputElement) return NO_VALUE.has(el.type) ? undefined : el.value;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value;
  return undefined;
};

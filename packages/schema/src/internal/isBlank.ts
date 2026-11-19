/** True when `text` has no non-whitespace character: the test of rule `required`. */
export function isBlank(text: string): boolean {
  return !/\S/.test(text);
}

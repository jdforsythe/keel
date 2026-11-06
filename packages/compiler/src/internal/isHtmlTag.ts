/** JSX convention: a lowercase first letter names a DOM element; anything else is a component. */
export function isHtmlTag(name: string): boolean {
  return /^[a-z]/.test(name);
}

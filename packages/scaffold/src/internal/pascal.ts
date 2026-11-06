/** Upper-case the first character. */
export function pascal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

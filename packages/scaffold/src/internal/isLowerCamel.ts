/** k.scaffold naming: module ids, id segments, fields. */
export function isLowerCamel(s: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(s);
}

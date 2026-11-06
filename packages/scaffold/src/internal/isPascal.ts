/** k.scaffold naming: components and schemas. */
export function isPascal(s: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(s);
}

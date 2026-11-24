/** Whether `key` is an exact plural form's key: `=` then a non-negative safe integer in canonical decimal (`'=0'`, `'=12'`). */
export function exactKey(key: string): boolean {
  return /^=(?:0|[1-9]\d*)$/.test(key) && Number.isSafeInteger(Number(key.slice(1)));
}

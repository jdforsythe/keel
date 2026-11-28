/** `key` as an object key in source: bare when it is an identifier or a plain integer, else quoted. */
export function keyText(key: string): string {
  return /^(?:[A-Za-z_$][A-Za-z0-9_$]*|0|[1-9][0-9]*)$/.test(key) ? key : JSON.stringify(key);
}

const BREAK = /[\n\r\v\f\u0085\u2028\u2029]/;

/** Whether `value` is a declared origin's reason (k.origins Declaration): 1 to 200 characters on one line, one visible. */
export function isOriginReason(value: string): boolean {
  const n = [...value].length;
  return n >= 1 && n <= 200 && !BREAK.test(value) && /\S/.test(value);
}

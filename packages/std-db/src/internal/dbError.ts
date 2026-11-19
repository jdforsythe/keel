/**
 * An error whose message starts with `code`, and whose `code` property is not enumerable, so an uncaught one prints
 * the code on one line only. Messages name keys and settings, never a value, key or URL.
 */
export function dbError(code: string, text: string): Error & { readonly code: string } {
  const e = Object.assign(new Error(`${code} ${text}`), { code });
  Object.defineProperty(e, "code", { enumerable: false });
  return e;
}

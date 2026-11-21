/**
 * A thrown error whose message starts with `code` (E2453, E2454, E2455, E2457) and whose `code` property is not
 * enumerable. Messages name positions, files and settings, never a parameter, row or URL.
 */
export function codeError(code: string, text: string): Error & { readonly code: string } {
  const e = Object.assign(new Error(`${code} ${text}`), { code });
  Object.defineProperty(e, "code", { enumerable: false });
  return e;
}

/**
 * A coded harness failure: an `Error` whose message starts with `code` (docs/OUTPUT.md diagnostic line)
 * and which carries `code`, `data`, and `see`.
 */
export function fail<D>(
  code: string,
  message: string,
  data: D,
): Error & { readonly code: string; readonly data: D; readonly see: "k.testing" } {
  return Object.assign(new Error(`${code} ${message}`), { code, data, see: "k.testing" as const });
}

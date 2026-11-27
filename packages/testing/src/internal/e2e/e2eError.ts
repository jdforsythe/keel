/**
 * A coded end-to-end failure: an `Error` whose message starts with `code` (docs/OUTPUT.md), carrying `code`, `data`
 * and `see`, the section that states the rule.
 */
export function e2eError<D>(
  code: string,
  message: string,
  data: D,
  see: "k.e2e" | "k.e2e-page" | "k.e2e-run" = "k.e2e",
): Error & { readonly code: string; readonly data: D; readonly see: string } {
  return Object.assign(new Error(`${code} ${message}`), { code, data, see });
}

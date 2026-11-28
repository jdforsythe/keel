/** `n` as a plain decimal with at most `decimals` places, no exponent and no `-0`: the `<n>` of k.values. */
export function fmtNumber(n: number, decimals = 6): string {
  const fixed = n.toFixed(decimals);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed === "-0" || trimmed === "" ? "0" : trimmed;
}

/** What ECMA-402 2023 adds to `Intl.NumberFormat`'s `formatToParts`: a decimal string literal, formatted exactly. */
export interface DecimalFormat {
  formatToParts(value: `${number}`): Intl.NumberFormatPart[];
}

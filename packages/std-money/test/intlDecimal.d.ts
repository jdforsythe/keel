// Test-only typing: the std.money conformance suite passes a decimal `string` to `Intl.NumberFormat`, which every
// supported runtime formats exactly (es2023.intl types only `${number}` literals).
declare namespace Intl {
  interface NumberFormat {
    format(value: string): string;
    formatToParts(value: string): NumberFormatPart[];
  }
}

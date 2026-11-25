/** Writes cents as euros with two decimals, `1250` as `12.50`. */
export default function euros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const rest = abs % 100;
  return `${sign}${Math.floor(abs / 100)}.${rest < 10 ? "0" : ""}${rest}`;
}

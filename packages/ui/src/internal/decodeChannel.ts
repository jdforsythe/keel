/** CSS Color 4's sRGB transfer function, as display-p3 shares it: an encoded channel to its linear value, sign kept. */
export function decodeChannel(c: number): number {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4);
}
